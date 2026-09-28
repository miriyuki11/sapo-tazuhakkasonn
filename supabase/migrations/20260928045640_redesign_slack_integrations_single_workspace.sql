drop policy if exists "Users can view own slack integrations" on public.slack_integrations;

drop policy if exists "Users can insert own slack integrations" on public.slack_integrations;

drop policy if exists "Users can update own slack integrations" on public.slack_integrations;

drop policy if exists "Users can delete own slack integrations" on public.slack_integrations;

drop policy if exists "Users can view own workspace settings" on public.slack_workspace_settings;

drop policy if exists "Users can insert own workspace settings" on public.slack_workspace_settings;

drop policy if exists "Users can update own workspace settings" on public.slack_workspace_settings;

drop policy if exists "Users can delete own workspace settings" on public.slack_workspace_settings;

alter table
    public.slack_integrations
add
    column installer_user_id uuid references auth.users (id) on delete
set
    null;

update
    public.slack_integrations
set
    installer_user_id = user_id;

create table public.user_slack_connections (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    slack_team_id text not null references public.slack_workspaces (team_id) on delete cascade,
    slack_user_id text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, slack_team_id)
);

insert into
    public.user_slack_connections (user_id, slack_team_id, slack_user_id)
select
    user_id,
    team_id,
    slack_user_id
from
    public.slack_integrations;

create trigger user_slack_connections_set_updated_at before
update
    on public.user_slack_connections for each row execute function public.set_updated_at();

alter table
    public.user_slack_connections enable row level security;

create policy "Users can view own slack connections" on public.user_slack_connections for
select
    using (
        auth.uid() = user_id
        or auth.role() = 'service_role'
    );

create policy "Users can insert own slack connections" on public.user_slack_connections for
insert
    with check (
        auth.uid() = user_id
        or auth.role() = 'service_role'
    );

create policy "Users can update own slack connections" on public.user_slack_connections for
update
    using (
        auth.uid() = user_id
        or auth.role() = 'service_role'
    ) with check (
        auth.uid() = user_id
        or auth.role() = 'service_role'
    );

create policy "Users can delete own slack connections" on public.user_slack_connections for delete using (
    auth.uid() = user_id
    or auth.role() = 'service_role'
);

alter table
    public.slack_integrations drop constraint if exists slack_integrations_user_id_team_id_key;

alter table
    public.slack_integrations drop column user_id;

alter table
    public.slack_integrations rename column slack_user_id to slack_installer_user_id;

alter table
    public.slack_integrations
add
    constraint slack_integrations_team_id_key unique (team_id);

drop index if exists public.slack_integrations_team_id_idx;

create index slack_integrations_installer_user_id_idx on public.slack_integrations (installer_user_id);

create policy "Installer or service role can view slack integration" on public.slack_integrations for
select
    using (
        auth.uid() = installer_user_id
        or auth.role() = 'service_role'
    );

create policy "Installer or service role can insert slack integration" on public.slack_integrations for
insert
    with check (
        auth.uid() = installer_user_id
        or auth.role() = 'service_role'
    );

create policy "Installer or service role can update slack integration" on public.slack_integrations for
update
    using (
        auth.uid() = installer_user_id
        or auth.role() = 'service_role'
    ) with check (
        auth.uid() = installer_user_id
        or auth.role() = 'service_role'
    );

create policy "Installer or service role can delete slack integration" on public.slack_integrations for delete using (
    auth.uid() = installer_user_id
    or auth.role() = 'service_role'
);

create policy "Installer or service role can view workspace settings" on public.slack_workspace_settings for
select
    using (
        auth.role() = 'service_role'
        or exists (
            select
                1
            from
                public.slack_integrations si
            where
                si.team_id = slack_workspace_settings.team_id
                and si.installer_user_id = auth.uid()
        )
    );

create policy "Installer or service role can insert workspace settings" on public.slack_workspace_settings for
insert
    with check (
        auth.role() = 'service_role'
        or exists (
            select
                1
            from
                public.slack_integrations si
            where
                si.team_id = slack_workspace_settings.team_id
                and si.installer_user_id = auth.uid()
        )
    );

create policy "Installer or service role can update workspace settings" on public.slack_workspace_settings for
update
    using (
        auth.role() = 'service_role'
        or exists (
            select
                1
            from
                public.slack_integrations si
            where
                si.team_id = slack_workspace_settings.team_id
                and si.installer_user_id = auth.uid()
        )
    ) with check (
        auth.role() = 'service_role'
        or exists (
            select
                1
            from
                public.slack_integrations si
            where
                si.team_id = slack_workspace_settings.team_id
                and si.installer_user_id = auth.uid()
        )
    );

create policy "Installer or service role can delete workspace settings" on public.slack_workspace_settings for delete using (
    auth.role() = 'service_role'
    or exists (
        select
            1
        from
            public.slack_integrations si
        where
            si.team_id = slack_workspace_settings.team_id
            and si.installer_user_id = auth.uid()
    )
);