alter table public.slack_workspaces enable row level security;

alter table public.slack_integrations
    alter column installer_user_id set not null;

alter table public.slack_integrations
    drop constraint if exists slack_integrations_installer_user_id_fkey;

alter table public.slack_integrations
    add constraint slack_integrations_installer_user_id_fkey
    foreign key (installer_user_id)
    references auth.users (id)
    on delete restrict;

create or replace function public.ensure_slack_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as '
begin
    insert into public.slack_workspaces (team_id)
    values (new.team_id)
    on conflict (team_id) do nothing;

    return new;
end;
';

create trigger slack_integrations_ensure_workspace
before insert on public.slack_integrations
for each row
execute function public.ensure_slack_workspace();