-- ---------------------------------------------------------------------------
-- Hardening: production security and data integrity.
--
--  1. The shared book catalogue is written only by the server (service role).
--  2. URL columns are HTTPS-only, and image columns accept only our storage / known hosts.
--  3. The media bucket only takes small raster images, in the uploader's own folder.
--  4. Fields that identify ownership or what something belongs to can't be changed after creation.
--  5. Blocking, muting and reporting, enforced by RLS; rate limits on social writes;
--     no duplicate like / follow / repost / list-follow notifications.
--  6. Shelf moves are one atomic function (with an undo), and never post on their own.
--  7. Feeds come from database functions that join `follows`, so they scale with follow count.
--
-- Additive and backwards compatible. New CHECK constraints are added NOT VALID (enforced for
-- every new write) and then validated when existing rows allow it, so no existing data is
-- rewritten or deleted — except exact-duplicate notifications (derived data), see section 5.
--
-- Rollback: every object here is new or replaced; to roll back, restore the previous
-- definitions from 20261104000000_init.sql / 20261106000000_marginalia.sql and drop the new
-- tables (blocks, mutes, reports) and functions. No column is dropped by this migration.
-- ---------------------------------------------------------------------------

-- Validate a constraint added NOT VALID, unless existing rows break it (then it still guards new writes).
create or replace function private.try_validate(p_table regclass, p_constraint text)
returns void language plpgsql set search_path = '' as $$
begin
  execute format('alter table %s validate constraint %I', p_table, p_constraint);
exception when check_violation then
  raise notice 'Existing rows in % violate %; it applies to new writes only.', p_table, p_constraint;
end $$;

-- ===========================================================================
-- 1. Catalogue writes go through the server only
-- ===========================================================================
-- Readers used to insert books directly, and whoever added a book could later rewrite its
-- title or cover for everyone. The server now creates books from Open Library with the
-- service role (which bypasses RLS); the API roles can only read.
drop policy if exists "signed-in readers add books" on public.books;
drop policy if exists "creators enrich books" on public.books;
revoke insert, update, delete on public.books from anon, authenticated;

alter table public.books
  add constraint books_cover_host check (
    cover_url is null or cover_url ~ '^https://covers\.openlibrary\.org/b/(id|isbn|olid)/[A-Za-z0-9-]+\.jpg(\?default=false)?$'
  ) not valid,
  add constraint books_tags_bounded check (cardinality(genres) <= 8 and cardinality(moods) <= 8) not valid,
  add constraint books_authors_bounded check (cardinality(authors) <= 8) not valid;
select private.try_validate('public.books', 'books_cover_host');
select private.try_validate('public.books', 'books_tags_bounded');
select private.try_validate('public.books', 'books_authors_bounded');

