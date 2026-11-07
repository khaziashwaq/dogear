-- ---------------------------------------------------------------------------
-- Marginalia: annotations.
--
-- dogear. already had quotes — a passage, a page, a note in the margin, a
-- visibility, and (like every shareable thing) exactly one post, which is where
-- likes, comments, replies, bookmarks and reposts live with their RLS, counters
-- and notifications. Annotations are those quotes, grown up: a highlight colour,
-- tags, drafts and an edited timestamp. No parallel likes/comments/bookmarks
-- tables, so there is still one social layer.
--
-- Existing quotes keep working unchanged: they become published, butter-yellow
-- annotations with no tags.
-- ---------------------------------------------------------------------------

create type public.highlight_colour as enum ('butter', 'sage', 'rose', 'lavender', 'blue');

-- Tags are short, lower-case and few.
create or replace function private.tags_valid(tags text[])
returns boolean language sql immutable set search_path = '' as $$
  select cardinality(tags) <= 8
     and coalesce(bool_and(char_length(t) between 1 and 32 and t = lower(t)), true)
  from unnest(tags) as t
$$;

alter table public.quotes
  add column highlight  public.highlight_colour not null default 'butter',
  add column tags       text[] not null default '{}',
  add column is_draft   boolean not null default false,
  add column updated_at timestamptz not null default now();

alter table public.quotes add constraint quotes_tags_valid check (private.tags_valid(tags));

create trigger quotes_touch before update on public.quotes
  for each row execute function private.touch_updated_at();

-- Tag filters, and the published-only listings.
create index quotes_tags_idx on public.quotes using gin (tags);
create index quotes_published_idx on public.quotes (created_at desc) where not is_draft;
-- "Popular" on the Marginalia page ranks quote posts by likes.
create index posts_quote_popular_idx on public.posts (likes_count desc, created_at desc) where kind = 'quote';

-- Drafts are their author's alone, whatever visibility they will eventually have.
drop policy "view permitted quotes" on public.quotes;
create policy "view permitted quotes" on public.quotes for select
  using (
    user_id = (select auth.uid())
    or (not is_draft and private.can_view(user_id, visibility))
  );

-- A draft never has a post (so it can't reach a feed, be liked or commented on);
-- publishing creates the post. Enforced here as well as in the app.
create or replace function private.no_posts_for_drafts()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.quote_id is not null and exists (select 1 from public.quotes q where q.id = new.quote_id and q.is_draft) then
    raise exception 'Publish the annotation before sharing it' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger posts_no_drafts before insert or update of quote_id on public.posts
  for each row execute function private.no_posts_for_drafts();

-- Once published (it has a post, with likes and comments), an annotation can't go back to being a draft.
create or replace function private.no_unpublishing()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_draft and not old.is_draft then
    raise exception 'A published annotation can''t become a draft again' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger quotes_no_unpublishing before update of is_draft on public.quotes
  for each row execute function private.no_unpublishing();
