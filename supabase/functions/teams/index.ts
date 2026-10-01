import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../types/supabase.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req: Request) => {
  // CORS プリフライト処理
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: "Missing Supabase environment variables." }, 500);
  }

  // URL パスから team_id および サブリソース (members) を抽出
  const url = new URL(req.url);
  const pathSegments = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);

  let teamId: string | null = null;
  let isMembersSubresource = false;

  const teamsIndex = pathSegments.indexOf("teams");
  if (teamsIndex !== -1) {
    if (pathSegments.length > teamsIndex + 1) {
      teamId = pathSegments[teamsIndex + 1];
    }
    if (pathSegments.length > teamsIndex + 2 && pathSegments[teamsIndex + 2] === "members") {
      isMembersSubresource = true;
    }
  } else {
    if (pathSegments.length >= 1) {
      teamId = pathSegments[0];
    }
    if (pathSegments.length >= 2 && pathSegments[1] === "members") {
      isMembersSubresource = true;
    }
  }

  // 認証ヘッダーの取得と検証
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Unauthorized", details: "Authorization header missing" }, 401);
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return jsonResponse({ error: "Unauthorized", details: "Invalid Authorization header format" }, 401);
  }

  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const adminClient = supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { persistSession: false },
      })
    : null;

  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser(token);

  if (authError || !user) {
    console.error("Authentication error:", authError?.message);
    return jsonResponse(
      { error: "Unauthorized", details: authError?.message ?? "Invalid user" },
      401,
    );
  }

  const currentUserId = user.id;

  // チームのオーナー権限チェック用ヘルパー関数
  async function checkTeamOwner(targetTeamId: string) {
    const dbClient = adminClient ?? supabaseClient;
    const { data: team, error: teamError } = await dbClient
      .from("teams")
      .select("id, owner_id")
      .eq("id", targetTeamId)
      .maybeSingle();

    if (teamError) {
      console.error("Error querying team:", teamError.message);
      return { error: "Failed to check team", status: 500, isOwner: false, team: null };
    }

    if (!team) {
      return { error: "Team not found", status: 404, isOwner: false, team: null };
    }

    if (team.owner_id !== currentUserId) {
      return {
        error: "Forbidden. Only the team owner can perform this operation.",
        status: 403,
        isOwner: false,
        team,
      };
    }

    return { error: null, status: 200, isOwner: true, team };
  }

  try {
    // =============================================================
    // メンバー管理: /functions/teams/:team_id/members
    // =============================================================
    if (isMembersSubresource) {
      if (!teamId) {
        return jsonResponse({ error: "team_id is required" }, 400);
      }

      // -------------------------------------------------------------
      // POST /functions/teams/:team_id/members : メンバー追加
      // -------------------------------------------------------------
      if (req.method === "POST") {
        const ownerCheck = await checkTeamOwner(teamId);
        if (!ownerCheck.isOwner) {
          return jsonResponse({ error: ownerCheck.error }, ownerCheck.status);
        }

        let body: unknown;
        try {
          body = await req.json();
        } catch {
          return jsonResponse({ error: "Invalid JSON body" }, 400);
        }

        if (!body || typeof body !== "object") {
          return jsonResponse({ error: "Request body must be an object" }, 400);
        }

        const { user_id: targetUserId, role } = body as { user_id?: unknown; role?: unknown };

        if (!targetUserId || typeof targetUserId !== "string" || targetUserId.trim() === "") {
          return jsonResponse(
            { error: "user_id is required and must be a non-empty string." },
            400,
          );
        }

        const memberUserId = targetUserId.trim();

        // UUID 形式バリデーション
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(memberUserId)) {
          return jsonResponse(
            { error: "Invalid user_id format. Must be a valid UUID." },
            400,
          );
        }

        const dbClient = adminClient ?? supabaseClient;

        // ユーザーが存在するかチェック (adminClient が利用可能な場合)
        if (adminClient) {
          const { data: targetUser, error: getUserError } = await adminClient.auth.admin.getUserById(memberUserId);
          if (getUserError || !targetUser?.user) {
            return jsonResponse({ error: "User not found." }, 404);
          }
        }

        // 既にメンバーであるかチェック
        const { data: existingMember } = await dbClient
          .from("team_members")
          .select("user_id")
          .eq("team_id", teamId)
          .eq("user_id", memberUserId)
          .maybeSingle();

        if (existingMember) {
          return jsonResponse({ error: "User is already a member of this team." }, 409);
        }

        let normalizedRole = "member";
        if (typeof role === "string") {
          const r = role.trim().toLowerCase();
          if (r === "owner" || r === "オーナー") {
            normalizedRole = "owner";
          } else if (r === "admin" || r === "管理者") {
            normalizedRole = "admin";
          } else {
            normalizedRole = "member";
          }
        }

        // メンバーを追加
        const { data: newMember, error: insertError } = await dbClient
          .from("team_members")
          .insert({
            team_id: teamId,
            user_id: memberUserId,
            role: normalizedRole,
          })
          .select()
          .single();

        if (insertError || !newMember) {
          if (insertError?.code === "23505") {
            return jsonResponse({ error: "User is already a member of this team." }, 409);
          }
          if (insertError?.code === "23503") {
            return jsonResponse({ error: "User not found." }, 404);
          }
          console.error("Error adding team member:", insertError?.message);
          return jsonResponse(
            { error: "Failed to add team member", details: insertError?.message },
            500,
          );
        }

        return jsonResponse(
          { message: "Member added successfully", member: newMember },
          201,
        );
      }

      // -------------------------------------------------------------
      // DELETE /functions/teams/:team_id/members : メンバー削除
      // -------------------------------------------------------------
      if (req.method === "DELETE") {
        const ownerCheck = await checkTeamOwner(teamId);
        if (!ownerCheck.isOwner) {
          return jsonResponse({ error: ownerCheck.error }, ownerCheck.status);
        }

        let body: unknown;
        try {
          body = await req.json();
        } catch {
          return jsonResponse({ error: "Invalid JSON body" }, 400);
        }

        if (!body || typeof body !== "object") {
          return jsonResponse({ error: "Request body must be an object" }, 400);
        }

        const { user_id: targetUserId } = body as { user_id?: unknown };

        if (!targetUserId || typeof targetUserId !== "string" || targetUserId.trim() === "") {
          return jsonResponse(
            { error: "user_id is required and must be a non-empty string." },
            400,
          );
        }

        const memberUserId = targetUserId.trim();

        // オーナー自身の削除は拒否
        if (ownerCheck.team && memberUserId === ownerCheck.team.owner_id) {
          return jsonResponse({ error: "Cannot remove team owner from members." }, 400);
        }

        const dbClient = adminClient ?? supabaseClient;

        // メンバーを削除 (count: 'exact' で影響行数をチェック)
        const { count, error: deleteError } = await dbClient
          .from("team_members")
          .delete({ count: "exact" })
          .eq("team_id", teamId)
          .eq("user_id", memberUserId);

        if (deleteError) {
          console.error("Error removing team member:", deleteError.message);
          return jsonResponse(
            { error: "Failed to remove team member", details: deleteError.message },
            500,
          );
        }

        if (count === 0) {
          return jsonResponse({ error: "Team member not found in this team." }, 404);
        }

        return jsonResponse({ message: "Team member removed successfully" }, 200);
      }

      return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    // =============================================================
    // チーム本体: /functions/teams (および /functions/teams/:team_id)
    // =============================================================

    // -------------------------------------------------------------
    // GET /functions/teams/:team_id : チーム情報取得
    // -------------------------------------------------------------
    if (req.method === "GET") {
      if (!teamId) {
        return jsonResponse({ error: "team_id is required" }, 400);
      }

      const dbClient = adminClient ?? supabaseClient;

      const { data: team, error: fetchError } = await dbClient
        .from("teams")
        .select("*")
        .eq("id", teamId)
        .maybeSingle();

      if (fetchError) {
        console.error("Error fetching team:", fetchError.message);
        return jsonResponse(
          { error: "Failed to fetch team", details: fetchError.message },
          500,
        );
      }

      if (!team) {
        return jsonResponse(
          { error: "Team not found." },
          404,
        );
      }

      // 所属チェック: オーナーまたはメンバーか確認
      const isOwner = team.owner_id === currentUserId;
      let isMember = false;

      if (!isOwner) {
        const { data: member } = await dbClient
          .from("team_members")
          .select("user_id")
          .eq("team_id", teamId)
          .eq("user_id", currentUserId)
          .maybeSingle();

        if (member) {
          isMember = true;
        }
      }

      if (!isOwner && !isMember) {
        return jsonResponse(
          { error: "Forbidden. You do not have permission to view this team." },
          403,
        );
      }

      return jsonResponse(team, 200);
    }

    // -------------------------------------------------------------
    // POST /functions/teams : チーム作成
    // -------------------------------------------------------------
    if (req.method === "POST" && !teamId) {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
      }

      if (!body || typeof body !== "object") {
        return jsonResponse({ error: "Request body must be an object" }, 400);
      }

      const { name, description } = body as { name?: unknown; description?: unknown };

      if (!name || typeof name !== "string" || name.trim() === "") {
        return jsonResponse(
          { error: "Team name is required and must be a non-empty string." },
          400,
        );
      }

      if (description !== undefined && description !== null && typeof description !== "string") {
        return jsonResponse(
          { error: "Description must be a string." },
          400,
        );
      }

      const dbClient = adminClient ?? supabaseClient;
      const { data: team, error: insertError } = await dbClient
        .from("teams")
        .insert({
          name: name.trim(),
          description: typeof description === "string" && description.trim() ? description.trim() : null,
          owner_id: currentUserId,
        })
        .select()
        .single();

      if (insertError || !team) {
        if (insertError?.code === "23505") {
          return jsonResponse(
            { error: "Team with this name already exists." },
            409,
          );
        }
        console.error("Error creating team:", insertError?.message);
        return jsonResponse(
          { error: "Failed to create team", details: insertError?.message },
          500,
        );
      }

      return jsonResponse(team, 201);
    }

    // -------------------------------------------------------------
    // PUT /functions/teams/:team_id : チーム情報更新
    // -------------------------------------------------------------
    if (req.method === "PUT") {
      if (!teamId) {
        return jsonResponse({ error: "team_id is required" }, 400);
      }

      // オーナー権限チェック（チームが存在しない場合は404、オーナー以外なら403）
      const ownerCheck = await checkTeamOwner(teamId);
      if (!ownerCheck.isOwner) {
        return jsonResponse({ error: ownerCheck.error }, ownerCheck.status);
      }

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return jsonResponse({ error: "Invalid request body" }, 400);
      }

      if (!body || typeof body !== "object") {
        return jsonResponse({ error: "Invalid request body" }, 400);
      }

      const updateData = body as { name?: unknown; description?: unknown };

      if (updateData.name !== undefined && (typeof updateData.name !== "string" || updateData.name.trim() === "")) {
        return jsonResponse({ error: "Team name must be a non-empty string" }, 400);
      }

      if (updateData.description !== undefined && updateData.description !== null && typeof updateData.description !== "string") {
        return jsonResponse({ error: "Team description must be a string" }, 400);
      }

      if (updateData.name === undefined && updateData.description === undefined) {
        return jsonResponse({ error: "No valid fields provided for update" }, 400);
      }

      const fieldsToUpdate: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updateData.name !== undefined) {
        fieldsToUpdate.name = (updateData.name as string).trim();
      }

      if (updateData.description !== undefined) {
        fieldsToUpdate.description = typeof updateData.description === "string" && updateData.description.trim()
          ? updateData.description.trim()
          : null;
      }

      const dbClient = adminClient ?? supabaseClient;
      const { data: team, error: updateError } = await dbClient
        .from("teams")
        .update(fieldsToUpdate)
        .eq("id", teamId)
        .select()
        .single();

      if (updateError || !team) {
        console.error("Error updating team:", updateError?.message);
        return jsonResponse(
          { error: "Failed to update team", details: updateError?.message },
          500,
        );
      }

      return jsonResponse(team, 200);
    }

    if (req.method !== "GET" && req.method !== "POST" && req.method !== "PUT" && req.method !== "DELETE") {
      return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    return jsonResponse({ error: "Not Found" }, 404);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "An unexpected error occurred";
    console.error("Unexpected error:", message);
    return jsonResponse(
      { error: "An unexpected error occurred", details: message },
      500,
    );
  }
});
