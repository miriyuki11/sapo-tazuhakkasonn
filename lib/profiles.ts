import { supabase } from "@/lib/supabase";

export type TagCategory = {
  id: string;
  name: string;
  description?: string | null;
  profile_tags?: ProfileTag[];
};

export type ProfileTag = {
  id: string;
  name: string;
  color_hex?: string | null;
  category_id?: string;
  category_name?: string | null;
  category?: {
    id: string;
    name: string;
    description?: string | null;
  } | null;
};

export type TeamInfo = {
  id: string;
  name: string;
  description?: string | null;
};

export type ProfileCard = {
  id?: string;
  user_id?: string;
  self_introduction?: string | null;
  bio?: string | null;
  skills?: string | null;
  communication_style?: string | null;
  consultation_style?: string | null;
  free_description?: string | null;
  realtime_status?: string | null;
  team_id?: string | null;
  team?: TeamInfo | null;
  created_at?: string;
  updated_at?: string;
  tags?: ProfileTag[];
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
};

export type ProfileInput = {
  self_introduction?: string | null;
  bio?: string | null;
  skills?: string | null;
  communication_style?: string | null;
  consultation_style?: string | null;
  free_description?: string | null;
  realtime_status?: string | null;
  team_id?: string | null;
  tag_ids?: string[];
  username?: string;
  full_name?: string | null;
  avatar_url?: string | null;
};

export type ProfileResponse<T> = {
  data: T | null;
  error: string | null;
};

/**
 * プロフィール情報を取得する
 * @param userId 指定しない場合はログイン中ユーザーのプロフィールを取得
 */
export async function getProfile(
  userId?: string
): Promise<ProfileResponse<ProfileCard>> {
  try {
    const query = userId ? `?user_id=${encodeURIComponent(userId)}` : "";
    const { data, error } = await supabase.functions.invoke(`profiles${query}`, {
      method: "GET",
    });

    if (error) {
      console.error("Failed to fetch profile:", error);
      return { data: null, error: error.message };
    }

    return { data: data?.profile ?? null, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "プロフィールの取得に失敗しました";
    console.error("Error in getProfile:", err);
    return { data: null, error: message };
  }
}

/**
 * プロフィールを新規作成または保存（Upsert）する
 */
export async function saveProfile(
  input: ProfileInput
): Promise<ProfileResponse<ProfileCard>> {
  try {
    const { data, error } = await supabase.functions.invoke("profiles", {
      method: "POST",
      body: input,
    });

    if (error) {
      console.error("Failed to save profile:", error);
      return { data: null, error: error.message };
    }

    return { data: data?.profile ?? null, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "プロフィールの保存に失敗しました";
    console.error("Error in saveProfile:", err);
    return { data: null, error: message };
  }
}

/**
 * プロフィールを部分更新する
 */
export async function updateProfile(
  input: Partial<ProfileInput>
): Promise<ProfileResponse<ProfileCard>> {
  try {
    const { data, error } = await supabase.functions.invoke("profiles", {
      method: "PATCH",
      body: input,
    });

    if (error) {
      console.error("Failed to update profile:", error);
      return { data: null, error: error.message };
    }

    return { data: data?.profile ?? null, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "プロフィールの更新に失敗しました";
    console.error("Error in updateProfile:", err);
    return { data: null, error: message };
  }
}

/**
 * 自身のプロフィールを削除する
 */
export async function deleteProfile(): Promise<ProfileResponse<boolean>> {
  try {
    const { error } = await supabase.functions.invoke("profiles", {
      method: "DELETE",
    });

    if (error) {
      console.error("Failed to delete profile:", error);
      return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "プロフィールの削除に失敗しました";
    console.error("Error in deleteProfile:", err);
    return { data: null, error: message };
  }
}

/**
 * 選択可能なタグ分類・タグ一覧マスタを取得する
 */
export async function getTagCategories(): Promise<ProfileResponse<TagCategory[]>> {
  try {
    const { data, error } = await supabase.functions.invoke("profiles?tags_master=true", {
      method: "GET",
    });

    if (error) {
      console.error("Failed to fetch tag categories:", error);
      return { data: null, error: error.message };
    }

    return { data: data?.categories ?? [], error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "タグ一覧の取得に失敗しました";
    console.error("Error in getTagCategories:", err);
    return { data: null, error: message };
  }
}

