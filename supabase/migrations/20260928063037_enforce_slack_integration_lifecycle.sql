drop policy if exists "Users can insert own slack connections"
    on public.user_slack_connections;
drop policy if exists "Users can update own slack connections"
    on public.user_slack_connections;
drop policy if exists "Users can delete own slack connections"
    on public.user_slack_connections;

create policy "Service role can insert slack connections"
    on public.user_slack_connections
    for insert to service_role
    with check (true);

create policy "Service role can update slack connections"
    on public.user_slack_connections
    for update to service_role
    using (true)
    with check (true);

drop policy if exists "Service role can delete slack connections"
    on public.user_slack_connections;

create policy "Service role can delete slack connections"
    on public.user_slack_connections
    for delete to service_role
    using (true);

drop trigger if exists slack_integrations_ensure_workspace
    on public.slack_integrations;