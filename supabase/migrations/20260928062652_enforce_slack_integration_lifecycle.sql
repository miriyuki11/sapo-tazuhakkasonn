alter table public.slack_integrations
    drop constraint if exists slack_integrations_installer_user_id_fkey;

alter table public.slack_integrations
    add constraint slack_integrations_installer_user_id_fkey
    foreign key (installer_user_id)
    references auth.users (id)
    on delete cascade;

create or replace function public.prevent_slack_integration_team_id_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.team_id is distinct from old.team_id then
        raise exception 'slack_integrations.team_id is immutable';
    end if;

    return new;
end;
$$;

drop trigger if exists slack_integrations_prevent_team_id_update
    on public.slack_integrations;

create trigger slack_integrations_prevent_team_id_update
before update of team_id on public.slack_integrations
for each row
execute function public.prevent_slack_integration_team_id_update();

create or replace function public.delete_slack_workspace_settings_for_integration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not exists (
        select 1
        from public.slack_integrations
        where team_id = old.team_id
    ) then
        delete from public.user_slack_connections
        where slack_team_id = old.team_id;

        delete from public.slack_workspace_settings
        where team_id = old.team_id;
    end if;

    return old;
end;
$$;