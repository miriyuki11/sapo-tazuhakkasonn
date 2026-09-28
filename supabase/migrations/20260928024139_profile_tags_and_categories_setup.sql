BEGIN;

CREATE TABLE public.tag_categories (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	name text NOT NULL UNIQUE,
	description text,
	created_at timestamptz DEFAULT now() NOT NULL,
	updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER set_updated_at_on_tag_categories
BEFORE UPDATE ON public.tag_categories
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tag_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-only access to tag categories."
ON public.tag_categories FOR SELECT
USING (true);

CREATE TABLE public.profile_tags (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	category_id uuid NOT NULL REFERENCES public.tag_categories(id) ON DELETE CASCADE,
	name text NOT NULL UNIQUE,
	color_hex text,
	created_at timestamptz DEFAULT now() NOT NULL,
	updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER set_updated_at_on_profile_tags
BEFORE UPDATE ON public.profile_tags
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profile_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-only access to profile tags."
ON public.profile_tags FOR SELECT
USING (true);

CREATE TABLE public.profile_card_tags (
	profile_card_id uuid NOT NULL REFERENCES public.profile_cards(id) ON DELETE CASCADE,
	profile_tag_id uuid NOT NULL REFERENCES public.profile_tags(id) ON DELETE CASCADE,
	created_at timestamptz DEFAULT now() NOT NULL,
	PRIMARY KEY (profile_card_id, profile_tag_id)
);

ALTER TABLE public.profile_card_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile card tags."
ON public.profile_card_tags FOR SELECT TO authenticated
USING (
	EXISTS (
		SELECT 1
		FROM public.profile_cards
		WHERE public.profile_cards.id = public.profile_card_tags.profile_card_id
			AND public.profile_cards.user_id = auth.uid()
	)
);

CREATE POLICY "Users can insert their own profile card tags."
ON public.profile_card_tags FOR INSERT TO authenticated
WITH CHECK (
	EXISTS (
		SELECT 1
		FROM public.profile_cards
		WHERE public.profile_cards.id = public.profile_card_tags.profile_card_id
			AND public.profile_cards.user_id = auth.uid()
	)
);

CREATE POLICY "Users can delete their own profile card tags."
ON public.profile_card_tags FOR DELETE TO authenticated
USING (
	EXISTS (
		SELECT 1
		FROM public.profile_cards
		WHERE public.profile_cards.id = public.profile_card_tags.profile_card_id
			AND public.profile_cards.user_id = auth.uid()
	)
);

COMMIT;
