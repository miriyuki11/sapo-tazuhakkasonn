BEGIN;

-- No-op: helper-backed team policies are installed in
-- 20260928020649_create_teams_and_team_members_tables.sql to avoid
-- recursive RLS failures during incremental deployments.

COMMIT;