-- ===========================================================================
-- 2. URL columns
-- ===========================================================================
create or replace function private.is_https_url(u text)
returns boolean language sql immutable set search_path = '' as $$
  select char_length(u) <= 500 and u ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:[0-9]+)?([/?#][^[:space:]]*)?$'
$$;

-- Files uploaded to our public `media` bucket (any Supabase project host).
create or replace function private.is_media_url(u text)
returns boolean language sql immutable set search_path = '' as $$
  select char_length(u) <= 500
     and u ~ '^https://[A-Za-z0-9-]+\.supabase\.co/storage/v1/object/public/media/[0-9a-f-]{36}/[A-Za-z0-9._-]+$'
$$;

-- Avatars may also be the Google profile photo copied at sign-up.
create or replace function private.is_avatar_url(u text)
returns boolean language sql immutable set search_path = '' as $$
  select private.is_media_url(u) or (char_length(u) <= 500 and u ~ '^https://lh3\.googleusercontent\.com/[A-Za-z0-9/_=.-]+$')
$$;

alter table public.profiles
  add constraint profiles_avatar_url_valid check (avatar_url is null or private.is_avatar_url(avatar_url)) not valid,
  add constraint profiles_cover_url_valid check (cover_url is null or private.is_media_url(cover_url)) not valid,
  add constraint profiles_website_valid check (website is null or private.is_https_url(website)) not valid;
alter table public.lists
  add constraint lists_cover_image_valid check (cover_image_url is null or private.is_media_url(cover_image_url)) not valid;
alter table public.list_books
  add constraint list_books_image_valid check (image_url is null or private.is_media_url(image_url)) not valid;
select private.try_validate('public.profiles', 'profiles_avatar_url_valid');
select private.try_validate('public.profiles', 'profiles_cover_url_valid');
select private.try_validate('public.profiles', 'profiles_website_valid');
select private.try_validate('public.lists', 'lists_cover_image_valid');
select private.try_validate('public.list_books', 'list_books_image_valid');

-- Sign-up copies the provider's photo only if it is one we accept, so a new constraint can never block sign-up.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare avatar text := new.raw_user_meta_data ->> 'avatar_url';
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 60),
    case when avatar is not null and private.is_avatar_url(avatar) then avatar end
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ===========================================================================
-- 3. Storage: small raster images, in your own folder
-- ===========================================================================
-- The bucket limits are enforced by Supabase Storage on every upload, including direct API calls.
update storage.buckets
set file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'media';

create or replace function private.is_own_media_path(p_name text)
returns boolean language sql stable set search_path = '' as $$
  select array_length(storage.foldername(p_name), 1) = 1
     and (storage.foldername(p_name))[1] = (select auth.uid())::text
     and storage.extension(p_name) in ('jpg', 'jpeg', 'png', 'webp', 'gif')
$$;
grant execute on function private.is_own_media_path(text) to authenticated;

drop policy if exists "upload into own folder" on storage.objects;
drop policy if exists "replace own media" on storage.objects;
create policy "upload into own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and private.is_own_media_path(name));
create policy "replace own media" on storage.objects for update to authenticated
  using (bucket_id = 'media' and private.is_own_media_path(name))
  with check (bucket_id = 'media' and private.is_own_media_path(name));

-- ===========================================================================
-- 4. Immutable fields
-- ===========================================================================
-- Column grants: only these columns are writable through the API; everything else (owner,
-- sender, post, parent, book) is fixed at creation.
revoke update on public.recommendations from anon, authenticated;
grant update (seen_at) on public.recommendations to authenticated;

revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

revoke update on public.comments from anon, authenticated;
grant update (body) on public.comments to authenticated;
create trigger comments_touch before update on public.comments
  for each row execute function private.touch_updated_at();

revoke update on public.reviews from anon, authenticated;
grant update (rating, title, body, contains_spoilers, is_reread, visibility) on public.reviews to authenticated;

revoke update on public.quotes from anon, authenticated;
grant update (body, page, commentary, visibility, highlight, tags, is_draft) on public.quotes to authenticated;

-- Publishing a draft dates it to now (the moment it reaches feeds).
create or replace function private.on_quote_publish()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.is_draft and not new.is_draft then
    new.created_at := now();
  end if;
  return new;
end $$;
create trigger quotes_publish_date before update of is_draft on public.quotes
  for each row execute function private.on_quote_publish();

-- A post that carries a review, annotation or list belongs to that item's author, shows its
-- book, and always has its visibility (the parent's visibility trigger keeps them in step).
create or replace function private.post_follows_parent()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner uuid; vis public.visibility; book uuid;
begin
  if new.review_id is not null then
    select user_id, visibility, book_id into owner, vis, book from public.reviews where id = new.review_id;
  elsif new.quote_id is not null then
    select user_id, visibility, book_id into owner, vis, book from public.quotes where id = new.quote_id;
  elsif new.list_id is not null then
    select user_id, visibility, null into owner, vis, book from public.lists where id = new.list_id;
  else
    return new;
  end if;
  if owner is null or owner <> new.user_id then
    raise exception 'That post must belong to the author of what it shares' using errcode = '42501';
  end if;
  new.visibility := vis;
  if new.list_id is null then new.book_id := book; end if;
  return new;
end $$;
create trigger posts_follow_parent before insert or update of user_id, visibility, book_id, review_id, quote_id, list_id on public.posts
  for each row execute function private.post_follows_parent();

-- ===========================================================================
-- 5. Blocking, muting, reporting, rate limits, notification dedupe
-- ===========================================================================
create table public.blocks (
  blocker_id  uuid not null references public.profiles (id) on delete cascade,
  blocked_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

create table public.mutes (
  muter_id    uuid not null references public.profiles (id) on delete cascade,
  muted_id    uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (muter_id, muted_id),
  check (muter_id <> muted_id)
);

create type public.report_target as enum ('profile', 'post', 'comment', 'review', 'quote', 'list');
create type public.report_reason as enum ('spam', 'harassment', 'hate', 'sexual', 'spoilers', 'other');

create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_type  public.report_target not null,
  target_id    uuid not null,
  reason       public.report_reason not null,
  details      text check (char_length(details) <= 1000),
  status       text not null default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at   timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index reports_open_idx on public.reports (created_at) where status = 'open';

alter table public.blocks  enable row level security;
alter table public.mutes   enable row level security;
alter table public.reports enable row level security;

-- Blocks are private to the blocker (the blocked reader is never told).
create policy "see own blocks" on public.blocks for select to authenticated using (blocker_id = (select auth.uid()));
create policy "block as yourself" on public.blocks for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy "unblock" on public.blocks for delete to authenticated using (blocker_id = (select auth.uid()));
create policy "see own mutes" on public.mutes for select to authenticated using (muter_id = (select auth.uid()));
create policy "mute as yourself" on public.mutes for insert to authenticated with check (muter_id = (select auth.uid()));
create policy "unmute" on public.mutes for delete to authenticated using (muter_id = (select auth.uid()));
-- Reporters see their own reports; moderators work through the service role.
create policy "see own reports" on public.reports for select to authenticated using (reporter_id = (select auth.uid()));
create policy "report as yourself" on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'open');
revoke update on public.blocks, public.mutes from anon, authenticated;
revoke update, delete on public.reports from anon, authenticated;
revoke all on public.blocks, public.mutes, public.reports from anon;

-- Either reader has blocked the other. Definer: the blocked side can't read the block row itself.
create or replace function private.blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select a is not null and b is not null and exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;
grant execute on function private.blocked_between(uuid, uuid) to anon, authenticated;

-- Visibility now also hides everything between readers who have blocked each other.
create or replace function private.can_view(owner uuid, vis public.visibility)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    owner = (select auth.uid())
    or (
      not private.blocked_between(owner, (select auth.uid()))
      and (
        vis = 'public'
        or (
          vis = 'followers'
          and exists (
            select 1 from public.follows f
            where f.follower_id = (select auth.uid()) and f.following_id = owner
          )
        )
      )
    );
$$;

-- Shelves: hidden between blocked readers.
drop policy "shelves are public" on public.user_books;
create policy "shelves are public" on public.user_books for select
  using (not private.blocked_between(user_id, (select auth.uid())));

-- Follows: no following across a block (and a block removes existing follows both ways).
drop policy "follow as yourself" on public.follows;
create policy "follow as yourself" on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()) and not private.blocked_between(follower_id, following_id));

