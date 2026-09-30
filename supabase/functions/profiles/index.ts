import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL or anon key is not configured");
}

const inputSchema = z.object({
  self_introduction: z.string().max(5000).nullable().optional(),
  bio: z.string().max(5000).nullable().optional(),
  skills: z.string().max(2000).nullable().optional(),
  communication_style: z.string().max(2000).nullable().optional(),
  consultation_style: z.string().max(2000).nullable().optional(),
  free_description: z.string().max(5000).nullable().optional(),
  realtime_status: z.string().max(200).nullable().optional(),
  team_id: z.string().uuid().nullable().optional(),
  tag_ids: z.array(z.string().uuid()).max(50).optional(),
  username: z.string().max(100).optional(),
  full_name: z.string().max(200).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
});

const profileColumns =
  "id,user_id,self_introduction,bio,skills,communication_style,consultation_style,free_description,realtime_status,team_id,username,full_name,avatar_url,created_at,updated_at";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return response(null, 204);

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return response({ error: "Unauthorized" }, 401);

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return response({ error: "Unauthorized" }, 401);

  try {
    const url = new URL(request.url);
    if (request.method === "GET" && url.searchParams.get("tags_master") === "true") {
      const { data, error } = await client
        .from("profile_tag_categories")
        .select("id,name,description,profile_tags(id,name,color_hex,category_id)");
      if (error) return response({ error: error.message }, 400);
      return response({ categories: data ?? [] });
    }

    if (request.method === "GET") {
      const requestedUserId = url.searchParams.get("user_id") ?? user.id;
      const { data, error } = await client
        .from("profiles")
        .select(`${profileColumns},profile_tags_map(tag_id,profile_tags(id,name,color_hex,category_id))`)
        .eq("user_id", requestedUserId)
        .maybeSingle();
      if (error) return response({ error: error.message }, 400);
      return response({ profile: data });
    }

    if (request.method === "DELETE") {
      const { error } = await client.from("profiles").delete().eq("user_id", user.id);
      if (error) return response({ error: error.message }, 400);
      return response({ profile: null });
    }

    if (request.method === "POST" || request.method === "PUT" || request.method === "PATCH") {
      const parsed = inputSchema.safeParse(await request.json());
      if (!parsed.success) return response({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
      const { tag_ids, ...fields } = parsed.data;
      const { data: profile, error } = await client
        .from("profiles")
        .upsert({ ...fields, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
        .select(profileColumns)
        .single();
      if (error) return response({ error: error.message }, 400);

      if (tag_ids) {
        const { error: deleteError } = await client.from("profile_tags_map").delete().eq("profile_id", profile.id);
        if (deleteError) return response({ error: deleteError.message }, 400);
        if (tag_ids.length > 0) {
          const { error: insertError } = await client.from("profile_tags_map").insert(
            tag_ids.map((tag_id) => ({ profile_id: profile.id, tag_id })),
          );
          if (insertError) return response({ error: insertError.message }, 400);
        }
      }
      return response({ profile });
    }

    return response({ error: "Method not allowed" }, 405);
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
