-- Slackワークスペース単位の一意なアンカー（複数ユーザーが同じteam_idに紐づくため必要）
create table public.slack_workspaces (
    team_id text primary key,
    created_at timestamptz not null default now()
);

insert into public.slack_workspaces (team_id)
select distinct team_id from public.slack_integrations
on conflict (team_id) do nothing;

create or replace function public.ensure_slack_workspace_anchor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    insert into public.slack_workspaces (team_id)
    values (new.team_id)
    on conflict (team_id) do nothing;

    return new;
end;
$$;

create trigger slack_integrations_ensure_workspace_anchor before insert or
update of team_id on public.slack_integrations for each row execute function
public.ensure_slack_workspace_anchor();

alter table public.slack_integrations
    add constraint slack_integrations_team_id_fkey
    foreign key (team_id) references public.slack_workspaces (team_id) on delete cascade;
