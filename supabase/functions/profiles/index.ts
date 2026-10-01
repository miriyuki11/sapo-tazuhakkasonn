import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

// CORS 設定
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

// JSON レスポンス生成ヘルパー
export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

// プロフィールバリデーションスキーマ (Zod)
// DBの profile_cards テーブルのカラムと、フロントエンドで使いやすい基本項目（bio, username, avatar_url等）をサポート
export const profileSchema = z.object({
  self_introduction: z.string().max(2000, "自己紹介は2000文字以内で入力してください").optional().nullable(),
  bio: z.string().max(2000, "自己紹介は2000文字以内で入力してください").optional().nullable(),
  skills: z.string().max(1000, "スキルは1000文字以内で入力してください").optional().nullable(),
  communication_style: z.string().max(1000, "コミュニケーションスタイルは1000文字以内で入力してください").optional().nullable(),
  consultation_style: z.string().max(1000, "相談スタイルは1000文字以内で入力してください").optional().nullable(),
  free_description: z.string().max(2000, "自由記述は2000文字以内で入力してください").optional().nullable(),
  realtime_status: z.string().max(200, "ステータスは200文字以内で入力してください").optional().nullable(),
  team_id: z.string().uuid("有効なUUID形式のteam_idを指定してください").optional().nullable(),
  tag_ids: z.array(z.string().uuid("各タグIDは有効なUUID形式である必要があります")).optional(),
  username: z.string().min(1, "ユーザー名は1文字以上で入力してください").optional(),
  full_name: z.string().optional().nullable(),
  avatar_url: z.string().url("有効なURLを入力してください").optional().nullable(),
});

export type ProfileInput = z.infer<typeof profileSchema>;

function formatProfileTags(profileCardTags: unknown) {
  if (!Array.isArray(profileCardTags)) {
    return [];
  }

  return profileCardTags
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const rawTag = (item as Record<string, unknown>).profile_tags;
      const tag = Array.isArray(rawTag) ? rawTag[0] : rawTag;
      if (!tag || typeof tag !== "object") return null;

      const tagObj = tag as Record<string, unknown>;
      const rawCategory = tagObj.tag_categories;
      const category = Array.isArray(rawCategory) ? rawCategory[0] : rawCategory;
      const categoryObj =
        category && typeof category === "object"
          ? (category as Record<string, unknown>)
          : null;

      return {
        id: String(tagObj.id ?? ""),
        name: String(tagObj.name ?? ""),
        color_hex: (tagObj.color_hex as string | null) ?? null,
        category_id: tagObj.category_id as string | undefined,
        category_name: (categoryObj?.name as string | null) ?? null,
        category: categoryObj
          ? {
              id: String(categoryObj.id ?? ""),
              name: String(categoryObj.name ?? ""),
              description: (categoryObj.description as string | null) ?? null,
            }
          : null,
      };
    })
    .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag && tag.id));
}

