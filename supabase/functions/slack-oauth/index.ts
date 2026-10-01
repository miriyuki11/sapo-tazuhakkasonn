import { createClient } from "@supabase/supabase-js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:3000",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(
    handler: (request: Request) => Response | Promise<Response>,
  ): void;
};

Deno.serve(async (request: Request) => {
    if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const response = await (async () => {
  const url = new URL(request.url);

  if (request.method === "POST") {
    const authorization = request.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return Response.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authorization } },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      return Response.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    const slackClientId = Deno.env.get("SLACK_CLIENT_ID");
    const slackRedirectUri = Deno.env.get("SLACK_REDIRECT_URI");
    if (!slackClientId || !slackRedirectUri) {
      return Response.json(
        { error: "Slack OAuth configuration is missing" },
        { status: 500 },
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const stateBytes = crypto.getRandomValues(new Uint8Array(32));
    const state = Array.from(stateBytes, (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");

    const stateHashBytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(state),
    );
    const stateHash = Array.from(new Uint8Array(stateHashBytes), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");

    const { error: stateError } = await admin
      .from("slack_oauth_states")
      .insert({
        state_hash: stateHash,
        user_id: user.id,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    if (stateError) {
      console.error("Failed to store Slack OAuth state:", stateError);
      return Response.json(
        { error: "Could not start OAuth" },
        { status: 500 },
      );
    }

    const authorizeUrl = new URL("https://slack.com/oauth/v2/authorize");
    authorizeUrl.searchParams.set("client_id", slackClientId);
    authorizeUrl.searchParams.set("scope", "commands,links:read,links:write,users:read");
    authorizeUrl.searchParams.set("user_scope", "users:read");
    authorizeUrl.searchParams.set("redirect_uri", slackRedirectUri);
    authorizeUrl.searchParams.set("state", state);

    return Response.json({ authorize_url: authorizeUrl.toString() });
  }

  if (request.method === "GET") {
    const state = url.searchParams.get("state");

    if (!state) {
      return Response.json({ error: "Missing state" }, { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    const slackClientId = Deno.env.get("SLACK_CLIENT_ID");
    const slackClientSecret = Deno.env.get("SLACK_CLIENT_SECRET");
    const slackRedirectUri = Deno.env.get("SLACK_REDIRECT_URI");

    if (!slackClientId || !slackClientSecret || !slackRedirectUri) {
      return Response.json(
        { error: "Slack OAuth configuration is missing" },
        { status: 500 },
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const stateHashBytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(state),
    );
    const stateHash = Array.from(new Uint8Array(stateHashBytes), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");

    const { data: savedState, error } = await admin
      .from("slack_oauth_states")
      .delete()
      .eq("state_hash", stateHash)
      .gt("expires_at", new Date().toISOString())
      .select("user_id")
      .maybeSingle();

    if (error) {
      console.error("Failed to consume Slack OAuth state:", error);
      return Response.json({ error: "Callback failed" }, { status: 500 });
    }

    if (!savedState) {
      return Response.json(
        { error: "Invalid, expired, or already-used state" },
        { status: 400 },
      );
    }

    const slackError = url.searchParams.get("error");
    if (slackError) {
      return Response.json(
        { error: "Slack authorization was not granted" },
        { status: 400 },
      );
    }

    const code = url.searchParams.get("code");
    if (!code) {
      return Response.json({ error: "Missing authorization code" }, { status: 400 });
    }

    const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${slackClientId}:${slackClientSecret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        redirect_uri: slackRedirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenPayload: unknown = await tokenResponse.json().catch(() => null);
    if (!tokenResponse.ok || !isRecord(tokenPayload) || tokenPayload.ok !== true) {
      const slackError = isRecord(tokenPayload) && typeof tokenPayload.error === "string"
        ? tokenPayload.error
        : "unexpected response";
      console.error("Slack OAuth token exchange failed:", slackError);
      return Response.json(
        { error: "Slack token exchange failed" },
        { status: 502 },
      );
    }

    const team = isRecord(tokenPayload.team) ? tokenPayload.team : null;
    const authedUser = isRecord(tokenPayload.authed_user)
      ? tokenPayload.authed_user
      : null;
    const teamId = team?.id;
    const slackUserId = authedUser?.id;
    const accessToken = tokenPayload.access_token;

    if (
      typeof teamId !== "string" ||
      typeof slackUserId !== "string" ||
      typeof accessToken !== "string"
    ) {
      console.error("Slack OAuth response is missing required installation fields");
      return Response.json(
        { error: "Slack response was missing installation details" },
        { status: 502 },
      );
    }

    const { data: existingConnection, error: connectionLookupError } = await admin
      .from("user_slack_connections")
      .select("user_id")
      .eq("slack_team_id", teamId)
      .eq("slack_user_id", slackUserId)
      .maybeSingle();

    if (connectionLookupError) {
      console.error("Failed to check Slack user connection:", connectionLookupError);
      return Response.json({ error: "Could not save Slack connection" }, { status: 500 });
    }

    if (existingConnection && existingConnection.user_id !== savedState.user_id) {
      return Response.json(
        { error: "This Slack account is linked to another app user" },
        { status: 409 },
      );
    }

    const { data: existingIntegration, error: integrationLookupError } = await admin
      .from("slack_integrations")
      .select("team_id")
      .eq("team_id", teamId)
      .maybeSingle();

    if (integrationLookupError) {
      console.error("Failed to check Slack workspace integration:", integrationLookupError);
      return Response.json({ error: "Could not save Slack installation" }, { status: 500 });
    }

    const integrationData = {
      team_name: typeof team?.name === "string" ? team.name : null,
      slack_installer_user_id: slackUserId,
      access_token: accessToken,
      refresh_token: typeof tokenPayload.refresh_token === "string"
        ? tokenPayload.refresh_token
        : null,
      scope: typeof tokenPayload.scope === "string" ? tokenPayload.scope : null,
      bot_user_id: typeof tokenPayload.bot_user_id === "string"
        ? tokenPayload.bot_user_id
        : null,
      updated_at: new Date().toISOString(),
    };

    const integrationWrite = existingIntegration
      ? await admin
        .from("slack_integrations")
        .update(integrationData)
        .eq("team_id", teamId)
      : await admin
        .from("slack_integrations")
        .insert({
          ...integrationData,
          team_id: teamId,
          installer_user_id: savedState.user_id,
        });

    if (integrationWrite.error) {
      console.error("Failed to save Slack workspace integration:", integrationWrite.error);
      return Response.json({ error: "Could not save Slack installation" }, { status: 500 });
    }

    const { error: connectionWriteError } = await admin
      .from("user_slack_connections")
      .upsert(
        {
          user_id: savedState.user_id,
          slack_team_id: teamId,
          slack_user_id: slackUserId,
        },
        { onConflict: "user_id,slack_team_id" },
      );

    if (connectionWriteError) {
      console.error("Failed to save Slack user connection:", connectionWriteError);
      return Response.json({ error: "Could not save Slack user connection" }, { status: 500 });
    }

    return Response.json({ connected: true });
  }

      return Response.json({ error: "Not found" }, { status: 404 });
  })();

  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders)) {
    headers.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});