-- Slack OAuth連携情報（ワークスペース単位）
create table public.slack_integrations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    team_id text not null,
    team_name text,
    slack_user_id text not null,
    access_token text not null,
    refresh_token text,
    scope text,
    bot_user_id text,
    installed_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, team_id)
);

create index slack_integrations_team_id_idx on public.slack_integrations (team_id);
create index slack_integrations_user_id_idx on public.slack_integrations (user_id);

alter table public.slack_integrations enable row level security;

create policy "Users can view own slack integrations"
  on public.slack_integrations for select
  using (auth.uid() = user_id);

create policy "Users can insert own slack integrations"
  on public.slack_integrations for insert
  with check (auth.uid() = user_id);

create policy "Users can update own slack integrations"
  on public.slack_integrations for update
  using (auth.uid() = user_id);

create policy "Users can delete own slack integrations"
  on public.slack_integrations for delete
  using (auth.uid() = user_id);

-- updated_at 自動更新
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger slack_integrations_set_updated_at
  before update on public.slack_integrations
  for each row execute function public.set_updated_at();