Deno.serve(async (req: Request) => {
  // CORS プリフライトリクエストの処理
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const pathname = url.pathname.replace(/\/+$/, "");
    const method = req.method;

    // 環境変数の取得
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("SUPABASE_URL or SUPABASE_ANON_KEY is not configured.");
    }

    // 認証ヘッダーの取得
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Authorization header missing" }, 401);
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return jsonResponse({ error: "Invalid Authorization header format" }, 401);
    }

    // Supabase クライアントの初期化（RLSを適用するため認証ヘッダーを渡す）
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    // JWT トークンの検証とユーザー情報の取得
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return jsonResponse({ error: "Invalid authentication token" }, 401);
    }

    const currentUserId = userData.user.id;

    // ルーティング判定（/profiles や /functions/v1/profiles 等に対応）
    const isProfilesEndpoint =
      pathname === "" ||
      pathname === "/" ||
      pathname.endsWith("/profiles") ||
      pathname.endsWith("/profiles/index");

    if (!isProfilesEndpoint) {
      return jsonResponse({ error: "Endpoint Not Found", pathname }, 404);
    }

    switch (method) {
      // -------------------------------------------------------------
      // GET: プロフィール情報の取得、またはタグ分類マスタの取得
      // -------------------------------------------------------------
      case "GET": {
        // タグ一覧マスタの取得 (?tags_master=true)
        if (url.searchParams.get("tags_master") === "true") {
          const { data: tagCategories, error: categoriesError } = await supabase
            .from("tag_categories")
            .select(`
              id,
              name,
              description,
              profile_tags (
                id,
                name,
                color_hex,
                category_id
              )
            `)
            .order("name", { ascending: true });

          if (categoriesError) {
            console.error("Error fetching tag categories:", categoriesError);
            return jsonResponse({ error: categoriesError.message }, 500);
          }

          return jsonResponse({ categories: tagCategories ?? [], status: "ok" }, 200);
        }

        // クエリパラメータ ?user_id= または ?target_user_id= で対象ユーザーを指定（未指定時は自身）
        const targetUserId =
          url.searchParams.get("target_user_id") ||
          url.searchParams.get("user_id") ||
          currentUserId;

        // profile_cards テーブル、関連タグ（分類・色属性含む）、所属チームを取得
        const { data: cards, error: fetchError } = await supabase
          .from("profile_cards")
          .select(`
            id,
            user_id,
            self_introduction,
            skills,
            communication_style,
            consultation_style,
            free_description,
            realtime_status,
            team_id,
            created_at,
            updated_at,
            teams:team_id (
              id,
              name,
              description
            ),
            profile_card_tags (
              profile_tag_id,
              profile_tags (
                id,
                name,
                color_hex,
                category_id,
                tag_categories (
                  id,
                  name,
                  description
                )
              )
            )
          `)
          .eq("user_id", targetUserId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (fetchError) {
          console.error("Error fetching profile card:", fetchError);
          return jsonResponse({ error: fetchError.message }, 500);
        }

        const card = cards && cards.length > 0 ? cards[0] : null;

        if (!card) {
          return jsonResponse(
            {
              message: "Profile not found",
              profile: null,
              userId: targetUserId,
            },
            200,
          );
        }

        // タグ一覧を配列として整形（分類名や色属性を含む）
        const tags = formatProfileTags(card.profile_card_tags);

        return jsonResponse({
          profile: {
            ...card,
            tags,
            team: card.teams ?? null,
            // 互換性および表示用のフィールド
            bio: card.self_introduction,
            username:
              userData.user.user_metadata?.user_name ||
              userData.user.user_metadata?.username ||
              userData.user.email?.split("@")[0],
            full_name:
              userData.user.user_metadata?.full_name ||
              userData.user.user_metadata?.name ||
              null,
            avatar_url: userData.user.user_metadata?.avatar_url || null,
          },
          status: "ok",
        }, 200);
      }

      // -------------------------------------------------------------
      // POST: プロフィールの新規作成・保存
      // -------------------------------------------------------------
      case "POST": {
        const body = await req.json().catch(() => null);
        if (!body || typeof body !== "object") {
          return jsonResponse({ error: "Request body must be a valid JSON object" }, 400);
        }

        const parseResult = profileSchema.safeParse(body);
        if (!parseResult.success) {
          return jsonResponse(
            {
              error: "Validation Error",
              details: parseResult.error.flatten(),
            },
            400,
          );
        }

        const data = parseResult.data;
        const selfIntroduction = data.self_introduction ?? data.bio ?? null;

        // 既存のプロフィールカードを確認（1ユーザー1枚）
        const { data: existingCards } = await supabase
          .from("profile_cards")
          .select("id")
          .eq("user_id", currentUserId)
          .limit(1);

        let savedCardId: string;

        if (existingCards && existingCards.length > 0) {
          // すでに存在していれば更新
          savedCardId = existingCards[0].id;
          const { error: updateError } = await supabase
            .from("profile_cards")
            .update({
              self_introduction: selfIntroduction,
              skills: data.skills ?? null,
              communication_style: data.communication_style ?? null,
              consultation_style: data.consultation_style ?? null,
              free_description: data.free_description ?? null,
              realtime_status: data.realtime_status ?? null,
              team_id: data.team_id ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", savedCardId);

          if (updateError) {
            console.error("Error updating profile card:", updateError);
            return jsonResponse({ error: updateError.message }, 500);
          }
        } else {
          // 新規作成
          const { data: insertedCard, error: insertError } = await supabase
            .from("profile_cards")
            .insert({
              user_id: currentUserId,
              self_introduction: selfIntroduction,
              skills: data.skills ?? null,
              communication_style: data.communication_style ?? null,
              consultation_style: data.consultation_style ?? null,
              free_description: data.free_description ?? null,
              realtime_status: data.realtime_status ?? null,
              team_id: data.team_id ?? null,
            })
            .select("id")
            .single();

          if (insertError || !insertedCard) {
            console.error("Error inserting profile card:", insertError);
            return jsonResponse({ error: insertError?.message ?? "Failed to create profile card" }, 500);
          }
          savedCardId = insertedCard.id;
        }

        // タグの紐付け処理
        if (data.tag_ids !== undefined) {
          await supabase.from("profile_card_tags").delete().eq("profile_card_id", savedCardId);

          if (data.tag_ids.length > 0) {
            const tagsToInsert = data.tag_ids.map((tagId) => ({
              profile_card_id: savedCardId,
              profile_tag_id: tagId,
            }));
            const { error: tagInsertError } = await supabase.from("profile_card_tags").insert(tagsToInsert);
            if (tagInsertError) {
              console.error("Error linking profile tags:", tagInsertError);
            }
          }
        }

        // ユーザーメタデータ（ユーザー名・アバター等）が渡されている場合は auth.updateUser で更新
        if (data.username || data.full_name || data.avatar_url) {
          const userMetadata: Record<string, unknown> = {
            ...(userData.user.user_metadata || {}),
          };
          if (data.username) userMetadata.user_name = data.username;
          if (data.full_name !== undefined) userMetadata.full_name = data.full_name;
          if (data.avatar_url !== undefined) userMetadata.avatar_url = data.avatar_url;

          await supabase.auth.updateUser({
            data: userMetadata,
          });
        }

        // 最新のプロフィール情報（チーム・タグ・分類情報付き）を取得して返却
        const { data: savedDetail } = await supabase
          .from("profile_cards")
          .select(`
            id,
            user_id,
            self_introduction,
            skills,
            communication_style,
            consultation_style,
            free_description,
            realtime_status,
            team_id,
            created_at,
            updated_at,
            teams:team_id (
              id,
              name,
              description
            ),
            profile_card_tags (
              profile_tag_id,
              profile_tags (
                id,
                name,
                color_hex,
                category_id,
                tag_categories (
                  id,
                  name,
                  description
                )
              )
            )
          `)
          .eq("id", savedCardId)
          .single();

        const formattedTags = formatProfileTags(savedDetail?.profile_card_tags);

        return jsonResponse(
          {
            message: "Profile saved successfully",
            profile: {
              ...savedDetail,
              tags: formattedTags,
              team: savedDetail?.teams ?? null,
              bio: savedDetail?.self_introduction,
            },
          },
          201,
        );
      }

      // -------------------------------------------------------------
      // PUT / PATCH: プロフィールの更新
      // -------------------------------------------------------------
      case "PUT":
      case "PATCH": {
        const body = await req.json().catch(() => null);
        if (!body || typeof body !== "object") {
          return jsonResponse({ error: "Request body must be a valid JSON object" }, 400);
        }

        const parseResult = profileSchema.safeParse(body);
        if (!parseResult.success) {
          return jsonResponse(
            {
              error: "Validation Error",
              details: parseResult.error.flatten(),
            },
            400,
          );
        }

        const data = parseResult.data;

        // 自身の既存プロフィールカードを検索
        const { data: existingCards } = await supabase
          .from("profile_cards")
          .select("id")
          .eq("user_id", currentUserId)
          .limit(1);

        let targetCardId: string;
        if (!existingCards || existingCards.length === 0) {
          // 存在しない場合は新規作成（UPSERT）
          const { data: created, error: createErr } = await supabase
            .from("profile_cards")
            .insert({
              user_id: currentUserId,
              self_introduction: data.self_introduction ?? data.bio ?? null,
              skills: data.skills ?? null,
              communication_style: data.communication_style ?? null,
              consultation_style: data.consultation_style ?? null,
              free_description: data.free_description ?? null,
              realtime_status: data.realtime_status ?? null,
              team_id: data.team_id ?? null,
            })
            .select("id")
            .single();

          if (createErr || !created) {
            return jsonResponse({ error: createErr?.message ?? "Failed to create profile" }, 500);
          }
          targetCardId = created.id;
        } else {
          targetCardId = existingCards[0].id;
          const updatePayload: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };

          if (data.self_introduction !== undefined) updatePayload.self_introduction = data.self_introduction;
          if (data.bio !== undefined && data.self_introduction === undefined) {
            updatePayload.self_introduction = data.bio;
          }
          if (data.skills !== undefined) updatePayload.skills = data.skills;
          if (data.communication_style !== undefined) updatePayload.communication_style = data.communication_style;
          if (data.consultation_style !== undefined) updatePayload.consultation_style = data.consultation_style;
          if (data.free_description !== undefined) updatePayload.free_description = data.free_description;
          if (data.realtime_status !== undefined) updatePayload.realtime_status = data.realtime_status;
          if (data.team_id !== undefined) updatePayload.team_id = data.team_id;

          const { error: updateError } = await supabase
            .from("profile_cards")
            .update(updatePayload)
            .eq("id", targetCardId);

          if (updateError) {
            return jsonResponse({ error: updateError.message }, 500);
          }
        }

        // タグの更新
        if (data.tag_ids !== undefined) {
          await supabase.from("profile_card_tags").delete().eq("profile_card_id", targetCardId);

          if (data.tag_ids.length > 0) {
            const tagsToInsert = data.tag_ids.map((tagId) => ({
              profile_card_id: targetCardId,
              profile_tag_id: tagId,
            }));
            await supabase.from("profile_card_tags").insert(tagsToInsert);
          }
        }

        // ユーザーメタデータの更新
        if (data.username || data.full_name !== undefined || data.avatar_url !== undefined) {
          const userMetadata: Record<string, unknown> = {
            ...(userData.user.user_metadata || {}),
          };
          if (data.username) userMetadata.user_name = data.username;
          if (data.full_name !== undefined) userMetadata.full_name = data.full_name;
          if (data.avatar_url !== undefined) userMetadata.avatar_url = data.avatar_url;

          await supabase.auth.updateUser({
            data: userMetadata,
          });
        }

        // 最新のプロフィール情報（チーム・タグ・分類情報付き）を取得して返却
        const { data: updatedCard } = await supabase
          .from("profile_cards")
          .select(`
            id,
            user_id,
            self_introduction,
            skills,
            communication_style,
            consultation_style,
            free_description,
            realtime_status,
            team_id,
            created_at,
            updated_at,
            teams:team_id (
              id,
              name,
              description
            ),
            profile_card_tags (
              profile_tag_id,
              profile_tags (
                id,
                name,
                color_hex,
                category_id,
                tag_categories (
                  id,
                  name,
                  description
                )
              )
            )
          `)
          .eq("id", targetCardId)
          .single();

        const formattedTags = formatProfileTags(updatedCard?.profile_card_tags);

        return jsonResponse(
          {
            message: "Profile updated successfully",
            profile: {
              ...updatedCard,
              tags: formattedTags,
              team: updatedCard?.teams ?? null,
              bio: updatedCard?.self_introduction,
            },
          },
          200,
        );
      }

      // -------------------------------------------------------------
      // DELETE: プロフィールの削除
      // -------------------------------------------------------------
      case "DELETE": {
        const { data: deleted, error: deleteError } = await supabase
          .from("profile_cards")
          .delete()
          .eq("user_id", currentUserId)
          .select("id");

        if (deleteError) {
          console.error("Error deleting profile card:", deleteError);
          return jsonResponse({ error: deleteError.message }, 500);
        }

        if (!deleted || deleted.length === 0) {
          return jsonResponse({ error: "Profile not found or already deleted" }, 404);
        }

        return jsonResponse(
          {
            message: "Profile deleted successfully",
            deletedCount: deleted.length,
            status: "ok",
          },
          200,
        );
      }

      default:
        return jsonResponse({ error: `Method ${method} Not Allowed` }, 405);
    }
  } catch (error: unknown) {
    const message = error instanceof Error
      ? error.message
      : "Internal Server Error";
    console.error("Error in profiles function:", error);
    return jsonResponse({ error: message }, 500);
  }
});
