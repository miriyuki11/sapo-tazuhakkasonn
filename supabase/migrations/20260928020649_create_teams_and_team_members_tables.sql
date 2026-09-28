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

-- teams policies
CREATE POLICY "Users can view their teams" ON public.teams
FOR SELECT USING (
	auth.uid() = created_by OR EXISTS (
		SELECT 1 FROM public.team_members
		WHERE team_id = public.teams.id AND user_id = auth.uid()
	)
);

CREATE POLICY "Users can create teams" ON public.teams
FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their teams" ON public.teams
FOR UPDATE USING (
	auth.uid() = created_by OR EXISTS (
		SELECT 1 FROM public.team_members
		WHERE team_id = public.teams.id AND user_id = auth.uid() AND role = 'owner'
	)
) WITH CHECK (
	auth.uid() = created_by OR EXISTS (
		SELECT 1 FROM public.team_members
		WHERE team_id = public.teams.id AND user_id = auth.uid() AND role = 'owner'
	)
);

CREATE POLICY "Users can delete their teams" ON public.teams
FOR DELETE USING (auth.uid() = created_by);

-- team_members policies
CREATE POLICY "Users can view team members of their teams" ON public.team_members
FOR SELECT USING (
	EXISTS (
		SELECT 1 FROM public.team_members tm_self
		WHERE tm_self.team_id = public.team_members.team_id AND tm_self.user_id = auth.uid()
	)
);

CREATE POLICY "Team creators or owners can add members" ON public.team_members
FOR INSERT WITH CHECK (
	EXISTS (
		SELECT 1 FROM public.teams
		WHERE id = public.team_members.team_id AND created_by = auth.uid()
	) OR
	EXISTS (
		SELECT 1 FROM public.team_members tm
		WHERE tm.team_id = public.team_members.team_id AND tm.user_id = auth.uid() AND tm.role = 'owner'
	)
);

CREATE POLICY "Team creators or owners can update member roles" ON public.team_members
FOR UPDATE USING (
	EXISTS (
		SELECT 1 FROM public.teams
		WHERE id = public.team_members.team_id AND created_by = auth.uid()
	) OR
	EXISTS (
		SELECT 1 FROM public.team_members tm
		WHERE tm.team_id = public.team_members.team_id AND tm.user_id = auth.uid() AND tm.role = 'owner'
	)
) WITH CHECK (
	EXISTS (
		SELECT 1 FROM public.teams
		WHERE id = public.team_members.team_id AND created_by = auth.uid()
	) OR
	EXISTS (
		SELECT 1 FROM public.team_members tm
		WHERE tm.team_id = public.team_members.team_id AND tm.user_id = auth.uid() AND tm.role = 'owner'
	)
);

CREATE POLICY "Team creators or owners can remove members" ON public.team_members
FOR DELETE USING (
	EXISTS (
		SELECT 1 FROM public.teams
		WHERE id = public.team_members.team_id AND created_by = auth.uid()
	) OR
	EXISTS (
		SELECT 1 FROM public.team_members tm
		WHERE tm.team_id = public.team_members.team_id AND tm.user_id = auth.uid() AND tm.role = 'owner'
	)
);

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
