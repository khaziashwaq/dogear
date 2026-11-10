-- ---------------------------------------------------------------------------
-- Reading life: one rating per reader and book, logging a finished book in one
-- step, atomic review publishing and list reordering, and year-scoped stats
-- computed in the database.
--
-- Data changes: ratings are reconciled once (see 1). Nothing is deleted.
-- Rollback: drop the functions and triggers below. The reconciled ratings stay
-- valid under the old code (it reads both columns).
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. One rating per reader and book
-- ===========================================================================
-- The shelf entry (user_books.rating) is the reader's rating. A review shows that same
-- rating: setting stars on a review sets the shelf rating, and changing the shelf rating
-- updates the reader's reviews of that book. Triggers keep the copy on reviews in step,
-- so no code path can leave two different ratings for one reader and book.

-- Reconcile what's there: a shelf with no rating takes the latest rated review's stars…
insert into public.user_books (user_id, book_id, rating, status)
select distinct on (r.user_id, r.book_id) r.user_id, r.book_id, r.rating, 'read'::public.shelf_status
from public.reviews r
where r.rating is not null
order by r.user_id, r.book_id, r.created_at desc
on conflict (user_id, book_id) do update
  set rating = coalesce(public.user_books.rating, excluded.rating);
-- …then every review shows its reader's shelf rating.
update public.reviews r
set rating = ub.rating
from public.user_books ub
where ub.user_id = r.user_id and ub.book_id = r.book_id and r.rating is distinct from ub.rating;

-- A new review without stars shows the reader's existing rating.
create or replace function private.review_takes_shelf_rating()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.rating is null then
    select rating into new.rating from public.user_books where user_id = new.user_id and book_id = new.book_id;
  end if;
  return new;
end $$;
create trigger reviews_take_rating before insert on public.reviews
  for each row execute function private.review_takes_shelf_rating();

-- Stars set on a review become the shelf rating (runs as the reader; RLS applies).
create or replace function private.review_sets_shelf_rating()
returns trigger language plpgsql set search_path = '' as $$
begin
  if pg_trigger_depth() > 1 or new.rating is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.rating is not distinct from old.rating then
    return new;
  end if;
  insert into public.user_books (user_id, book_id, rating, status)
  values (new.user_id, new.book_id, new.rating, 'read')
  on conflict (user_id, book_id) do update set rating = excluded.rating;
  return new;
end $$;
create trigger reviews_set_rating after insert or update of rating on public.reviews
  for each row execute function private.review_sets_shelf_rating();

-- A changed shelf rating updates the reader's reviews of that book.
create or replace function private.shelf_rating_to_reviews()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.rating is not distinct from old.rating then
    return new;
  end if;
  update public.reviews set rating = new.rating
  where user_id = new.user_id and book_id = new.book_id and rating is distinct from new.rating;
  return new;
end $$;
create trigger user_books_rating_to_reviews after insert or update of rating on public.user_books
  for each row execute function private.shelf_rating_to_reviews();

