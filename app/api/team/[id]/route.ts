import type { User } from "@supabase/supabase-js";

import { withAuth } from "@/lib/api";
import { parseTeamRequestBody, updateTeam } from "../data";

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

export const PATCH = withAuth(async (
  request: Request,
  context: { params: Promise<{ id: string }> },
  _user: User
) => {
  void _user;

  const { id } = await context.params;
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

  const team = updateTeam(id, payload);

  if (!team) {
    return Response.json(
      {
        error: "チームが見つかりません。",
      },
      {
        status: 404,
      }
    );
  }

  return Response.json({
    team,
  });
});
