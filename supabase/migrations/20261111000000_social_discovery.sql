-- ---------------------------------------------------------------------------
-- Social and discovery: readers with similar taste, invite links, and the
-- yearly / monthly reading recap.
--
-- Additive: new tables (invites, invite_redemptions) and functions only.
-- Rollback: drop the functions and the two tables.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. Readers with similar taste
-- ===========================================================================
-- Scored from what readers share publicly — books on their shelves, how they rated the
-- same books, favourite books, authors and genres — never from private diaries. Runs as
-- the caller, so shelves hidden by a block don't count; blocked readers are excluded too.
--   score (0–100) = 35 shared books (5+ = full) + 25 rating agreement (when both rated)
--                 + 15 shared favourite authors (2+) + 15 shared genres (3+) + 10 shared favourites
create or replace function public.similar_readers(p_limit int default 8)
returns table (
  profile jsonb, score int, shared_books int, shared_favourites int, shared_authors text[], shared_genres text[], agreement numeric
)
language sql stable security invoker set search_path = '' as $$
  with me as (
    select id, favourite_genres, favourite_authors from public.profiles where id = (select auth.uid())
  ),
  mine as (
    select book_id, rating, is_favourite from public.user_books
    where user_id = (select auth.uid()) and (status in ('read', 'reading', 'dnf') or is_favourite)
  ),
  overlap as (
    select ub.user_id,
           count(*)::int as shared_books,
           count(*) filter (where ub.is_favourite and m.is_favourite)::int as shared_favourites,
           avg(abs(ub.rating - m.rating)) filter (where ub.rating is not null and m.rating is not null) as diff
    from public.user_books ub
    join mine m on m.book_id = ub.book_id
    where ub.user_id <> (select auth.uid()) and (ub.status in ('read', 'reading', 'dnf') or ub.is_favourite)
    group by ub.user_id
    order by count(*) desc
    limit 500
  ),
  candidates as (
    select p.*, coalesce(o.shared_books, 0) as shared_books, coalesce(o.shared_favourites, 0) as shared_favourites, o.diff,
           array(select unnest(p.favourite_authors) intersect select unnest(me.favourite_authors)) as authors,
           array(select unnest(p.favourite_genres) intersect select unnest(me.favourite_genres)) as genres
    from public.profiles p
    cross join me
    left join overlap o on o.user_id = p.id
    where p.onboarded
      and p.id <> me.id
      and not private.blocked_between(p.id, me.id)
      and not exists (select 1 from public.follows f where f.follower_id = me.id and f.following_id = p.id)
      and (o.user_id is not null or p.favourite_authors && me.favourite_authors or p.favourite_genres && me.favourite_genres)
  )
  select
    to_jsonb(c) - 'shared_books' - 'shared_favourites' - 'diff' - 'authors' - 'genres',
    round(
      35 * least(1, c.shared_books / 5.0)
      + coalesce(25 * (1 - c.diff / 4.5), 0)
      + 15 * least(1, cardinality(c.authors) / 2.0)
      + 15 * least(1, cardinality(c.genres) / 3.0)
      + 10 * least(1, c.shared_favourites)
    )::int,
    c.shared_books, c.shared_favourites, c.authors, c.genres,
    case when c.diff is null then null else round(1 - c.diff / 4.5, 2) end
  from candidates c
  order by 2 desc, c.followers_count desc
  limit least(p_limit, 30);
$$;

-- ===========================================================================
-- 2. Invite links
-- ===========================================================================
create table public.invites (
  code        text primary key check (code ~ '^[A-Za-z0-9_-]{12,40}$'),
  inviter_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz,
  max_uses    integer check (max_uses between 1 and 500),
  uses        integer not null default 0
);
create index invites_inviter_idx on public.invites (inviter_id, created_at desc);

-- Who joined through which link. Inviters only ever see counts (no select policy).
create table public.invite_redemptions (
  invitee_id  uuid primary key references public.profiles (id) on delete cascade,
  code        text not null references public.invites (code) on delete cascade,
  created_at  timestamptz not null default now()
);
create index invite_redemptions_code_idx on public.invite_redemptions (code);

alter table public.invites enable row level security;
alter table public.invite_redemptions enable row level security;
create policy "see own invites" on public.invites for select to authenticated using (inviter_id = (select auth.uid()));
create policy "create own invites" on public.invites for insert to authenticated
  with check (inviter_id = (select auth.uid()) and uses = 0);
create policy "delete own invites" on public.invites for delete to authenticated using (inviter_id = (select auth.uid()));
revoke update on public.invites from anon, authenticated;
revoke all on public.invites, public.invite_redemptions from anon;
revoke all on public.invite_redemptions from authenticated;

