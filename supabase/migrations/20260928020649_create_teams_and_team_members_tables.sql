BEGIN;

-- teams table
CREATE TABLE public.teams (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
		name text NOT NULL UNIQUE CHECK (char_length(name) <= 255),
		description text CHECK (char_length(description) <= 1000),
		created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
		created_at timestamp with time zone DEFAULT now() NOT NULL,
		updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- team_members table
CREATE TABLE public.team_members (
		team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
		user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
		role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
		joined_at timestamp with time zone DEFAULT now() NOT NULL,
		PRIMARY KEY (team_id, user_id)
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

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

-- teams policies
CREATE POLICY "Users can create teams" ON public.teams
FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can view their teams" ON public.teams
FOR SELECT USING (
	auth.uid() = created_by
	OR public.is_team_member(id)
);

CREATE POLICY "Users can update their teams" ON public.teams
FOR UPDATE USING (
	auth.uid() = created_by
	OR public.is_team_admin_or_owner(id)
) WITH CHECK (
	auth.uid() = created_by
	OR public.is_team_admin_or_owner(id)
);

CREATE POLICY "Users can delete their teams" ON public.teams
FOR DELETE USING (
	auth.uid() = created_by
	OR public.is_team_admin_or_owner(id)
);

-- team_members policies
CREATE POLICY "Users can view team members of their teams" ON public.team_members
FOR SELECT USING (public.is_team_member(team_id));

CREATE POLICY "Team managers can add members" ON public.team_members
FOR INSERT WITH CHECK (public.can_manage_team_members(team_id));

CREATE POLICY "Team managers can update member roles" ON public.team_members
FOR UPDATE USING (public.can_manage_team_members(team_id))
WITH CHECK (public.can_manage_team_members(team_id));

CREATE POLICY "Team managers can remove members" ON public.team_members
FOR DELETE USING (public.can_manage_team_members(team_id));

-- Enable automatic updated_at column update for teams table
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
		NEW.updated_at = NOW();
		RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_teams_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

COMMIT;
