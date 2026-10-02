BEGIN;

-- プロフィールカードに公開スラッグ、公開フラグ、公開対象フィールド設定を追加
ALTER TABLE public.profile_cards
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE CHECK (slug ~ '^[a-z0-9_-]{3,64}$'),
ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS public_fields JSONB NOT NULL DEFAULT '["self_introduction", "skills", "communication_style", "consultation_style", "free_description", "realtime_status"]'::jsonb;

CREATE INDEX IF NOT EXISTS profile_cards_slug_idx ON public.profile_cards (slug) WHERE is_public = true;

-- 公開されているカードは認証なし（anon）およびauthenticatedでも参照可能にするポリシーを追加
DROP POLICY IF EXISTS "Public profile cards are viewable by everyone" ON public.profile_cards;
CREATE POLICY "Public profile cards are viewable by everyone"
ON public.profile_cards FOR SELECT
USING (is_public = true);

COMMIT;
