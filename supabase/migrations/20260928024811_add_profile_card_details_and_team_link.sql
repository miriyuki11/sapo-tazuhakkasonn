BEGIN;

ALTER TABLE public.profile_cards
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
-- ALTER TABLE public.profile_cards DROP COLUMN IF EXISTS team_id;
