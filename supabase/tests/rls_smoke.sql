-- RLS smoke test. Run against a database with the migrations applied:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_smoke.sql
-- Everything runs in a transaction and is rolled back.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.dev'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.dev'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.dev');
update public.profiles set username = 'reader_' || right(id::text, 1), onboarded = true;

insert into public.books (id, slug, title, authors) values ('10000000-0000-0000-0000-000000000001', 'piranesi', 'Piranesi', '{Susanna Clarke}');

create or replace function pg_temp.act_as(u text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', u, true), set_config('role', 'authenticated', true);
$$;
create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAILED: %', label; end if;
  raise notice 'ok: %', label;
end $$;

-- a follows b
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.follows (follower_id, following_id) values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');

-- b writes one public review, one followers-only quote, one private list
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
insert into public.reviews (id, user_id, book_id, body, visibility) values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', 'Lovely', 'public');
insert into public.posts (id, user_id, kind, book_id, review_id) values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'review', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001');
insert into public.quotes (id, user_id, book_id, body, visibility) values ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', 'The Beauty of the House', 'followers');
insert into public.lists (id, user_id, title, visibility) values ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000b', 'Secret list', 'private');
insert into public.list_books (list_id, book_id, position) values ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 0);
insert into public.reading_sessions (user_id, book_id, status) values ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', 'reading');
select pg_temp.check((select count(*) from public.lists) = 1, 'owner sees own private list');

-- c: a stranger
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) from public.reviews) = 1, 'stranger sees public review');
select pg_temp.check((select count(*) from public.quotes) = 0, 'stranger cannot see followers-only quote');
select pg_temp.check((select count(*) from public.lists) = 0, 'stranger cannot see private list');
select pg_temp.check((select count(*) from public.list_books) = 0, 'stranger cannot see private list books');
select pg_temp.check((select count(*) from public.reading_sessions) = 0, 'diary is private');
insert into public.likes (user_id, post_id) values ('00000000-0000-0000-0000-00000000000c', '30000000-0000-0000-0000-000000000001');
insert into public.comments (post_id, user_id, body) values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'Agree!');

do $$ begin
  begin
    insert into public.posts (user_id, kind, body) values ('00000000-0000-0000-0000-00000000000b', 'update', 'impersonation');
    raise exception 'FAILED: could post as someone else';
  exception when insufficient_privilege then raise notice 'ok: cannot post as someone else';
  end;
  begin
    update public.profiles set followers_count = 9999 where id = '00000000-0000-0000-0000-00000000000c';
    raise exception 'FAILED: counters writable';
  exception when insufficient_privilege then raise notice 'ok: counters are not client-writable';
  end;
end $$;
update public.profiles set bio = 'hacked' where id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select bio from public.profiles where id = '00000000-0000-0000-0000-00000000000b') = '', 'cannot edit another profile');
select pg_temp.check((select count(*) from public.notifications) = 0, 'cannot read others'' notifications');

-- a: a follower
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) from public.quotes) = 1, 'follower sees followers-only quote');
select pg_temp.check((select count(*) from public.lists) = 0, 'follower cannot see private list');
select pg_temp.check((select score from public.reading_compatibility('00000000-0000-0000-0000-00000000000b')) between 0 and 100, 'compatibility rpc');
select pg_temp.check((select count(*) from public.suggested_readers(5)) >= 1, 'suggested readers rpc');

-- b: counters and notifications
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select likes_count from public.posts where id = '30000000-0000-0000-0000-000000000001') = 1, 'like counter');
select pg_temp.check((select comments_count from public.posts where id = '30000000-0000-0000-0000-000000000001') = 1, 'comment counter');
select pg_temp.check((select followers_count from public.profiles where id = '00000000-0000-0000-0000-00000000000b') = 1, 'follower counter');
select pg_temp.check((select count(*) from public.notifications) = 3, 'follow + like + comment notifications');
update public.reviews set visibility = 'private' where id = '20000000-0000-0000-0000-000000000001';
select pg_temp.check((select visibility from public.posts where id = '30000000-0000-0000-0000-000000000001') = 'private', 'post visibility follows its review');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) from public.posts) = 0, 'private review post now hidden');
select pg_temp.check((select count(*) from public.comments) = 0, 'comments hidden with their post');

-- marginalia: drafts, highlights, tags
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
insert into public.quotes (id, user_id, book_id, body, visibility, is_draft, highlight, tags)
  values ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', 'Draft passage', 'public', true, 'lavender', '{house,tides}');
select pg_temp.check((select count(*) from public.quotes where is_draft) = 1, 'author sees own draft');
do $$ begin
  begin
    insert into public.posts (user_id, kind, book_id, quote_id) values ('00000000-0000-0000-0000-00000000000b', 'quote', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004');
    raise exception 'FAILED: a draft got a post';
  exception when check_violation then raise notice 'ok: drafts cannot be posted';
  end;
  begin
    update public.quotes set tags = '{Shouting}' where id = '20000000-0000-0000-0000-000000000004';
    raise exception 'FAILED: invalid tag accepted';
  exception when check_violation then raise notice 'ok: tags are validated';
  end;
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) from public.quotes where id = '20000000-0000-0000-0000-000000000004') = 0, 'follower cannot see a public draft');
update public.quotes set body = 'vandalised' where id = '20000000-0000-0000-0000-000000000002';
select pg_temp.check((select body from public.quotes where id = '20000000-0000-0000-0000-000000000002') = 'The Beauty of the House', 'cannot edit another reader''s annotation');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
update public.quotes set is_draft = false where id = '20000000-0000-0000-0000-000000000004';
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) from public.quotes where id = '20000000-0000-0000-0000-000000000004') = 1, 'published public annotation is visible to everyone');

rollback;
