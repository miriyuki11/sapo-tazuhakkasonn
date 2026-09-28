-- Slack連携の各種設定情報（通知先チャンネル等、柔軟なjsonb形式）
create table public.slack_workspace_settings (
    id uuid primary key default gen_random_uuid(),
    team_id text not null unique references public.slack_workspaces (team_id) on delete cascade,
    settings jsonb not null default '{}' :: jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table
    public.slack_workspace_settings enable row level security;

create policy "Users can view own workspace settings" on public.slack_workspace_settings for
select
    using (
        exists (
            select
                1
            from
                public.slack_integrations si
            where
                si.team_id = slack_workspace_settings.team_id
                and si.user_id = auth.uid()
        )
    );

create policy "Users can insert own workspace settings" on public.slack_workspace_settings for
insert
    with check (
        exists (
            select
                1
            from
                public.slack_integrations si
            where
                si.team_id = slack_workspace_settings.team_id
                and si.user_id = auth.uid()
        )
    );

create policy "Users can update own workspace settings" on public.slack_workspace_settings for
update
    using (
        exists (
            select
                1
            from
                public.slack_integrations si
            where
                si.team_id = slack_workspace_settings.team_id
                and si.user_id = auth.uid()
        )
    );

create policy "Users can delete own workspace settings" on public.slack_workspace_settings for delete using (
    exists (
        select
            1
        from
            public.slack_integrations si
        where
            si.team_id = slack_workspace_settings.team_id
            and si.user_id = auth.uid()
    )
);

create trigger slack_workspace_settings_set_updated_at before
update
    on public.slack_workspace_settings for each row execute function public.set_updated_at();