create or replace function private.limit_invites() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.rate_limit((select count(*) from public.invites where inviter_id = new.inviter_id and created_at > now() - interval '1 day'), 20, 'invite links');
  return new;
end $$;
create trigger invites_rate_limit before insert on public.invites for each row execute function private.limit_invites();

-- The public face of an invite link: who sent it, and whether it still works. Nothing else.
create or replace function public.invite_preview(p_code text)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'valid', (i.expires_at is null or i.expires_at > now()) and (i.max_uses is null or i.uses < i.max_uses),
    'inviter', jsonb_build_object('username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url, 'favourite_genres', p.favourite_genres)
  )
  from public.invites i join public.profiles p on p.id = i.inviter_id
  where i.code = p_code
$$;
grant execute on function public.invite_preview(text) to anon, authenticated;

-- A new reader claims the invite they arrived with: counted once, and they follow whoever
-- invited them. Only for accounts made in the last week, only once per reader.
create or replace function public.redeem_invite(p_code text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  inv public.invites;
begin
  if me is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  select * into inv from public.invites where code = p_code for update;
  if inv.code is null
     or inv.inviter_id = me
     or (inv.expires_at is not null and inv.expires_at <= now())
     or (inv.max_uses is not null and inv.uses >= inv.max_uses)
     or exists (select 1 from public.invite_redemptions where invitee_id = me)
     or not exists (select 1 from public.profiles where id = me and created_at > now() - interval '7 days') then
    return false;
  end if;
  insert into public.invite_redemptions (invitee_id, code) values (me, p_code);
  update public.invites set uses = uses + 1 where code = p_code;
  if not private.blocked_between(me, inv.inviter_id) then
    insert into public.follows (follower_id, following_id) values (me, inv.inviter_id) on conflict do nothing;
  end if;
  return true;
end $$;

-- ===========================================================================
-- 3. Reading recap: a year (the Yearbook) or a single month
-- ===========================================================================
-- Same counting rules as reading_stats (your own diary for you, public shelves for others),
-- plus the details a recap needs. Missing data stays missing (nulls), never invented.
create or replace function public.reading_recap(p_user uuid, p_year int, p_month int default null)
returns jsonb
language sql stable security invoker set search_path = '' as $$
  with diary as (
    select s.book_id, s.finished_on as day, s.is_reread
    from public.reading_sessions s
    where s.user_id = p_user and s.status = 'finished' and s.finished_on is not null
      and extract(year from s.finished_on) = p_year
      and (p_month is null or extract(month from s.finished_on) = p_month)
  ),
  shelf_only as (
    -- Dated Read books only (see reading_stats): an undated one never lands in a period by guesswork.
    select ub.book_id, ub.finished_at as day, false as is_reread
    from public.user_books ub
    where ub.user_id = p_user and ub.status = 'read' and ub.finished_at is not null
      and extract(year from ub.finished_at) = p_year
      and (p_month is null or extract(month from ub.finished_at) = p_month)
      and not exists (select 1 from diary d where d.book_id = ub.book_id)
  ),
  done as (select * from diary union all select * from shelf_only),
  books_done as (
    select b.id, b.slug, b.title, b.authors, b.cover_url, b.page_count, b.genres, ub.rating, ub.is_favourite,
           max(d.day) as last_day
    from done d
    join public.books b on b.id = d.book_id
    left join public.user_books ub on ub.user_id = p_user and ub.book_id = d.book_id
    group by b.id, ub.rating, ub.is_favourite
  ),
  period_quotes as (
    select q.id, q.book_id, q.body, q.created_at from public.quotes q
    where q.user_id = p_user and not q.is_draft
      and extract(year from q.created_at) = p_year
      and (p_month is null or extract(month from q.created_at) = p_month)
  ),
  top_genre as (select g, count(*) n from books_done, unnest(genres) g group by g order by n desc, g limit 1),
  top_author as (select a, count(*) n from books_done, unnest(authors) a group by a order by n desc, a limit 1),
  busiest as (select extract(month from day)::int as m, count(*) n from done group by 1 order by n desc, m limit 1),
  highlighted as (
    select b.id, b.slug, b.title, b.authors, b.cover_url, count(*)::int as n
    from period_quotes q join public.books b on b.id = q.book_id
    group by b.id order by n desc, b.title limit 1
  ),
  loved_line as (
    select q.id, q.body, b.title, p.likes_count
    from period_quotes q
    join public.posts p on p.quote_id = q.id
    join public.books b on b.id = q.book_id
    where p.likes_count > 0
    order by p.likes_count desc, q.created_at desc limit 1
  ),
  favourite as (
    select * from books_done where rating is not null order by rating desc, is_favourite desc, last_day desc limit 1
  )
  select jsonb_build_object(
    'year', p_year,
    'month', p_month,
    'completions', (select count(*) from done),
    'distinct_books', (select count(*) from books_done),
    'rereads', (select count(*) from done where is_reread),
    'pages', (select coalesce(sum(page_count), 0) from books_done where page_count is not null),
    'books_with_pages', (select count(*) from books_done where page_count is not null),
    'average_rating', (select round(avg(rating), 1) from books_done where rating is not null),
    'by_month', (select jsonb_agg((select count(*) from done where extract(month from day) = m) order by m) from generate_series(1, 12) m),
    'favourite_book', (select jsonb_build_object('id', id, 'slug', slug, 'title', title, 'authors', authors, 'cover_url', cover_url, 'rating', rating) from favourite),
    'top_author', (select jsonb_build_object('name', a, 'count', n) from top_author),
    'top_genre', (select jsonb_build_object('name', g, 'count', n) from top_genre),
    'busiest_month', (select jsonb_build_object('month', m, 'count', n) from busiest),
    'most_highlighted', (select jsonb_build_object('id', id, 'slug', slug, 'title', title, 'authors', authors, 'cover_url', cover_url, 'count', n) from highlighted),
    'loved_line', (select jsonb_build_object('quote_id', id, 'body', body, 'title', title, 'likes', likes_count) from loved_line),
    'annotations', (select count(*) from period_quotes),
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object(
        'book_id', b.id, 'slug', b.slug, 'title', b.title, 'authors', b.authors, 'cover_url', b.cover_url,
        'day', d.day, 'rating', ub.rating, 'reread', d.is_reread) order by d.day, b.title)
      from done d join public.books b on b.id = d.book_id
      left join public.user_books ub on ub.user_id = p_user and ub.book_id = d.book_id
    ), '[]')
  )
