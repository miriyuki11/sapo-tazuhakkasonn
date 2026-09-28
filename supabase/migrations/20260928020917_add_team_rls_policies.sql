BEGIN;

-- Enable RLS for target tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Re-create policies safely
DROP POLICY IF EXISTS "Allow authenticated users to create teams." ON public.teams;
DROP POLICY IF EXISTS "Allow team members to view their teams." ON public.teams;
DROP POLICY IF EXISTS "Allow team owners/admins to update their teams." ON public.teams;
DROP POLICY IF EXISTS "Allow team owners to delete their teams." ON public.teams;

DROP POLICY IF EXISTS "Allow team members to view members of their teams." ON public.team_members;
DROP POLICY IF EXISTS "Allow team owners/admins to add members." ON public.team_members;
DROP POLICY IF EXISTS "Allow team owners/admins to update member roles." ON public.team_members;
DROP POLICY IF EXISTS "Allow team owners/admins to remove members." ON public.team_members;

-- Teams policies
CREATE POLICY "Allow authenticated users to create teams."
ON public.teams FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow team members to view their teams."
ON public.teams FOR SELECT
USING (
	EXISTS (
		SELECT 1
		FROM public.team_members
		WHERE team_id = public.teams.id
			AND user_id = auth.uid()
	)
);

CREATE POLICY "Allow team owners/admins to update their teams."
ON public.teams FOR UPDATE
USING (
	EXISTS (
		SELECT 1
		FROM public.team_members
		WHERE team_id = public.teams.id
			AND user_id = auth.uid()
			AND role IN ('owner', 'admin')
	)
)
WITH CHECK (
	EXISTS (
		SELECT 1
		FROM public.team_members
		WHERE team_id = public.teams.id
			AND user_id = auth.uid()
			AND role IN ('owner', 'admin')
	)
);

CREATE POLICY "Allow team owners to delete their teams."
ON public.teams FOR DELETE
USING (
	EXISTS (
		SELECT 1
		FROM public.team_members
		WHERE team_id = public.teams.id
			AND user_id = auth.uid()
			AND role = 'owner'
	)
);

-- Team members policies
CREATE POLICY "Allow team members to view members of their teams."
ON public.team_members FOR SELECT
USING (
	EXISTS (
		SELECT 1
		FROM public.team_members AS tm2
		WHERE tm2.team_id = public.team_members.team_id
			AND tm2.user_id = auth.uid()
	)
);

CREATE POLICY "Allow team owners/admins to add members."
ON public.team_members FOR INSERT
WITH CHECK (
	EXISTS (
		SELECT 1
		FROM public.team_members AS tm2
		WHERE tm2.team_id = public.team_members.team_id
			AND tm2.user_id = auth.uid()
			AND tm2.role IN ('owner', 'admin')
	)
);

CREATE POLICY "Allow team owners/admins to update member roles."
ON public.team_members FOR UPDATE
USING (
	EXISTS (
		SELECT 1
		FROM public.team_members AS tm2
		WHERE tm2.team_id = public.team_members.team_id
			AND tm2.user_id = auth.uid()
			AND tm2.role IN ('owner', 'admin')
	)
)
WITH CHECK (
	EXISTS (
		SELECT 1
		FROM public.team_members AS tm2
		WHERE tm2.team_id = public.team_members.team_id
			AND tm2.user_id = auth.uid()
			AND tm2.role IN ('owner', 'admin')
	)
);

CREATE POLICY "Allow team owners/admins to remove members."
ON public.team_members FOR DELETE
USING (
	EXISTS (
		SELECT 1
		FROM public.team_members AS tm2
		WHERE tm2.team_id = public.team_members.team_id
			AND tm2.user_id = auth.uid()
			AND tm2.role IN ('owner', 'admin')
	)
);

COMMIT;
