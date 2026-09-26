create table if not exists public.user_private_notes (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid not null references auth.users (id) on delete cascade,
  target_user_id uuid not null references auth.users (id) on delete cascade,
  note_content text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
