-- Crew Book: database setup for Supabase.
-- Paste this whole file into Supabase > SQL Editor > New query, then press Run.
-- Safe to run once on a fresh project.

-- 1. People who can sign in ---------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'barista' check (role in ('barista', 'manager')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- The very first person to create an account becomes an approved manager.
-- Everyone after that waits for a manager to approve them.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare first_user boolean;
begin
  select not exists (select 1 from public.profiles) into first_user;
  insert into public.profiles (id, email, role, approved)
  values (new.id, new.email, case when first_user then 'manager' else 'barista' end, first_user);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and approved)
$$;

create function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and approved and role = 'manager')
$$;

-- 2. All the team data lives in one table of documents ------------------------
create table public.docs (
  collection text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

-- Merges a patch into a document, going into nested objects (skill ratings etc).
create function public.jsonb_deep_merge(a jsonb, b jsonb) returns jsonb
language plpgsql immutable as $$
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

create function public.merge_doc(p_collection text, p_id text, p_patch jsonb) returns void
language plpgsql security invoker as $$
begin
  update public.docs
     set data = public.jsonb_deep_merge(data, p_patch), updated_at = now()
   where collection = p_collection and id = p_id;
  if not found then
    raise exception 'doc_not_found' using errcode = 'P0002';
  end if;
end $$;

-- 3. Who can see and change what ----------------------------------------------
alter table public.profiles enable row level security;
alter table public.docs enable row level security;

-- Everyone sees their own account; managers see everyone and approve people.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_manager());
create policy profiles_update on public.profiles for update to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- Approved people read the team data, except leadership scorecards (managers only).
create policy docs_select on public.docs for select to authenticated
  using (public.is_approved() and (collection <> 'scorecards' or public.is_manager()));

-- Approved people can log coffee checks and add ideas. Everything else
-- (baristas, ratings, assignments, plan, settings, scorecards) is managers only.
create policy docs_insert on public.docs for insert to authenticated
  with check (public.is_approved() and (collection in ('checks', 'ideas') or public.is_manager()));
create policy docs_update on public.docs for update to authenticated
  using (public.is_approved() and (collection in ('checks', 'ideas') or public.is_manager()))
  with check (public.is_approved() and (collection in ('checks', 'ideas') or public.is_manager()));
create policy docs_delete on public.docs for delete to authenticated
  using (public.is_manager());

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.docs to authenticated;
grant execute on function public.merge_doc(text, text, jsonb) to authenticated;

-- 4. Live updates -----------------------------------------------------------------
alter publication supabase_realtime add table public.docs;
