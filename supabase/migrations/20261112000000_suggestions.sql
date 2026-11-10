-- Personalised book suggestions.
--
-- Suggestions are made by the app server from catalogue + Open Library metadata (see
-- src/lib/suggestions). The database keeps, per reader: the current list, what they dismissed or
-- added (so it never comes back), and a fingerprint of the shelves the list was made from (so it's
-- only rebuilt when the shelves change). Everything here is private to its reader.
--
-- Not to be confused with public.recommendations: those are books one reader passes to another.

-- ===========================================================================
-- 1. Subject headings on catalogue books
-- ===========================================================================
-- Open Library's headings ("Gothic fiction", "Dandies", "Art and morality") carry the themes the
-- suggestion engine matches on. Catalogue writes stay server-only (service role), as before.
alter table public.books
  add column if not exists subjects text[] not null default '{}'
  constraint books_subjects_size check (cardinality(subjects) <= 40);
create index if not exists books_subjects_gin on public.books using gin (subjects);

-- ===========================================================================
-- 2. Suggestions and refresh state
-- ===========================================================================
create type public.suggestion_status as enum ('suggested', 'dismissed', 'added');

create table public.book_suggestions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- The logical book (normalised title + author surname), the same across editions.
  work_key         text not null check (char_length(work_key) between 2 and 200),
  book_id          uuid references public.books (id) on delete set null,
  ol_work_id       text check (ol_work_id ~ '^OL[0-9]+W$'),
  -- Display copy of the book as found, so the list needs no joins (and works before it's in the catalogue).
  book             jsonb not null check (
    jsonb_typeof(book) = 'object'
    and char_length(coalesce(book->>'title', '')) between 1 and 300
    and pg_column_size(book) <= 6000
    and (book->>'coverUrl' is null or book->>'coverUrl' ~ '^https://covers\.openlibrary\.org/b/(id|isbn|olid)/[A-Za-z0-9-]+\.jpg(\?default=false)?$')
  ),
  score            numeric(5, 4) not null check (score between 0 and 1),
  reasons          jsonb not null default '[]' check (jsonb_typeof(reasons) = 'array' and pg_column_size(reasons) <= 3000),
  source_book_ids  uuid[] not null default '{}' check (cardinality(source_book_ids) <= 10),
  status           public.suggestion_status not null default 'suggested',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, work_key)
);
create index book_suggestions_feed_idx on public.book_suggestions (user_id, status, score desc, id);
create trigger book_suggestions_touch before update on public.book_suggestions
  for each row execute function private.touch_updated_at();

create table public.suggestion_runs (
  user_id       uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  signature     text check (char_length(signature) <= 64),
  refreshed_at  timestamptz,
  attempted_at  timestamptz not null default now()
);

alter table public.book_suggestions enable row level security;
alter table public.suggestion_runs enable row level security;

create policy "see own suggestions" on public.book_suggestions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "add own suggestions" on public.book_suggestions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "update own suggestions" on public.book_suggestions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete own suggestions" on public.book_suggestions for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "see own suggestion runs" on public.suggestion_runs for select to authenticated
  using (user_id = (select auth.uid()));
create policy "start own suggestion runs" on public.suggestion_runs for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "update own suggestion runs" on public.suggestion_runs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.book_suggestions, public.suggestion_runs from anon;
-- Column grants: a suggestion can't be moved to another reader, and its dates are the server's.
revoke update on public.book_suggestions, public.suggestion_runs from authenticated;
grant update (book_id, ol_work_id, book, score, reasons, source_book_ids, status) on public.book_suggestions to authenticated;
grant update (signature, refreshed_at, attempted_at) on public.suggestion_runs to authenticated;

-- ===========================================================================
-- 3. Saving a fresh list, atomically
-- ===========================================================================
-- p_items: [{workKey, bookId, olWorkId, book, score, reasons, sourceBookIds}], at most 60.
-- p_items null records an attempt only (e.g. Open Library was unreachable): the current list stays.
-- Waiting suggestions are replaced; dismissed and added ones are never touched or brought back.
create or replace function public.save_suggestions(p_signature text, p_items jsonb)
returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  me uuid := auth.uid();
  n integer := 0;
