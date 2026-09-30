create table if not exists public.profile_tag_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profile_tags (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.profile_tag_categories (id) on delete cascade,
  name text not null,
  color_hex text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (category_id, name)
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  self_introduction text,
  bio text,
  skills text,
  communication_style text,
  consultation_style text,
  free_description text,
  realtime_status text,
  team_id uuid,
  username text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profile_tags_map (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  tag_id uuid not null references public.profile_tags (id) on delete cascade,
  primary key (profile_id, tag_id)
);

alter table public.profile_tag_categories enable row level security;
alter table public.profile_tags enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_tags_map enable row level security;

drop policy if exists profile_tag_categories_read on public.profile_tag_categories;
create policy profile_tag_categories_read on public.profile_tag_categories
  for select to authenticated using (true);

drop policy if exists profile_tags_read on public.profile_tags;
create policy profile_tags_read on public.profile_tags
  for select to authenticated using (true);

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists profile_tags_map_read on public.profile_tags_map;
create policy profile_tags_map_read on public.profile_tags_map
  for select to authenticated using (true);

drop policy if exists profile_tags_map_insert_own on public.profile_tags_map;
create policy profile_tags_map_insert_own on public.profile_tags_map
  for insert to authenticated
  with check (exists (
    select 1 from public.profiles p
    where p.id = profile_id and p.user_id = auth.uid()
  ));

drop policy if exists profile_tags_map_delete_own on public.profile_tags_map;
create policy profile_tags_map_delete_own on public.profile_tags_map
  for delete to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = profile_id and p.user_id = auth.uid()
  ));
