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
    column installer_user_id uuid references auth.users (id) on delete cascade;

update
    public.slack_integrations
set
    installer_user_id = user_id;

alter table
    public.slack_integrations
alter column
    installer_user_id set not null;

create table public.user_slack_connections (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    slack_team_id text not null references public.slack_workspaces (team_id) on delete cascade,
    slack_user_id text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, slack_team_id)
);

create or replace function public.prevent_slack_workspace_settings_team_id_update()
returns trigger
language plpgsql
as $$
begin
    if new.team_id is distinct from old.team_id then
        raise exception 'slack_workspace_settings.team_id is immutable';
    end if;

    return new;
end;
$$;

create or replace function public.delete_slack_workspace_settings_for_integration()
returns trigger
language plpgsql
as $$
begin
    delete from public.slack_workspace_settings
    where team_id = old.team_id;

    return old;
end;
$$;

insert into
    public.user_slack_connections (user_id, slack_team_id, slack_user_id)
select
    user_id,
    team_id,
    slack_user_id
from
    public.slack_integrations on conflict (user_id, slack_team_id) do nothing;

create trigger slack_workspace_settings_prevent_team_id_update before
update
    on public.slack_workspace_settings for each row execute function
public.prevent_slack_workspace_settings_team_id_update();

create trigger slack_integrations_delete_workspace_settings after delete on
public.slack_integrations for each row execute function
public.delete_slack_workspace_settings_for_integration();

create trigger user_slack_connections_set_updated_at before
update
    on public.user_slack_connections for each row execute function public.set_updated_at();

alter table
    public.user_slack_connections enable row level security;

alter table
    public.slack_workspaces enable row level security;

create policy "Service role can manage slack workspaces" on public.slack_workspaces for all
    using (auth.role() = 'service_role') with check (
        auth.role() = 'service_role'
    );

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

create or replace function public.is_slack_workspace_installer(workspace_team_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select auth.uid() is not null
        and exists (
            select
                1
            from
                public.slack_integrations si
            where
                si.team_id = workspace_team_id
                and si.installer_user_id = auth.uid()
        );
$$;

revoke all on function public.is_slack_workspace_installer(text) from public;
grant execute on function public.is_slack_workspace_installer(text) to authenticated;

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
        or public.is_slack_workspace_installer(slack_workspace_settings.team_id)
    );

create policy "Installer or service role can insert workspace settings" on public.slack_workspace_settings for
insert
    with check (
        auth.role() = 'service_role'
        or public.is_slack_workspace_installer(slack_workspace_settings.team_id)
    );

create policy "Installer or service role can update workspace settings" on public.slack_workspace_settings for
update
    using (
        auth.role() = 'service_role'
        or public.is_slack_workspace_installer(slack_workspace_settings.team_id)
    ) with check (
        auth.role() = 'service_role'
        or public.is_slack_workspace_installer(slack_workspace_settings.team_id)
    );

create policy "Installer or service role can delete workspace settings" on public.slack_workspace_settings for delete using (
    auth.role() = 'service_role'
    or public.is_slack_workspace_installer(slack_workspace_settings.team_id)
);