create or replace function private.on_block()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and following_id = new.blocked_id)
     or (follower_id = new.blocked_id and following_id = new.blocker_id);
  delete from public.list_follows lf using public.lists l
  where lf.list_id = l.id
    and ((lf.user_id = new.blocked_id and l.user_id = new.blocker_id) or (lf.user_id = new.blocker_id and l.user_id = new.blocked_id));
  return new;
end $$;
create trigger blocks_cleanup after insert on public.blocks
  for each row execute function private.on_block();

-- Comments: hidden from / closed to blocked readers, including replies to their comments.
-- (A definer helper: a comments policy can't query comments itself without recursing.)
create or replace function private.can_reply_to(p_parent uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select not private.blocked_between(c.user_id, (select auth.uid())) from public.comments c where c.id = p_parent),
    false
  )
$$;
grant execute on function private.can_reply_to(uuid) to authenticated;

drop policy "view comments on permitted posts" on public.comments;
create policy "view comments on permitted posts" on public.comments for select
  using (
    exists (select 1 from public.posts p where p.id = post_id)
    and not private.blocked_between(user_id, (select auth.uid()))
  );
drop policy "comment on permitted posts" on public.comments;
create policy "comment on permitted posts" on public.comments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = post_id)
    and (parent_id is null or private.can_reply_to(parent_id))
  );

