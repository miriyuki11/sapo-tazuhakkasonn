BEGIN;

ALTER TABLE public.profile_cards
ADD COLUMN IF NOT EXISTS team_id UUID;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'profile_cards_team_id_fkey'
			AND conrelid = 'public.profile_cards'::regclass
	) THEN
		ALTER TABLE public.profile_cards
		ADD CONSTRAINT profile_cards_team_id_fkey
		FOREIGN KEY (team_id)
		REFERENCES public.teams(id)
		ON DELETE SET NULL;
	END IF;
END;
$$;

COMMIT;

-- Optional rollback reference:
-- ALTER TABLE public.profile_cards DROP CONSTRAINT IF EXISTS profile_cards_team_id_fkey;
-- ALTER TABLE public.profile_cards DROP COLUMN IF EXISTS team_id;
