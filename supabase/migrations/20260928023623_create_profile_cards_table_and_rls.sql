BEGIN;

CREATE TABLE public.profile_cards (
	id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	self_introduction text,
	skills text,
	communication_style text,
	consultation_style text,
	free_description text,
	realtime_status text,
	created_at timestamp with time zone DEFAULT now() NOT NULL,
	updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX profile_cards_user_id_idx ON public.profile_cards (user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
	NEW.updated_at = NOW();
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_on_profile_cards
BEFORE UPDATE ON public.profile_cards
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profile_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile cards."
ON public.profile_cards FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile cards."
ON public.profile_cards FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile cards."
ON public.profile_cards FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile cards."
ON public.profile_cards FOR DELETE
USING (auth.uid() = user_id);

COMMIT;
