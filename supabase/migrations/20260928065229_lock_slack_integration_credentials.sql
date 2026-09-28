begin;

drop policy if exists "Installer or service role can view slack integration"
    on public.slack_integrations;
drop policy if exists "Installer or service role can insert slack integration"
    on public.slack_integrations;
drop policy if exists "Installer or service role can update slack integration"
    on public.slack_integrations;
drop policy if exists "Installer or service role can delete slack integration"
    on public.slack_integrations;

revoke all privileges on table public.slack_integrations
    from anon, authenticated;

grant all privileges on table public.slack_integrations
    to service_role;

commit;