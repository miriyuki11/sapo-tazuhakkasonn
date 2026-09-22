import type { NextRequest } from "next/server";

import { parseTeamRequestBody, updateTeam } from "../data";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await request.json();
  const payload = parseTeamRequestBody(body);

  if (!payload) {
    return Response.json(
      {
        error: "入力内容が正しくありません。",
      },
      {
        status: 400,
      }
    );
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
}