$$;

-- ===========================================================================
-- 4. Importing a shelf entry (Goodreads)
-- ===========================================================================
-- One imported book: the shelf entry (status, rating, finish date, custom shelves) and, for a
-- dated read, its diary entry. Never posts. An existing entry is left alone unless p_overwrite.
create or replace function public.import_shelf_entry(
  p_book_id uuid,
  p_status public.shelf_status,
  p_rating numeric default null,
  p_finished_on date default null,
  p_shelves text[] default '{}',
  p_overwrite boolean default false
) returns text
language plpgsql security invoker set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  prev public.user_books;
begin
  if me is null then
    raise exception 'Sign in to import' using errcode = '42501';
  end if;
  if p_finished_on is not null and p_finished_on > current_date + 1 then
    raise exception 'That date is in the future' using errcode = '22023';
  end if;
  select * into prev from public.user_books where user_id = me and book_id = p_book_id for update;
  if prev.id is not null and prev.status is not null and not p_overwrite then
    return 'skipped';
  end if;
  insert into public.user_books (user_id, book_id, status, rating, finished_at, shelves)
  values (me, p_book_id, p_status, p_rating, case when p_status = 'read' then p_finished_on end, coalesce(p_shelves, '{}'))
  on conflict (user_id, book_id) do update
  set status = excluded.status,
      rating = coalesce(excluded.rating, public.user_books.rating),
      finished_at = coalesce(excluded.finished_at, public.user_books.finished_at),
      shelves = (select coalesce(array_agg(distinct s), '{}') from unnest(public.user_books.shelves || excluded.shelves) as s);
  if p_status = 'read' and p_finished_on is not null and not exists (
    select 1 from public.reading_sessions where user_id = me and book_id = p_book_id and status = 'finished' and finished_on = p_finished_on
  ) then
    insert into public.reading_sessions (user_id, book_id, status, finished_on) values (me, p_book_id, 'finished', p_finished_on);
  end if;
  return case when prev.id is not null and prev.status is not null then 'updated' else 'imported' end;
end $$;

-- ===========================================================================
-- 5. Function access
-- ===========================================================================
-- New functions are executable by PUBLIC by default; "revoke from anon" alone doesn't stop that.
-- Everything that acts for a reader is for signed-in readers only (each also checks auth.uid()).
do $$
declare f text;
begin
  foreach f in array array[
    'public.set_shelf_status(uuid, public.shelf_status, boolean, boolean, public.visibility, date)',
    'public.undo_shelf_move(jsonb)',
    'public.publish_review(uuid, text, numeric, text, boolean, boolean, public.visibility)',
    'public.log_book(uuid, date, numeric, boolean, text, text, text, boolean, text, text, public.visibility, boolean)',
    'public.reorder_list(uuid, uuid[])',
    'public.similar_readers(int)',
    'public.redeem_invite(text)',
    'public.import_shelf_entry(uuid, public.shelf_status, numeric, date, text[], boolean)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;
