import type { NextRequest } from "next/server";

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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
}
