-- Crew Book upgrade 2: linked logins, private staff files, invite-only sign-ups,
-- edit-your-own-entries window, history/certs/notes data, tighter function permissions.
-- Safe to run more than once.

-- 1. New columns and tables ---------------------------------------------------
alter table public.docs add column if not exists created_at timestamptz not null default now();
create index if not exists docs_collection_created_idx on public.docs (collection, created_at desc);
alter table public.profiles add column if not exists barista_id text;

create table if not exists public.invites (
  email text primary key,
  code text not null,
  role text not null default 'barista' check (role in ('barista', 'manager')),
  barista_id text,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null
);
insert into public.app_settings (key, value) values ('signup_mode', '"invite"') on conflict (key) do nothing;

-- 2. Helper functions ----------------------------------------------------------
create or replace function public.jsonb_deep_merge(a jsonb, b jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare k text; result jsonb;
begin
  if jsonb_typeof(a) = 'object' and jsonb_typeof(b) = 'object' then
    result := a;
    for k in select jsonb_object_keys(b) loop
      if result ? k and jsonb_typeof(result -> k) = 'object' and jsonb_typeof(b -> k) = 'object' then
        result := jsonb_set(result, array[k], public.jsonb_deep_merge(result -> k, b -> k));
      else
        result := jsonb_set(result, array[k], b -> k);
      end if;
    end loop;
    return result;
  end if;
  return b;
end $$;

create or replace function public.merge_doc(p_collection text, p_id text, p_patch jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  update public.docs
     set data = public.jsonb_deep_merge(data, p_patch), updated_at = now()
   where collection = p_collection and id = p_id;
  if not found then
    raise exception 'doc_not_found' using errcode = 'P0002';
  end if;
end $$;

create or replace function public.my_barista_id() returns text
language sql stable security definer set search_path = public as $$
  select barista_id from public.profiles where id = auth.uid() and approved
$$;

-- Who may read a document.
--   managers: everything
--   everyone else approved: shared data, plus their own private file
--   scorecards and one-to-one notes: managers only
create or replace function public.can_read_doc(c text, i text, d jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(case
    when not public.is_approved() then false
    when public.is_manager() then true
    when c in ('scorecards', 'oneonones') then false
    when c = 'staff' then i = public.my_barista_id()
    when c in ('history', 'certs') then d ->> 'baristaId' = public.my_barista_id()
    else true
  end, false)
$$;

-- A coffee check or idea written by the signed-in person's own barista profile.
create or replace function public.is_own_entry(c text, d jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.is_approved() and public.my_barista_id() is not null and (
    (c = 'checks' and d ->> 'baristaId' = public.my_barista_id()) or
    (c = 'ideas' and d ->> 'byId' = public.my_barista_id())
  ), false)
$$;

-- 3. Row level security on docs ------------------------------------------------
drop policy if exists docs_select on public.docs;
drop policy if exists docs_insert on public.docs;
drop policy if exists docs_update on public.docs;
drop policy if exists docs_delete on public.docs;

create policy docs_select on public.docs for select to authenticated
  using (public.can_read_doc(collection, id, data));

create policy docs_insert on public.docs for insert to authenticated
  with check (
    public.is_manager()
    or (public.is_own_entry(collection, data)
        and (collection <> 'ideas' or coalesce(data ->> 'status', 'Idea') = 'Idea'))
  );

-- People can fix or remove their own entries for 24 hours. Managers any time.
create policy docs_update on public.docs for update to authenticated
  using (public.is_manager()
         or (public.is_own_entry(collection, data) and created_at > now() - interval '24 hours'))
  with check (public.is_manager() or public.is_own_entry(collection, data));

create policy docs_delete on public.docs for delete to authenticated
  using (public.is_manager()
         or (public.is_own_entry(collection, data) and created_at > now() - interval '24 hours'));

-- Non-managers can never change an idea's status, owner or result.
create or replace function public.guard_docs() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_manager() and new.collection = 'ideas' then
    new.data := new.data || jsonb_build_object(
      'status', coalesce(old.data -> 'status', '"Idea"'::jsonb),
      'owner', coalesce(old.data -> 'owner', '""'::jsonb),
      'result', coalesce(old.data -> 'result', '""'::jsonb));
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists guard_docs on public.docs;
create trigger guard_docs before update on public.docs
  for each row execute function public.guard_docs();

-- 4. Invites and app settings (managers only) ----------------------------------
alter table public.invites enable row level security;
alter table public.app_settings enable row level security;
drop policy if exists invites_manager on public.invites;
drop policy if exists app_settings_manager on public.app_settings;
create policy invites_manager on public.invites for all to authenticated
  using (public.is_manager()) with check (public.is_manager());
create policy app_settings_manager on public.app_settings for all to authenticated
  using (public.is_manager()) with check (public.is_manager());
grant select, insert, update, delete on public.invites, public.app_settings to authenticated;

-- 5. Sign-ups: first account = manager; invited email + code = approved;
--    otherwise closed (or pending, when a manager switches sign-ups to "open").
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare first_user boolean; inv public.invites%rowtype; mode text; given text;
begin
  select not exists (select 1 from public.profiles) into first_user;
  if first_user then
    insert into public.profiles (id, email, role, approved) values (new.id, new.email, 'manager', true);
    return new;
  end if;

  given := upper(trim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')));
  select * into inv from public.invites
   where lower(email) = lower(new.email) and used_at is null and given <> '' and code = given;
  if found then
    insert into public.profiles (id, email, role, approved, barista_id)
    values (new.id, new.email, inv.role, true, inv.barista_id);
    update public.invites set used_at = now() where email = inv.email;
    return new;
  end if;

  select coalesce(value #>> '{}', 'invite') into mode from public.app_settings where key = 'signup_mode';
  if coalesce(mode, 'invite') = 'open' then
    insert into public.profiles (id, email, role, approved) values (new.id, new.email, 'barista', false);
    return new;
  end if;
  raise exception 'signup_closed' using hint = 'Sign-ups are by invitation.';
end $$;

-- 6. Keep-alive ping (used by the weekly GitHub job so the free project is not paused)
create or replace function public.ping() returns text
language sql stable set search_path = public as $$ select 'ok'::text $$;

-- 7. Move private details out of the shared barista records ----------------------
insert into public.docs (collection, id, data)
select 'staff', b.id, jsonb_strip_nulls(jsonb_build_object(
         'skills', b.data -> 'skills', 'strengths', b.data -> 'strengths', 'grow', b.data -> 'grow',
         'goals', b.data -> 'goals', 'notes', b.data -> 'notes', 'nextCheckin', b.data -> 'nextCheckin',
         'onboarding', b.data -> 'onboarding', 'sample', b.data -> 'sample'))
  from public.docs b
 where b.collection = 'baristas'
   and (b.data ?| array['skills', 'strengths', 'grow', 'goals', 'notes', 'nextCheckin', 'onboarding'])
on conflict (collection, id) do nothing;

update public.docs
   set data = data - 'skills' - 'strengths' - 'grow' - 'goals' - 'notes' - 'nextCheckin' - 'onboarding'
 where collection = 'baristas'
   and (data ?| array['skills', 'strengths', 'grow', 'goals', 'notes', 'nextCheckin', 'onboarding']);

-- First skill snapshot (this week) for anyone who already has ratings.
insert into public.docs (collection, id, data)
select 'history',
       s.id || '_' || to_char(date_trunc('week', now()), 'YYYY-MM-DD'),
       jsonb_strip_nulls(jsonb_build_object(
         'baristaId', s.id, 'date', to_char(date_trunc('week', now()), 'YYYY-MM-DD'),
         'skills', s.data -> 'skills', 'sample', s.data -> 'sample'))
  from public.docs s
 where s.collection = 'staff' and jsonb_typeof(s.data -> 'skills') = 'object' and s.data -> 'skills' <> '{}'::jsonb
on conflict (collection, id) do nothing;

-- 8. Function permissions ----------------------------------------------------------
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.is_approved(), public.is_manager(), public.my_barista_id(),
  public.can_read_doc(text, text, jsonb), public.is_own_entry(text, jsonb),
  public.jsonb_deep_merge(jsonb, jsonb), public.merge_doc(text, text, jsonb) from public, anon;
grant execute on function public.is_approved(), public.is_manager(), public.my_barista_id(),
  public.can_read_doc(text, text, jsonb), public.is_own_entry(text, jsonb),
  public.jsonb_deep_merge(jsonb, jsonb), public.merge_doc(text, text, jsonb) to authenticated;
revoke all on function public.guard_docs() from public, anon, authenticated;
grant execute on function public.ping() to anon, authenticated;
