-- dogear. — initial schema
-- Social reading network: profiles, a shared book catalogue, shelves, diary,
-- reviews, quotes, lists, a unified post feed, and the social graph.
--
-- Conventions
--   * Every user-owned table references public.profiles(id) so PostgREST can embed authors.
--   * Shareable entities (reviews, quotes, lists) each own exactly one row in public.posts.
--     Likes, comments, bookmarks and reposts always target posts, which keeps the social
--     layer uniform and lets foreign keys + RLS do the heavy lifting.
--   * Denormalised counters are maintained by SECURITY DEFINER triggers.
--   * All policies wrap auth.uid() in a sub-select so it is evaluated once per statement.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists citext with schema extensions;

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.visibility as enum ('public', 'followers', 'private');
create type public.shelf_status as enum ('want_to_read', 'reading', 'read', 'dnf');
create type public.session_status as enum ('reading', 'finished', 'abandoned');
create type public.post_kind as enum (
  'review', 'update', 'started', 'finished', 'quote', 'list', 'recommendation', 'repost'
);
create type public.notification_kind as enum (
  'follow', 'like', 'comment', 'reply', 'repost', 'recommendation', 'list_follow'
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  username          extensions.citext unique
                    check (username ~ '^[a-z0-9_.]{3,24}$'),
  display_name      text not null default '' check (char_length(display_name) <= 60),
  bio               text not null default '' check (char_length(bio) <= 280),
  avatar_url        text,
  cover_url         text,
  pronouns          text check (char_length(pronouns) <= 30),
  location          text check (char_length(location) <= 60),
  website           text check (char_length(website) <= 200),
  accent            text not null default 'burgundy'
                    check (accent in ('burgundy', 'sage', 'rose', 'butter', 'ink')),
  profile_motif     text not null default 'dogear'
                    check (profile_motif in ('dogear', 'stars', 'botanical', 'stripes', 'none')),
  favourite_genres  text[] not null default '{}',
  favourite_authors text[] not null default '{}',
  reading_goal      integer check (reading_goal between 1 and 1000),
  onboarded         boolean not null default false,
  followers_count   integer not null default 0,
  following_count   integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index profiles_username_trgm on public.profiles using gin ((username::text) extensions.gin_trgm_ops);
create index profiles_display_name_trgm on public.profiles using gin (display_name extensions.gin_trgm_ops);
create index profiles_genres_gin on public.profiles using gin (favourite_genres);
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- Create a profile row whenever someone signs up (email or OAuth).
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Social graph
-- ---------------------------------------------------------------------------
create table public.follows (
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index follows_following_idx on public.follows (following_id);

-- Visibility check used by RLS policies throughout.
create or replace function private.can_view(owner uuid, vis public.visibility)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    vis = 'public'
    or owner = (select auth.uid())
    or (
      vis = 'followers'
      and exists (
        select 1 from public.follows f
        where f.follower_id = (select auth.uid()) and f.following_id = owner
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- Books (one canonical row per work, shared by every reader)
-- ---------------------------------------------------------------------------
create table public.books (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9-]{1,120}$'),
  title           text not null check (char_length(title) between 1 and 300),
  subtitle        text,
  authors         text[] not null default '{}',
  description     text,
  cover_url       text,
  isbn13          text unique check (isbn13 ~ '^97[89][0-9]{10}$'),
  isbn10          text check (isbn10 ~ '^[0-9]{9}[0-9X]$'),
  ol_work_id      text unique check (ol_work_id ~ '^OL[0-9]+W$'),
  ol_edition_id   text check (ol_edition_id ~ '^OL[0-9]+M$'),
  published_year  integer check (published_year between -3000 and 2100),
  publisher       text,
  page_count      integer check (page_count between 1 and 20000),
  language        text,
  genres          text[] not null default '{}',
  moods           text[] not null default '{}',
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index books_title_trgm on public.books using gin (title extensions.gin_trgm_ops);
create index books_genres_gin on public.books using gin (genres);
create index books_moods_gin on public.books using gin (moods);
create trigger books_touch before update on public.books
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Shelves & diary
-- ---------------------------------------------------------------------------
create table public.user_books (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  book_id         uuid not null references public.books (id) on delete cascade,
  status          public.shelf_status,
  rating          numeric(2, 1) check (rating between 0.5 and 5 and (rating * 2) = floor(rating * 2)),
  is_favourite    boolean not null default false,
  favourited_at   timestamptz,
  shelves         text[] not null default '{}',   -- custom shelves (user-defined tags)
  progress_pages  integer check (progress_pages >= 0),
  started_at      date,
  finished_at     date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, book_id)
);
create index user_books_book_idx on public.user_books (book_id, status);
create index user_books_user_status_idx on public.user_books (user_id, status, updated_at desc);
create index user_books_updated_idx on public.user_books (updated_at desc);
create trigger user_books_touch before update on public.user_books
  for each row execute function private.touch_updated_at();

create table public.reading_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  book_id      uuid not null references public.books (id) on delete cascade,
  status       public.session_status not null default 'reading',
  started_on   date,
  finished_on  date,
  is_reread    boolean not null default false,
  notes        text check (char_length(notes) <= 2000),
  created_at   timestamptz not null default now(),
  check (finished_on is null or started_on is null or finished_on >= started_on)
);
create index reading_sessions_user_idx on public.reading_sessions (user_id, created_at desc);
create index reading_sessions_book_idx on public.reading_sessions (book_id);

-- ---------------------------------------------------------------------------
-- Reviews, quotes, lists
-- ---------------------------------------------------------------------------
create table public.reviews (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  book_id            uuid not null references public.books (id) on delete cascade,
  rating             numeric(2, 1) check (rating between 0.5 and 5 and (rating * 2) = floor(rating * 2)),
  title              text check (char_length(title) <= 140),
  body               text not null check (char_length(body) between 1 and 20000),
  contains_spoilers  boolean not null default false,
  is_reread          boolean not null default false,
  visibility         public.visibility not null default 'public',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index reviews_book_idx on public.reviews (book_id, created_at desc);
create index reviews_user_idx on public.reviews (user_id, created_at desc);
create trigger reviews_touch before update on public.reviews
  for each row execute function private.touch_updated_at();

create table public.quotes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  book_id     uuid not null references public.books (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  page        text check (char_length(page) <= 20),
  commentary  text check (char_length(commentary) <= 1000),
  visibility  public.visibility not null default 'public',
  created_at  timestamptz not null default now()
);
create index quotes_book_idx on public.quotes (book_id, created_at desc);
create index quotes_user_idx on public.quotes (user_id, created_at desc);

create table public.lists (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 120),
  description      text check (char_length(description) <= 2000),
  cover_style      text not null default 'rose'
                   check (cover_style in ('rose', 'sage', 'butter', 'burgundy', 'ink', 'collage')),
  cover_image_url  text,
  visibility       public.visibility not null default 'public',
  is_ranked        boolean not null default false,
  followers_count  integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index lists_user_idx on public.lists (user_id, updated_at desc);
create trigger lists_touch before update on public.lists
  for each row execute function private.touch_updated_at();

create table public.list_books (
  list_id    uuid not null references public.lists (id) on delete cascade,
  book_id    uuid not null references public.books (id) on delete cascade,
  position   integer not null,
  note       text check (char_length(note) <= 500),
  image_url  text,
  added_at   timestamptz not null default now(),
  primary key (list_id, book_id)
);
create index list_books_order_idx on public.list_books (list_id, position);
create index list_books_book_idx on public.list_books (book_id);

create table public.list_follows (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  list_id     uuid not null references public.lists (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, list_id)
);
create index list_follows_list_idx on public.list_follows (list_id);

-- ---------------------------------------------------------------------------
-- Posts: the unified activity stream
-- ---------------------------------------------------------------------------
create table public.posts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  kind              public.post_kind not null,
  book_id           uuid references public.books (id) on delete cascade,
  review_id         uuid unique references public.reviews (id) on delete cascade,
  quote_id          uuid unique references public.quotes (id) on delete cascade,
  list_id           uuid unique references public.lists (id) on delete cascade,
  repost_of_id      uuid references public.posts (id) on delete cascade,
  body              text check (char_length(body) <= 5000),
  progress_pages    integer check (progress_pages >= 0),
  progress_percent  integer check (progress_percent between 0 and 100),
  visibility        public.visibility not null default 'public',
  likes_count       integer not null default 0,
  comments_count    integer not null default 0,
  reposts_count     integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (kind <> 'review' or review_id is not null),
  check (kind <> 'quote' or quote_id is not null),
  check (kind <> 'list' or list_id is not null),
  check (kind <> 'repost' or repost_of_id is not null)
);
create index posts_user_created_idx on public.posts (user_id, created_at desc);
create index posts_public_created_idx on public.posts (created_at desc) where visibility = 'public';
create index posts_book_idx on public.posts (book_id);
create index posts_repost_of_idx on public.posts (repost_of_id);
create unique index posts_one_repost_per_user on public.posts (user_id, repost_of_id)
  where repost_of_id is not null;
create trigger posts_touch before update on public.posts
  for each row execute function private.touch_updated_at();

-- Keep a shareable entity's post visibility in sync with the entity itself.
create or replace function private.sync_post_visibility()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.visibility is distinct from old.visibility then
    if tg_table_name = 'reviews' then
      update public.posts set visibility = new.visibility where review_id = new.id;
    elsif tg_table_name = 'quotes' then
      update public.posts set visibility = new.visibility where quote_id = new.id;
    elsif tg_table_name = 'lists' then
      update public.posts set visibility = new.visibility where list_id = new.id;
    end if;
  end if;
  return new;
end $$;
create trigger reviews_sync_visibility after update on public.reviews
  for each row execute function private.sync_post_visibility();
create trigger quotes_sync_visibility after update on public.quotes
  for each row execute function private.sync_post_visibility();
create trigger lists_sync_visibility after update on public.lists
  for each row execute function private.sync_post_visibility();

create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  parent_id   uuid references public.comments (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at);
create index comments_parent_idx on public.comments (parent_id);
create index comments_user_idx on public.comments (user_id);

create table public.likes (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  post_id     uuid not null references public.posts (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index likes_post_idx on public.likes (post_id);

create table public.bookmarks (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  post_id     uuid not null references public.posts (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index bookmarks_user_idx on public.bookmarks (user_id, created_at desc);
create index bookmarks_post_idx on public.bookmarks (post_id);

-- ---------------------------------------------------------------------------
-- Pass the book (recommendations) — parent_id chains form "book trails"
-- ---------------------------------------------------------------------------
create table public.recommendations (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references public.profiles (id) on delete cascade,
  recipient_id  uuid not null references public.profiles (id) on delete cascade,
  book_id       uuid not null references public.books (id) on delete cascade,
  message       text check (char_length(message) <= 1000),
  parent_id     uuid references public.recommendations (id) on delete set null,
  seen_at       timestamptz,
  created_at    timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create index recommendations_recipient_idx on public.recommendations (recipient_id, created_at desc);
create index recommendations_sender_idx on public.recommendations (sender_id);
create index recommendations_book_idx on public.recommendations (book_id);
create index recommendations_parent_idx on public.recommendations (parent_id);

-- ---------------------------------------------------------------------------
-- Notifications (written only by triggers)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id                 uuid primary key default gen_random_uuid(),
  recipient_id       uuid not null references public.profiles (id) on delete cascade,
  actor_id           uuid not null references public.profiles (id) on delete cascade,
  kind               public.notification_kind not null,
  post_id            uuid references public.posts (id) on delete cascade,
  comment_id         uuid references public.comments (id) on delete cascade,
  list_id            uuid references public.lists (id) on delete cascade,
  recommendation_id  uuid references public.recommendations (id) on delete cascade,
  read_at            timestamptz,
  created_at         timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;
create index notifications_actor_idx on public.notifications (actor_id);
create index notifications_post_idx on public.notifications (post_id);
create index notifications_comment_idx on public.notifications (comment_id);
create index notifications_list_idx on public.notifications (list_id);
create index notifications_rec_idx on public.notifications (recommendation_id);

-- ---------------------------------------------------------------------------
-- Counter + notification triggers
-- ---------------------------------------------------------------------------
create or replace function private.on_follow_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set followers_count = followers_count + 1 where id = new.following_id;
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    insert into public.notifications (recipient_id, actor_id, kind)
    values (new.following_id, new.follower_id, 'follow');
    return new;
  else
    update public.profiles set followers_count = greatest(followers_count - 1, 0) where id = old.following_id;
    update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
    return old;
  end if;
end $$;
create trigger follows_counters after insert or delete on public.follows
  for each row execute function private.on_follow_change();

create or replace function private.on_like_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
  if tg_op = 'INSERT' then
    update public.posts set likes_count = likes_count + 1 where id = new.post_id returning user_id into owner;
    if owner is not null and owner <> new.user_id then
      insert into public.notifications (recipient_id, actor_id, kind, post_id)
      values (owner, new.user_id, 'like', new.post_id);
    end if;
    return new;
  else
    update public.posts set likes_count = greatest(likes_count - 1, 0) where id = old.post_id;
    return old;
  end if;
end $$;
create trigger likes_counters after insert or delete on public.likes
  for each row execute function private.on_like_change();

create or replace function private.on_comment_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner uuid; parent_owner uuid;
begin
  if tg_op = 'INSERT' then
    update public.posts set comments_count = comments_count + 1 where id = new.post_id returning user_id into owner;
    if new.parent_id is not null then
      select user_id into parent_owner from public.comments where id = new.parent_id;
      if parent_owner is not null and parent_owner <> new.user_id then
        insert into public.notifications (recipient_id, actor_id, kind, post_id, comment_id)
        values (parent_owner, new.user_id, 'reply', new.post_id, new.id);
      end if;
    end if;
    if owner is not null and owner <> new.user_id and owner is distinct from parent_owner then
      insert into public.notifications (recipient_id, actor_id, kind, post_id, comment_id)
      values (owner, new.user_id, 'comment', new.post_id, new.id);
    end if;
    return new;
  else
    update public.posts set comments_count = greatest(comments_count - 1, 0) where id = old.post_id;
    return old;
  end if;
end $$;
create trigger comments_counters after insert or delete on public.comments
  for each row execute function private.on_comment_change();

create or replace function private.on_repost_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
  if tg_op = 'INSERT' then
    if new.repost_of_id is not null then
      update public.posts set reposts_count = reposts_count + 1 where id = new.repost_of_id returning user_id into owner;
      if owner is not null and owner <> new.user_id then
        insert into public.notifications (recipient_id, actor_id, kind, post_id)
        values (owner, new.user_id, 'repost', new.repost_of_id);
      end if;
    end if;
    return new;
  else
    if old.repost_of_id is not null then
      update public.posts set reposts_count = greatest(reposts_count - 1, 0) where id = old.repost_of_id;
    end if;
    return old;
  end if;
end $$;
create trigger posts_repost_counters after insert or delete on public.posts
  for each row execute function private.on_repost_change();

create or replace function private.on_list_follow_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
  if tg_op = 'INSERT' then
    update public.lists set followers_count = followers_count + 1 where id = new.list_id returning user_id into owner;
    if owner is not null and owner <> new.user_id then
      insert into public.notifications (recipient_id, actor_id, kind, list_id)
      values (owner, new.user_id, 'list_follow', new.list_id);
    end if;
    return new;
  else
    update public.lists set followers_count = greatest(followers_count - 1, 0) where id = old.list_id;
    return old;
  end if;
end $$;
create trigger list_follows_counters after insert or delete on public.list_follows
  for each row execute function private.on_list_follow_change();

create or replace function private.on_recommendation_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (recipient_id, actor_id, kind, recommendation_id)
  values (new.recipient_id, new.sender_id, 'recommendation', new.id);
  return new;
end $$;
create trigger recommendations_notify after insert on public.recommendations
  for each row execute function private.on_recommendation_insert();

-- ---------------------------------------------------------------------------
-- Aggregates & RPCs
-- ---------------------------------------------------------------------------
create view public.book_stats with (security_invoker = true) as
select
  b.id as book_id,
  round(avg(ub.rating), 2)                                   as avg_rating,
  count(ub.rating)::int                                      as ratings_count,
  count(*) filter (where ub.status = 'read')::int            as readers_count,
  count(*) filter (where ub.status = 'reading')::int         as reading_count,
  count(*) filter (where ub.status = 'want_to_read')::int    as want_count
from public.books b
left join public.user_books ub on ub.book_id = b.id
group by b.id;

-- Books with the most shelf activity recently.
create or replace function public.trending_books(p_limit int default 12, p_days int default 30)
returns setof public.books language sql stable set search_path = '' as $$
  select b.*
  from public.books b
  join (
    select book_id, count(*) as n
    from public.user_books
    where updated_at > now() - make_interval(days => p_days)
    group by book_id
  ) t on t.book_id = b.id
  order by t.n desc, b.title
  limit least(p_limit, 50);
$$;

-- Books most recently reviewed publicly.
create or replace function public.recently_reviewed_books(p_limit int default 12)
returns setof public.books language sql stable set search_path = '' as $$
  select b.*
  from public.books b
  join (
    select book_id, max(created_at) as last_at
    from public.reviews
    where visibility = 'public'
    group by book_id
  ) r on r.book_id = b.id
  order by r.last_at desc
  limit least(p_limit, 50);
$$;

-- Readers the caller does not follow, ranked by shared genres, then popularity.
create or replace function public.suggested_readers(p_limit int default 8)
returns setof public.profiles language sql stable set search_path = '' as $$
  with me as (
    select coalesce(favourite_genres, '{}') as genres from public.profiles where id = (select auth.uid())
  )
  select p.*
  from public.profiles p
  left join me on true
  where p.onboarded
    and p.id <> coalesce((select auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid)
    and not exists (
      select 1 from public.follows f
      where f.follower_id = (select auth.uid()) and f.following_id = p.id
    )
  order by
    cardinality(array(select unnest(p.favourite_genres) intersect select unnest(coalesce(me.genres, '{}')))) desc,
    p.followers_count desc,
    p.created_at desc
  limit least(p_limit, 50);
$$;

-- Public lists ranked by followers + likes on their post.
create or replace function public.popular_lists(p_limit int default 8)
returns setof public.lists language sql stable set search_path = '' as $$
  select l.*
  from public.lists l
  left join public.posts p on p.list_id = l.id
  where l.visibility = 'public'
    and exists (select 1 from public.list_books lb where lb.list_id = l.id)
  order by (l.followers_count * 2 + coalesce(p.likes_count, 0)) desc, l.updated_at desc
  limit least(p_limit, 50);
$$;

-- Reading compatibility between the caller and another reader (0–100).
-- Blends rating agreement on shared books with genre overlap.
create or replace function public.reading_compatibility(p_other uuid)
returns table (score int, shared_books int, shared_genres text[])
language sql stable set search_path = '' as $$
  with mine as (
    select book_id, rating from public.user_books
    where user_id = (select auth.uid()) and status in ('read', 'reading', 'dnf')
  ),
  theirs as (
    select book_id, rating from public.user_books
    where user_id = p_other and status in ('read', 'reading', 'dnf')
  ),
  shared as (
    select m.book_id, m.rating as a, t.rating as b from mine m join theirs t using (book_id)
  ),
  g as (
    select array(
      select unnest(a.favourite_genres) intersect select unnest(b.favourite_genres)
    ) as genres
    from public.profiles a, public.profiles b
    where a.id = (select auth.uid()) and b.id = p_other
  )
  select
    least(100, greatest(0, round(
      coalesce((select 60 * (1 - avg(abs(a - b)) / 4.5) from shared where a is not null and b is not null), 25)
      + least(25, (select count(*) from shared) * 5)
      + least(15, cardinality((select genres from g)) * 5)
    )))::int,
    (select count(*) from shared)::int,
    coalesce((select genres from g), '{}');
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.follows           enable row level security;
alter table public.books             enable row level security;
alter table public.user_books        enable row level security;
alter table public.reading_sessions  enable row level security;
alter table public.reviews           enable row level security;
alter table public.quotes            enable row level security;
alter table public.lists             enable row level security;
alter table public.list_books        enable row level security;
alter table public.list_follows      enable row level security;
alter table public.posts             enable row level security;
alter table public.comments          enable row level security;
alter table public.likes             enable row level security;
alter table public.bookmarks         enable row level security;
alter table public.recommendations   enable row level security;
alter table public.notifications     enable row level security;

-- profiles: public directory, self-managed
create policy "profiles are public" on public.profiles for select using (true);
create policy "update own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- follows: graph is public, you manage your own edges
create policy "follows are public" on public.follows for select using (true);
create policy "follow as yourself" on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()));
create policy "unfollow as yourself" on public.follows for delete to authenticated
  using (follower_id = (select auth.uid()));

-- books: shared catalogue, any signed-in reader can add a missing book
create policy "books are public" on public.books for select using (true);
create policy "signed-in readers add books" on public.books for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "creators enrich books" on public.books for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

-- user_books: shelves are public, owner writes
create policy "shelves are public" on public.user_books for select using (true);
create policy "manage own shelves" on public.user_books for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- reading_sessions: the diary is personal
create policy "read own diary" on public.reading_sessions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "manage own diary" on public.reading_sessions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- reviews / quotes / lists: visibility aware
create policy "view permitted reviews" on public.reviews for select
  using (private.can_view(user_id, visibility));
create policy "manage own reviews" on public.reviews for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "view permitted quotes" on public.quotes for select
  using (private.can_view(user_id, visibility));
create policy "manage own quotes" on public.quotes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "view permitted lists" on public.lists for select
  using (private.can_view(user_id, visibility));
create policy "manage own lists" on public.lists for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "view books of permitted lists" on public.list_books for select
  using (exists (select 1 from public.lists l where l.id = list_id));
create policy "manage books of own lists" on public.list_books for all to authenticated
  using (exists (select 1 from public.lists l where l.id = list_id and l.user_id = (select auth.uid())))
  with check (exists (select 1 from public.lists l where l.id = list_id and l.user_id = (select auth.uid())));

create policy "list follows are public" on public.list_follows for select using (true);
create policy "follow permitted lists" on public.list_follows for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.lists l where l.id = list_id));
create policy "unfollow lists" on public.list_follows for delete to authenticated
  using (user_id = (select auth.uid()));

-- posts
create policy "view permitted posts" on public.posts for select
  using (private.can_view(user_id, visibility));
create policy "create own posts" on public.posts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (repost_of_id is null or exists (select 1 from public.posts o where o.id = repost_of_id and o.visibility = 'public'))
  );
create policy "edit own posts" on public.posts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete own posts" on public.posts for delete to authenticated
  using (user_id = (select auth.uid()));

-- comments: visible when the post is visible
create policy "view comments on permitted posts" on public.comments for select
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "comment on permitted posts" on public.comments for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
create policy "edit own comments" on public.comments for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete own comments or on own posts" on public.comments for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.posts p where p.id = post_id and p.user_id = (select auth.uid()))
  );

-- likes: visible when the post is visible
create policy "view likes on permitted posts" on public.likes for select
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "like permitted posts" on public.likes for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
create policy "unlike" on public.likes for delete to authenticated
  using (user_id = (select auth.uid()));

-- bookmarks: private to their owner
create policy "own bookmarks" on public.bookmarks for select to authenticated
  using (user_id = (select auth.uid()));
create policy "bookmark permitted posts" on public.bookmarks for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
create policy "remove bookmark" on public.bookmarks for delete to authenticated
  using (user_id = (select auth.uid()));

-- recommendations: sender and recipient only
create policy "see own passes" on public.recommendations for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));
create policy "pass a book" on public.recommendations for insert to authenticated
  with check (sender_id = (select auth.uid()));
create policy "recipient marks seen" on public.recommendations for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));

-- notifications: recipient reads / marks read; inserts happen in triggers only
create policy "read own notifications" on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy "mark own notifications read" on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));

-- Column-level hardening: counters and ownership are never client-writable.
revoke update on public.profiles from anon, authenticated;
grant update (username, display_name, bio, avatar_url, cover_url, pronouns, location, website,
              accent, profile_motif, favourite_genres, favourite_authors, reading_goal, onboarded)
  on public.profiles to authenticated;
revoke update on public.posts from anon, authenticated;
grant update (body, progress_pages, progress_percent, visibility) on public.posts to authenticated;
revoke update on public.lists from anon, authenticated;
grant update (title, description, cover_style, cover_image_url, visibility, is_ranked)
  on public.lists to authenticated;

-- Policies call private.can_view, so the API roles need to reach it (the schema itself is not exposed).
grant usage on schema private to anon, authenticated;
grant execute on function private.can_view(uuid, public.visibility) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: avatars, profile covers, list images
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "media is public" on storage.objects for select
  using (bucket_id = 'media');
create policy "upload into own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "replace own media" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "delete own media" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