-- ===========================================================================
-- 2. Publishing a review: review + its post in one transaction
-- ===========================================================================
create or replace function public.publish_review(
  p_book_id uuid,
  p_body text,
  p_rating numeric default null,
  p_title text default null,
  p_spoilers boolean default false,
  p_reread boolean default false,
  p_visibility public.visibility default 'public'
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  review_id uuid;
begin
  if me is null then
    raise exception 'Sign in to write a review' using errcode = '42501';
  end if;
  insert into public.reviews (user_id, book_id, rating, title, body, contains_spoilers, is_reread, visibility)
  values (me, p_book_id, p_rating, nullif(trim(p_title), ''), trim(p_body), p_spoilers, p_reread, p_visibility)
  returning id into review_id;
  insert into public.posts (user_id, kind, book_id, review_id, visibility)
  values (me, 'review', p_book_id, review_id, p_visibility);
  -- Reviewing a book you haven't shelved puts it on Read.
  insert into public.user_books (user_id, book_id, status)
  values (me, p_book_id, 'read')
  on conflict (user_id, book_id) do update set status = coalesce(public.user_books.status, 'read');
  return review_id;
end $$;
revoke execute on function public.publish_review(uuid, text, numeric, text, boolean, boolean, public.visibility) from anon;

-- ===========================================================================
-- 3. Logging a finished book
-- ===========================================================================
-- One step for "I finished this": the diary entry (date, re-read, private notes), the shelf
-- (Read, rating), and optionally a review, a favourite line and a feed post. All or nothing.
create or replace function public.log_book(
  p_book_id uuid,
  p_finished_on date default null,
  p_rating numeric default null,
  p_reread boolean default false,
  p_notes text default null,
  p_review_title text default null,
  p_review_body text default null,
  p_spoilers boolean default false,
  p_quote_body text default null,
  p_quote_page text default null,
  p_visibility public.visibility default 'public',
  p_share boolean default false
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  day date := coalesce(p_finished_on, current_date);
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  open_s public.reading_sessions;
  session_id uuid;
  review_id uuid;
  quote_id uuid;
  post_id uuid;
begin
  if me is null then
    raise exception 'Sign in to log a book' using errcode = '42501';
  end if;
  if not exists (select 1 from public.books where id = p_book_id) then
    raise exception 'Book not found' using errcode = 'P0002';
  end if;
  if day > current_date + 1 then
    raise exception 'That date is in the future' using errcode = '22023';
  end if;

  -- The diary: close the read in progress, or record this read.
  select * into open_s from public.reading_sessions
  where user_id = me and book_id = p_book_id and status = 'reading'
  order by created_at desc limit 1;
  if open_s.id is not null then
    update public.reading_sessions
    set status = 'finished',
        finished_on = day,
        -- Back-dating a finish before the day it was put on Reading: the read started no later than that.
        started_on = least(started_on, day),
        is_reread = is_reread or p_reread,
        notes = coalesce(v_notes, notes)
    where id = open_s.id
    returning id into session_id;
  else
    select id into session_id from public.reading_sessions
    where user_id = me and book_id = p_book_id and status = 'finished' and finished_on = day and not p_reread
    limit 1;
    if session_id is not null then
      -- Logged twice for the same day: one read, keep the newest notes.
      update public.reading_sessions set notes = coalesce(v_notes, notes) where id = session_id;
    else
      insert into public.reading_sessions (user_id, book_id, status, finished_on, is_reread, notes)
      values (me, p_book_id, 'finished', day, p_reread, v_notes)
      returning id into session_id;
    end if;
  end if;

  -- The shelf: Read, finished that day, and the rating if one was given.
  insert into public.user_books (user_id, book_id, status, finished_at, rating)
  values (me, p_book_id, 'read', day, p_rating)
  on conflict (user_id, book_id) do update
  set status = 'read',
      finished_at = excluded.finished_at,
      rating = coalesce(excluded.rating, public.user_books.rating);

  -- Optional: a review (with its post), and a favourite line (with its post).
  if nullif(trim(coalesce(p_review_body, '')), '') is not null then
    review_id := public.publish_review(p_book_id, p_review_body, p_rating, p_review_title, p_spoilers, p_reread, p_visibility);
  end if;
  if nullif(trim(coalesce(p_quote_body, '')), '') is not null then
    insert into public.quotes (user_id, book_id, body, page, visibility)
    values (me, p_book_id, trim(p_quote_body), nullif(trim(coalesce(p_quote_page, '')), ''), p_visibility)
    returning id into quote_id;
    insert into public.posts (user_id, kind, book_id, quote_id, visibility)
    values (me, 'quote', p_book_id, quote_id, p_visibility);
  end if;
  -- "Finished" goes to the feed only when asked, and not on top of a review (which already says so).
  if p_share and review_id is null then
    insert into public.posts (user_id, kind, book_id, visibility)
    values (me, 'finished', p_book_id, p_visibility)
    returning id into post_id;
  end if;

  return jsonb_build_object('session_id', session_id, 'review_id', review_id, 'quote_id', quote_id, 'post_id', post_id);
end $$;
revoke execute on function public.log_book(uuid, date, numeric, boolean, text, text, text, boolean, text, text, public.visibility, boolean) from anon;

-- ===========================================================================
-- 4. Reordering a list in one statement
-- ===========================================================================
create or replace function public.reorder_list(p_list_id uuid, p_book_ids uuid[])
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  current_ids uuid[];
begin
  if not exists (select 1 from public.lists where id = p_list_id and user_id = me) then
    raise exception 'You can only reorder your own lists' using errcode = '42501';
  end if;
  select coalesce(array_agg(book_id order by book_id), '{}') into current_ids from public.list_books where list_id = p_list_id;
  if current_ids is distinct from (select coalesce(array_agg(x order by x), '{}') from unnest(p_book_ids) as x) then
    raise exception 'The list changed while you were reordering it. Reload and try again.' using errcode = '22023';
  end if;
  update public.list_books lb
  set position = o.ord - 1
  from unnest(p_book_ids) with ordinality as o(book_id, ord)
  where lb.list_id = p_list_id and lb.book_id = o.book_id;
  -- Touch the list (its updated_at trigger) so it rises in "recently updated".
  update public.lists set title = title where id = p_list_id;
end $$;
revoke execute on function public.reorder_list(uuid, uuid[]) from anon;

-- ===========================================================================
-- 5. Reading stats for a year, aggregated here
-- ===========================================================================
-- Runs as the caller, so RLS decides what counts: a reader's own stats use their private
-- diary (every finished read, re-reads included); anyone else sees one completion per book
-- from public shelves, and nothing across a block. Returns only aggregates.
create or replace function public.reading_stats(p_user uuid, p_year int)
returns jsonb
language sql stable security invoker set search_path = '' as $$
  with diary as (
    select s.book_id, s.finished_on as day, s.is_reread
    from public.reading_sessions s
    where s.user_id = p_user and s.status = 'finished' and s.finished_on is not null
      and extract(year from s.finished_on) = p_year
  ),
  shelf_only as (
    -- Books marked Read without a visible diary entry that year (other readers, or older data).
    -- Only with a finish date: an undated Read book counts all-time, never in a year it may not belong to.
    select ub.book_id, ub.finished_at as day, false as is_reread
    from public.user_books ub
    where ub.user_id = p_user and ub.status = 'read' and ub.finished_at is not null
      and extract(year from ub.finished_at) = p_year
      and not exists (select 1 from diary d where d.book_id = ub.book_id)
  ),
  done as (
    select * from diary union all select * from shelf_only
  ),
  books_done as (
    select distinct d.book_id, b.page_count, b.genres, b.authors, ub.rating
    from done d
    join public.books b on b.id = d.book_id
    left join public.user_books ub on ub.user_id = p_user and ub.book_id = d.book_id
  ),
  months as (
    select m, (select count(*) from done where extract(month from day) = m)::int as n
    from generate_series(1, 12) as m
  ),
  genres as (
    select g, count(*)::int as n from books_done, unnest(genres) as g group by g order by n desc, g limit 5
  ),
  authors as (
    select a, count(*)::int as n from books_done, unnest(authors) as a group by a order by n desc, a limit 5
  ),
  ratings as (
    select i, (select count(*) from books_done where rating * 2 = i)::int as n from generate_series(1, 10) as i
  )
  select jsonb_build_object(
    'year', p_year,
    'completions', (select count(*) from done),
    'distinct_books', (select count(*) from books_done),
    'rereads', (select count(*) from done where is_reread),
    'sessions', (
      select count(*) from public.reading_sessions s
      where s.user_id = p_user
        and (extract(year from s.started_on) = p_year or extract(year from s.finished_on) = p_year)
    ),
    'by_month', (select jsonb_agg(n order by m) from months),
    'pages', (select coalesce(sum(page_count), 0) from books_done where page_count is not null),
    'books_with_pages', (select count(*) from books_done where page_count is not null),
    'average_rating', (select round(avg(rating), 1) from books_done where rating is not null),
    'rating_distribution', (select jsonb_agg(n order by i) from ratings),
    'top_genres', coalesce((select jsonb_agg(jsonb_build_object('genre', g, 'count', n) order by n desc, g) from genres), '[]'),
    'top_authors', coalesce((select jsonb_agg(jsonb_build_object('author', a, 'count', n) order by n desc, a) from authors), '[]'),
    'currently_reading', (select count(*) from public.user_books where user_id = p_user and status = 'reading'),
    'books_read_all_time', (select count(*) from public.user_books where user_id = p_user and status = 'read'),
    'reviews', (select count(*) from public.reviews where user_id = p_user),
    'quotes', (select count(*) from public.quotes where user_id = p_user and not is_draft),
    'lists', (select count(*) from public.lists where user_id = p_user)
  )
$$;

-- Book page rating histogram in the database, not 10,000 rows in the app.
create or replace function public.rating_histogram(p_book_id uuid)
returns int[]
language sql stable security invoker set search_path = '' as $$
  select array_agg((select count(*) from public.user_books where book_id = p_book_id and rating * 2 = i)::int order by i)
  from generate_series(1, 10) as i
$$;
