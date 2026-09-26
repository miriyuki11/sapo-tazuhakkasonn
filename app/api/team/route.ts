import { createTeam, getTeam, parseTeamRequestBody } from "./data";
import { withAuth } from "@/lib/api";
import type { User } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function invalidRequestResponse() {
  return Response.json(
    {
      error: "入力内容が正しくありません。",
    },
    {
      status: 400,
    }
  );
}

export const GET = withAuth(async (_request: Request, _user: User) => {
  void _request;
  void _user;

  return Response.json({
    team: getTeam(),
  });
});

export const POST = withAuth(async (request: Request, _user: User) => {
  void _user;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return invalidRequestResponse();
  }

  const payload = parseTeamRequestBody(body);

  if (!payload) {
    return invalidRequestResponse();
  }

  return Response.json(
    {
      team: createTeam(payload),
    },
    {
      status: 201,
    }
  );
});
