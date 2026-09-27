-- Slackワークスペース単位の一意なアンカー（複数ユーザーが同じteam_idに紐づくため必要）
create table public.slack_workspaces (
    team_id text primary key,
    created_at timestamptz not null default now()
);

insert into public.slack_workspaces (team_id)
select distinct team_id from public.slack_integrations
on conflict (team_id) do nothing;

alter table public.slack_integrations
    add constraint slack_integrations_team_id_fkey
    foreign key (team_id) references public.slack_workspaces (team_id) on delete cascade;