-- Passing a book: never to someone you've blocked or who blocked you.
drop policy "pass a book" on public.recommendations;
create policy "pass a book" on public.recommendations for insert to authenticated
  with check (sender_id = (select auth.uid()) and not private.blocked_between(sender_id, recipient_id));

-- Notifications from a blocked reader stop showing.
drop policy "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()) and not private.blocked_between(actor_id, recipient_id));

-- Rate limits ---------------------------------------------------------------
-- Generous for people, tight for scripts. Raised as SQLSTATE DG429 so the app can say so plainly.
create or replace function private.rate_limit(p_recent bigint, p_max int, p_what text)
returns void language plpgsql set search_path = '' as $$
begin
  if p_recent >= p_max then
    raise exception 'Too many % in a short time. Try again in a little while.', p_what using errcode = 'DG429';
  end if;
end $$;

create index if not exists comments_user_created_idx on public.comments (user_id, created_at desc);
create index if not exists recommendations_sender_created_idx on public.recommendations (sender_id, created_at desc);
create index if not exists follows_follower_created_idx on public.follows (follower_id, created_at desc);
create index if not exists reports_reporter_created_idx on public.reports (reporter_id, created_at desc);

create or replace function private.limit_comments() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.rate_limit((select count(*) from public.comments where user_id = new.user_id and created_at > now() - interval '5 minutes'), 20, 'comments');
  return new;
end $$;
create trigger comments_rate_limit before insert on public.comments for each row execute function private.limit_comments();

create or replace function private.limit_recommendations() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.rate_limit((select count(*) from public.recommendations where sender_id = new.sender_id and created_at > now() - interval '1 hour'), 20, 'books passed on');
  perform private.rate_limit((select count(*) from public.recommendations where sender_id = new.sender_id and recipient_id = new.recipient_id and created_at > now() - interval '1 day'), 5, 'books passed to one reader');
  return new;
end $$;
create trigger recommendations_rate_limit before insert on public.recommendations for each row execute function private.limit_recommendations();

create or replace function private.limit_follows() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.rate_limit((select count(*) from public.follows where follower_id = new.follower_id and created_at > now() - interval '1 hour'), 200, 'follows');
  return new;
end $$;
create trigger follows_rate_limit before insert on public.follows for each row execute function private.limit_follows();

create or replace function private.limit_reports() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.rate_limit((select count(*) from public.reports where reporter_id = new.reporter_id and created_at > now() - interval '1 day'), 20, 'reports');
  return new;
end $$;
create trigger reports_rate_limit before insert on public.reports for each row execute function private.limit_reports();

create or replace function private.limit_posts() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.kind in ('update', 'started', 'finished', 'recommendation') then
    perform private.rate_limit((select count(*) from public.posts where user_id = new.user_id and kind = new.kind and created_at > now() - interval '1 hour'), 60, 'posts');
  end if;
  return new;
end $$;
create trigger posts_rate_limit before insert on public.posts for each row execute function private.limit_posts();

-- Notification dedupe -------------------------------------------------------
-- One notification per (actor, thing) for likes, follows, reposts and list follows: liking,
-- unliking and liking again doesn't ping the author three times. Existing exact duplicates
-- (same recipient, actor, kind and target) are removed first, keeping the earliest.
delete from public.notifications n
using public.notifications keep
where n.kind in ('like', 'follow', 'repost', 'list_follow')
  and keep.kind = n.kind
  and keep.recipient_id = n.recipient_id
  and keep.actor_id = n.actor_id
  and keep.post_id is not distinct from n.post_id
  and keep.list_id is not distinct from n.list_id
  and (keep.created_at, keep.id) < (n.created_at, n.id);

