BEGIN;

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Drop all existing team-related policies to avoid overlap and recursion.
DROP POLICY IF EXISTS "Users can view their teams" ON public.teams;
DROP POLICY IF EXISTS "Users can create teams" ON public.teams;
DROP POLICY IF EXISTS "Users can update their teams" ON public.teams;
DROP POLICY IF EXISTS "Users can delete their teams" ON public.teams;
DROP POLICY IF EXISTS "Allow authenticated users to create teams." ON public.teams;
DROP POLICY IF EXISTS "Allow team members to view their teams." ON public.teams;
DROP POLICY IF EXISTS "Allow team owners/admins to update their teams." ON public.teams;
DROP POLICY IF EXISTS "Allow team owners to delete their teams." ON public.teams;

DROP POLICY IF EXISTS "Users can view team members of their teams" ON public.team_members;
DROP POLICY IF EXISTS "Team managers can add members" ON public.team_members;
DROP POLICY IF EXISTS "Team managers can update member roles" ON public.team_members;
DROP POLICY IF EXISTS "Team managers can remove members" ON public.team_members;
DROP POLICY IF EXISTS "Team creators or owners can add members" ON public.team_members;
DROP POLICY IF EXISTS "Team creators or owners can update member roles" ON public.team_members;
DROP POLICY IF EXISTS "Team creators or owners can remove members" ON public.team_members;
DROP POLICY IF EXISTS "Allow team members to view members of their teams." ON public.team_members;
DROP POLICY IF EXISTS "Allow team owners/admins to add members." ON public.team_members;
DROP POLICY IF EXISTS "Allow team owners/admins to update member roles." ON public.team_members;
DROP POLICY IF EXISTS "Allow team owners/admins to remove members." ON public.team_members;

DROP FUNCTION IF EXISTS public.is_team_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_team_admin_or_owner(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_team_creator(uuid, uuid);
DROP FUNCTION IF EXISTS public.can_manage_team_members(uuid, uuid);

-- Helper functions evaluated with definer privileges avoid recursive RLS evaluation.
CREATE OR REPLACE FUNCTION public.is_team_member(team_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
	SELECT auth.uid() IS NOT NULL
		AND EXISTS (
			SELECT 1
			FROM public.team_members tm
			WHERE tm.team_id = team_uuid
				AND tm.user_id = auth.uid()
		);
$$;

CREATE OR REPLACE FUNCTION public.is_team_admin_or_owner(team_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
	SELECT auth.uid() IS NOT NULL
		AND EXISTS (
			SELECT 1
			FROM public.team_members tm
			WHERE tm.team_id = team_uuid
				AND tm.user_id = auth.uid()
				AND tm.role IN ('owner', 'admin')
		);
$$;

CREATE OR REPLACE FUNCTION public.is_team_creator(team_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
	SELECT auth.uid() IS NOT NULL
		AND EXISTS (
			SELECT 1
			FROM public.teams t
			WHERE t.id = team_uuid
				AND t.created_by = auth.uid()
		);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_team_members(team_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
	SELECT public.is_team_creator(team_uuid)
		OR public.is_team_admin_or_owner(team_uuid);
$$;

REVOKE ALL ON FUNCTION public.is_team_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_team_admin_or_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_team_creator(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_team_members(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_admin_or_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_creator(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_team_members(uuid) TO authenticated;

-- Teams policies
CREATE POLICY "Users can create teams"
ON public.teams FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can view their teams"
ON public.teams FOR SELECT
USING (
	auth.uid() = created_by
	OR public.is_team_member(id)
);

CREATE POLICY "Users can update their teams"
ON public.teams FOR UPDATE
USING (
	auth.uid() = created_by
	OR public.is_team_admin_or_owner(id)
)
WITH CHECK (
	auth.uid() = created_by
	OR public.is_team_admin_or_owner(id)
);

CREATE POLICY "Users can delete their teams"
ON public.teams FOR DELETE
USING (
	auth.uid() = created_by
	OR public.is_team_admin_or_owner(id)
);

-- Team members policies
CREATE POLICY "Users can view team members of their teams"
ON public.team_members FOR SELECT
USING (public.is_team_member(team_id));

CREATE POLICY "Team managers can add members"
ON public.team_members FOR INSERT
WITH CHECK (public.can_manage_team_members(team_id));

CREATE POLICY "Team managers can update member roles"
ON public.team_members FOR UPDATE
USING (public.can_manage_team_members(team_id))
WITH CHECK (public.can_manage_team_members(team_id));

CREATE POLICY "Team managers can remove members"
ON public.team_members FOR DELETE
USING (public.can_manage_team_members(team_id));

CREATE OR REPLACE FUNCTION public.prevent_team_created_by_change()
RETURNS TRIGGER AS $$
BEGIN
	IF NEW.created_by <> OLD.created_by THEN
		RAISE EXCEPTION 'teams.created_by is immutable';
	END IF;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_teams_created_by_change ON public.teams;
CREATE TRIGGER prevent_teams_created_by_change
BEFORE UPDATE ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.prevent_team_created_by_change();

COMMIT;
