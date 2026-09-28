BEGIN;

ALTER TABLE public.profile_cards
ADD COLUMN IF NOT EXISTS skills TEXT,
ADD COLUMN IF NOT EXISTS communication_style TEXT,
ADD COLUMN IF NOT EXISTS consultation_style TEXT,
ADD COLUMN IF NOT EXISTS free_description TEXT,
ADD COLUMN IF NOT EXISTS team_id UUID;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'fk_team'
			AND conrelid = 'public.profile_cards'::regclass
	) THEN
		ALTER TABLE public.profile_cards
		ADD CONSTRAINT fk_team
		FOREIGN KEY (team_id)
		REFERENCES public.teams(id)
		ON DELETE SET NULL;
	END IF;
END;
$$;

COMMIT;

-- Optional rollback reference:
-- ALTER TABLE public.profile_cards DROP CONSTRAINT IF EXISTS fk_team;
-- ALTER TABLE public.profile_cards
--   DROP COLUMN IF EXISTS skills,
--   DROP COLUMN IF EXISTS communication_style,
--   DROP COLUMN IF EXISTS consultation_style,
--   DROP COLUMN IF EXISTS free_description,
--   DROP COLUMN IF EXISTS team_id;
