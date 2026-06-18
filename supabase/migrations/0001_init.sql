-- Opened Role — initial schema.
-- Run this in the Supabase SQL editor (or `supabase db push`) on a fresh project.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One profile row per auth user. id mirrors auth.users.id.
create table public.profiles (
  id        uuid primary key references auth.users (id) on delete cascade,
  email     text not null,
  name      text not null default '',
  headline  text not null default '',
  location  text not null default '',
  bio       text not null default '',
  skills    text[] not null default '{}',
  interests text[] not null default '{}',
  school    text,
  resume    jsonb,
  hue       int  not null default 210
);

create table public.projects (
  id          text primary key,
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  title       text not null,
  tagline     text not null,
  description text not null,
  category    text not null,
  tags        text[] not null default '{}',
  hue         int  not null default 210,
  created_at  timestamptz not null default now()
);

create table public.roles (
  id          text primary key,
  project_id  text not null references public.projects (id) on delete cascade,
  title       text not null,
  description text not null default '',
  skills      text[] not null default '{}',
  slots       int  not null default 1,
  filled_by   uuid[] not null default '{}',
  work_mode   text not null default 'remote',
  position    int  not null default 0
);

create table public.applications (
  id          text primary key,
  project_id  text not null references public.projects (id) on delete cascade,
  role_id     text not null references public.roles (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  message     text not null default '',
  status      text not null default 'pending'
                check (status in ('pending', 'accepted', 'declined')),
  created_at  timestamptz not null default now()
);

create table public.tools (
  id           text primary key,
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  name         text not null,
  category     text not null,
  description  text not null default '',
  rate_per_day numeric not null default 0,
  created_at   timestamptz not null default now()
);

create index on public.projects (owner_id);
create index on public.roles (project_id);
create index on public.applications (project_id);
create index on public.applications (user_id);
create index on public.tools (owner_id);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles     enable row level security;
alter table public.projects     enable row level security;
alter table public.roles        enable row level security;
alter table public.applications enable row level security;
alter table public.tools        enable row level security;

-- profiles: everyone signed in can read; you can only write your own row.
create policy "profiles readable by authenticated"
  on public.profiles for select to authenticated using (true);
create policy "insert own profile"
  on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- projects: readable by all signed in; only the owner can mutate.
create policy "projects readable by authenticated"
  on public.projects for select to authenticated using (true);
create policy "owner inserts project"
  on public.projects for insert to authenticated with check (owner_id = auth.uid());
create policy "owner updates project"
  on public.projects for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner deletes project"
  on public.projects for delete to authenticated using (owner_id = auth.uid());

-- roles: readable by all; only the parent project's owner can mutate
-- (this is how accepting an applicant fills a slot).
create policy "roles readable by authenticated"
  on public.roles for select to authenticated using (true);
create policy "project owner inserts roles"
  on public.roles for insert to authenticated with check (
    exists (select 1 from public.projects p
            where p.id = project_id and p.owner_id = auth.uid()));
create policy "project owner updates roles"
  on public.roles for update to authenticated using (
    exists (select 1 from public.projects p
            where p.id = project_id and p.owner_id = auth.uid()));
create policy "project owner deletes roles"
  on public.roles for delete to authenticated using (
    exists (select 1 from public.projects p
            where p.id = project_id and p.owner_id = auth.uid()));

-- applications: visible to the applicant and to the project owner only.
create policy "applicant or owner reads application"
  on public.applications for select to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.projects p
               where p.id = project_id and p.owner_id = auth.uid()));
create policy "user inserts own application"
  on public.applications for insert to authenticated with check (user_id = auth.uid());
create policy "owner decides application"
  on public.applications for update to authenticated using (
    exists (select 1 from public.projects p
            where p.id = project_id and p.owner_id = auth.uid()));
create policy "applicant withdraws own application"
  on public.applications for delete to authenticated using (user_id = auth.uid());

-- tools: readable by all; only the owner can mutate.
create policy "tools readable by authenticated"
  on public.tools for select to authenticated using (true);
create policy "owner inserts tool"
  on public.tools for insert to authenticated with check (owner_id = auth.uid());
create policy "owner updates tool"
  on public.tools for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner deletes tool"
  on public.tools for delete to authenticated using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Auto-create a profile row whenever a new auth user signs up.
-- Name and other fields come from the signUp metadata.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, headline, location, bio, school, hue)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'headline', ''),
    coalesce(new.raw_user_meta_data ->> 'location', ''),
    coalesce(new.raw_user_meta_data ->> 'bio', ''),
    nullif(new.raw_user_meta_data ->> 'school', ''),
    coalesce((new.raw_user_meta_data ->> 'hue')::int, (floor(random() * 360))::int)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Realtime: broadcast row changes so every open browser stays in sync.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table
  public.profiles, public.projects, public.roles, public.applications, public.tools;