begin
  if me is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if p_items is not null and (jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 60) then
    raise exception 'A suggestion list holds at most 60 books' using errcode = '22023';
  end if;

  insert into public.suggestion_runs (user_id, attempted_at) values (me, now())
    on conflict (user_id) do update set attempted_at = now();
  if p_items is null then return 0; end if;

  -- Anything waiting that has since been shelved (from anywhere) counts as added.
  update public.book_suggestions s set status = 'added'
   where s.user_id = me and s.status = 'suggested'
     and exists (
       select 1 from public.user_books ub join public.books b on b.id = ub.book_id
        where ub.user_id = me and ub.status is not null
          and (ub.book_id = s.book_id or (s.ol_work_id is not null and b.ol_work_id = s.ol_work_id))
     );

  delete from public.book_suggestions s
   where s.user_id = me and s.status = 'suggested'
     and s.work_key not in (select coalesce(i->>'workKey', '') from jsonb_array_elements(p_items) i);

  insert into public.book_suggestions (user_id, work_key, book_id, ol_work_id, book, score, reasons, source_book_ids)
  select distinct on (i->>'workKey')
         me, i->>'workKey', nullif(i->>'bookId', '')::uuid, nullif(i->>'olWorkId', ''), i->'book',
         (i->>'score')::numeric, coalesce(i->'reasons', '[]'::jsonb),
         coalesce(array(select jsonb_array_elements_text(coalesce(i->'sourceBookIds', '[]'::jsonb)))::uuid[], '{}')
    from jsonb_array_elements(p_items) i
   order by i->>'workKey', (i->>'score')::numeric desc
  on conflict (user_id, work_key) do update
     set book_id = excluded.book_id, ol_work_id = excluded.ol_work_id, book = excluded.book, score = excluded.score,
         reasons = excluded.reasons, source_book_ids = excluded.source_book_ids
   where public.book_suggestions.status = 'suggested';
  get diagnostics n = row_count;

  update public.suggestion_runs set signature = p_signature, refreshed_at = now() where user_id = me;
  return n;
end $$;

-- ===========================================================================
-- 4. "Readers who loved this also loved…"
-- ===========================================================================
-- Books that readers who loved the same books as you also loved (read or reading, 4★+ or unrated),
-- and that aren't on your shelves. Runs as the caller, so shelf visibility rules (blocks) apply.
-- Bounded: the 60 most overlapping readers.
create or replace function public.co_shelved_books(p_limit integer default 30)
returns table (book jsonb, readers integer, via uuid[])
language sql stable security invoker set search_path = '' as $$
  with mine as (
    select book_id, status, rating from public.user_books where user_id = (select auth.uid()) and status is not null
  ),
  liked as (
    select book_id from mine where status in ('read', 'reading', 'want_to_read') and coalesce(rating, 4) >= 3.5
  ),
  neighbours as (
    select ub.user_id, array_agg(ub.book_id) as via
      from public.user_books ub join liked l on l.book_id = ub.book_id
     where ub.user_id <> (select auth.uid()) and ub.status in ('read', 'reading') and coalesce(ub.rating, 4) >= 3.5
     group by ub.user_id
     order by count(*) desc, ub.user_id
     limit 60
  ),
  picks as (
    select ub.book_id, n.user_id, n.via
      from neighbours n
      join public.user_books ub on ub.user_id = n.user_id and ub.status in ('read', 'reading') and coalesce(ub.rating, 4) >= 4
     where not exists (select 1 from mine m where m.book_id = ub.book_id)
  )
  select to_jsonb(b) as book, count(distinct p.user_id)::integer as readers,
         (array_agg(distinct v.id))[1:3] as via
    from picks p
    join public.books b on b.id = p.book_id
    cross join lateral unnest(p.via) as v(id)
   group by b.id
   order by count(distinct p.user_id) desc, b.title
   limit least(greatest(coalesce(p_limit, 30), 1), 60);
$$;

-- ===========================================================================
-- 5. Function access
-- ===========================================================================
revoke execute on function public.save_suggestions(text, jsonb) from public, anon;
grant execute on function public.save_suggestions(text, jsonb) to authenticated, service_role;
revoke execute on function public.co_shelved_books(integer) from public, anon;
grant execute on function public.co_shelved_books(integer) to authenticated, service_role;
