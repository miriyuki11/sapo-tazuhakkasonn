begin;

create table public.slack_oauth_states (
    state_hash text primary key check (state_hash ~ '^[0-9a-f]{64}$'),
    user_id uuid not null references auth.users (id) on delete cascade,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    check (expires_at > created_at)
);

create index slack_oauth_states_expires_at_idx
    on public.slack_oauth_states (expires_at);

alter table public.slack_oauth_states enable row level security;

revoke all privileges on table public.slack_oauth_states
    from anon, authenticated;

grant all privileges on table public.slack_oauth_states
    to service_role;

create policy "Service role can manage Slack OAuth states"
    on public.slack_oauth_states for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

commit;