create unique index notifications_once_idx
  on public.notifications (recipient_id, actor_id, kind, post_id, list_id) nulls not distinct
  where kind in ('like', 'follow', 'repost', 'list_follow');

create or replace function private.notify_once(p_recipient uuid, p_actor uuid, p_kind public.notification_kind, p_post uuid, p_list uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (recipient_id, actor_id, kind, post_id, list_id)
  select p_recipient, p_actor, p_kind, p_post, p_list
  where p_recipient is not null and p_recipient <> p_actor
  on conflict (recipient_id, actor_id, kind, post_id, list_id) where kind in ('like', 'follow', 'repost', 'list_follow') do nothing
$$;

create or replace function private.on_follow_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set followers_count = followers_count + 1 where id = new.following_id;
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    perform private.notify_once(new.following_id, new.follower_id, 'follow', null, null);
    return new;
  else
    update public.profiles set followers_count = greatest(followers_count - 1, 0) where id = old.following_id;
    update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
    return old;
  end if;
end $$;

create or replace function private.on_like_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
  if tg_op = 'INSERT' then
    update public.posts set likes_count = likes_count + 1 where id = new.post_id returning user_id into owner;
    perform private.notify_once(owner, new.user_id, 'like', new.post_id, null);
    return new;
  else
    update public.posts set likes_count = greatest(likes_count - 1, 0) where id = old.post_id;
    return old;
  end if;
end $$;

create or replace function private.on_repost_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
  if tg_op = 'INSERT' then
    if new.repost_of_id is not null then
      update public.posts set reposts_count = reposts_count + 1 where id = new.repost_of_id returning user_id into owner;
      perform private.notify_once(owner, new.user_id, 'repost', new.repost_of_id, null);
    end if;
    return new;
  else
    if old.repost_of_id is not null then
      update public.posts set reposts_count = greatest(reposts_count - 1, 0) where id = old.repost_of_id;
    end if;
    return old;
  end if;
end $$;

create or replace function private.on_list_follow_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
  if tg_op = 'INSERT' then
    update public.lists set followers_count = followers_count + 1 where id = new.list_id returning user_id into owner;
    perform private.notify_once(owner, new.user_id, 'list_follow', null, new.list_id);
    return new;
  else
    update public.lists set followers_count = greatest(followers_count - 1, 0) where id = old.list_id;
    return old;
  end if;
end $$;

-- ===========================================================================
-- 6. Shelf moves: atomic, private by default, undoable
-- ===========================================================================
-- One transaction for the shelf entry, the reading diary and (only if asked) a feed post.
-- Returns the undo record the app keeps for a few minutes: undo_shelf_move puts back exactly
-- what this move changed. Runs as the caller, so RLS confines it to their own rows.
create or replace function public.set_shelf_status(
  p_book_id uuid,
  p_status public.shelf_status,
  p_reread boolean default false,
  p_share boolean default false,
  p_visibility public.visibility default 'public',
  p_date date default null
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  today date := coalesce(p_date, current_date);
  prev public.user_books;
  open_s public.reading_sessions;
  last_done public.reading_sessions;
  new_id uuid;
  post_id uuid;
  created uuid[] := '{}';
  changed jsonb := '[]';
  deleted jsonb := '[]';
  posts uuid[] := '{}';
  next_started date;
  next_finished date;
  row_deleted boolean := false;
begin
  if me is null then
    raise exception 'Sign in to change your shelves' using errcode = '42501';
  end if;
  if not exists (select 1 from public.books where id = p_book_id) then
    raise exception 'Book not found' using errcode = 'P0002';
  end if;
  if today > current_date + 1 then
    raise exception 'That date is in the future' using errcode = '22023';
  end if;

  select * into prev from public.user_books where user_id = me and book_id = p_book_id for update;
  if (prev.id is not null and prev.status is not distinct from p_status) or (prev.id is null and p_status is null) then
    return jsonb_build_object('changed', false);
  end if;

  select * into open_s from public.reading_sessions
  where user_id = me and book_id = p_book_id and status = 'reading'
  order by created_at desc limit 1;

  next_started := prev.started_at;
  next_finished := prev.finished_at;

  if p_status = 'reading' then
    if prev.status = 'read' and not p_reread then
      -- "Not finished after all": reopen the latest finished read instead of starting a new one.
      select * into last_done from public.reading_sessions
      where user_id = me and book_id = p_book_id and status = 'finished'
      order by finished_on desc nulls last, created_at desc limit 1;
      if found then
        changed := changed || jsonb_build_array(to_jsonb(last_done));
        update public.reading_sessions set status = 'reading', finished_on = null where id = last_done.id;
      else
        insert into public.reading_sessions (user_id, book_id, status, started_on)
        values (me, p_book_id, 'reading', today) returning id into new_id;
        created := created || new_id;
      end if;
      next_finished := null;
    elsif open_s.id is null then
      insert into public.reading_sessions (user_id, book_id, status, started_on, is_reread)
      values (me, p_book_id, 'reading', today, p_reread) returning id into new_id;
      created := created || new_id;
      next_started := today;
      next_finished := null;
    end if;
    if p_share then
      insert into public.posts (user_id, kind, book_id, visibility) values (me, 'started', p_book_id, p_visibility) returning id into post_id;
      posts := posts || post_id;
    end if;

  elsif p_status = 'read' then
    if open_s.id is not null then
      changed := changed || jsonb_build_array(to_jsonb(open_s));
      update public.reading_sessions set status = 'finished', finished_on = greatest(today, coalesce(started_on, today)) where id = open_s.id;
    elsif not exists (
      -- Dragging a book away and back the same day isn't a second read.
      select 1 from public.reading_sessions
      where user_id = me and book_id = p_book_id and status = 'finished' and finished_on = today
    ) then
      insert into public.reading_sessions (user_id, book_id, status, finished_on, is_reread)
      values (me, p_book_id, 'finished', today, p_reread) returning id into new_id;
      created := created || new_id;
    end if;
    next_finished := today;
    if p_share then
      insert into public.posts (user_id, kind, book_id, visibility) values (me, 'finished', p_book_id, p_visibility) returning id into post_id;
      posts := posts || post_id;
    end if;

  elsif p_status = 'dnf' then
    if open_s.id is not null then
      changed := changed || jsonb_build_array(to_jsonb(open_s));
      update public.reading_sessions set status = 'abandoned', finished_on = greatest(today, coalesce(started_on, today)) where id = open_s.id;
    end if;

  else -- want_to_read, or off the shelves
    if open_s.id is not null then
      if open_s.started_on = today and open_s.notes is null then
        -- Started and put back the same day: it never really began.
        deleted := deleted || jsonb_build_array(to_jsonb(open_s));
        delete from public.reading_sessions where id = open_s.id;
      else
        changed := changed || jsonb_build_array(to_jsonb(open_s));
        update public.reading_sessions set status = 'abandoned', finished_on = today where id = open_s.id;
      end if;
    end if;
    if prev.status = 'reading' then
      next_started := null;
    end if;
  end if;

  if p_status is null and prev.id is not null and not prev.is_favourite and prev.rating is null
     and cardinality(prev.shelves) = 0 and prev.progress_pages is null then
    delete from public.user_books where id = prev.id;
    row_deleted := true;
  elsif prev.id is null then
    insert into public.user_books (user_id, book_id, status, started_at, finished_at)
    values (me, p_book_id, p_status, next_started, next_finished);
  else
    update public.user_books set status = p_status, started_at = next_started, finished_at = next_finished where id = prev.id;
  end if;

  return jsonb_build_object(
    'changed', true,
    'removed', row_deleted,
    'undo', jsonb_build_object(
      'book_id', p_book_id,
      'at', now(),
      'prev', case when prev.id is null then null else to_jsonb(prev) end,
      'sessions_created', to_jsonb(created),
      'sessions_changed', changed,
      'sessions_deleted', deleted,
      'posts_created', to_jsonb(posts)
    )
  );
end $$;

-- Put a shelf move back, within 15 minutes. Only ever touches the caller's own rows (RLS).
create or replace function public.undo_shelf_move(p_undo jsonb)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  book uuid := (p_undo ->> 'book_id')::uuid;
  prev jsonb := p_undo -> 'prev';
  s jsonb;
begin
  if me is null then
    raise exception 'Sign in to change your shelves' using errcode = '42501';
  end if;
  if (p_undo ->> 'at')::timestamptz < now() - interval '15 minutes' then
    raise exception 'That move is too old to undo' using errcode = '22023';
  end if;

  delete from public.posts where user_id = me and id in (select (jsonb_array_elements_text(coalesce(p_undo -> 'posts_created', '[]'))::uuid));
  delete from public.reading_sessions
  where user_id = me and book_id = book and id in (select (jsonb_array_elements_text(coalesce(p_undo -> 'sessions_created', '[]'))::uuid));
  for s in select * from jsonb_array_elements(coalesce(p_undo -> 'sessions_changed', '[]')) loop
    update public.reading_sessions
    set status = (s ->> 'status')::public.session_status,
        started_on = (s ->> 'started_on')::date,
        finished_on = (s ->> 'finished_on')::date
    where id = (s ->> 'id')::uuid and user_id = me and book_id = book;
  end loop;
  for s in select * from jsonb_array_elements(coalesce(p_undo -> 'sessions_deleted', '[]')) loop
    insert into public.reading_sessions (id, user_id, book_id, status, started_on, finished_on, is_reread, notes, created_at)
    values ((s ->> 'id')::uuid, me, book, (s ->> 'status')::public.session_status, (s ->> 'started_on')::date,
            (s ->> 'finished_on')::date, coalesce((s ->> 'is_reread')::boolean, false), s ->> 'notes', (s ->> 'created_at')::timestamptz)
    on conflict (id) do nothing;
  end loop;

  if prev is null or jsonb_typeof(prev) = 'null' then
    delete from public.user_books where user_id = me and book_id = book;
  else
    insert into public.user_books (user_id, book_id, status, started_at, finished_at)
    values (me, book, (prev ->> 'status')::public.shelf_status, (prev ->> 'started_at')::date, (prev ->> 'finished_at')::date)
    on conflict (user_id, book_id) do update
    set status = excluded.status, started_at = excluded.started_at, finished_at = excluded.finished_at;
  end if;
end $$;

revoke execute on function public.set_shelf_status(uuid, public.shelf_status, boolean, boolean, public.visibility, date) from anon;
revoke execute on function public.undo_shelf_move(jsonb) from anon;

-- ===========================================================================
-- 7. Feeds from the database
-- ===========================================================================
-- Posts by the caller and the readers they follow. Plain SQL (no SET clause) so Postgres can
-- inline it: PostgREST's filters, cursor, order and limit then run as one indexed query, and
-- RLS on posts still applies. Muted and blocked readers are left out.
create or replace function public.following_posts()
returns setof public.posts
language sql stable security invoker as $$
  select p.* from public.posts p
  where (
      p.user_id = (select auth.uid())
      or exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.following_id = p.user_id)
    )
    and not exists (select 1 from public.mutes m where m.muter_id = (select auth.uid()) and m.muted_id = p.user_id)
$$;

-- Public posts from everyone else, minus muted readers (blocked ones are already invisible).
create or replace function public.discover_posts()
returns setof public.posts
language sql stable security invoker as $$
  select p.* from public.posts p
  where p.visibility = 'public'
    and p.user_id is distinct from (select auth.uid())
    and not exists (select 1 from public.mutes m where m.muter_id = (select auth.uid()) and m.muted_id = p.user_id)
$$;

-- Public posts including the caller's own (Marginalia's Popular / Recent).
create or replace function public.public_posts()
returns setof public.posts
language sql stable security invoker as $$
  select p.* from public.posts p
  where p.visibility = 'public'
    and not exists (select 1 from public.mutes m where m.muter_id = (select auth.uid()) and m.muted_id = p.user_id)
$$;

-- Suggestions never include readers you've blocked or who blocked you.
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
    and not private.blocked_between(p.id, (select auth.uid()))
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
