import { updateTeam } from "../data";

type TeamRequestBody = {
  name?: unknown;
  description?: unknown;
  memberIds?: unknown;
};

function parseTeamRequestBody(body: TeamRequestBody) {
  if (
    typeof body.name !== "string" ||
    !body.name.trim() ||
    typeof body.description !== "string" ||
    !Array.isArray(body.memberIds) ||
    !body.memberIds.every((memberId) => typeof memberId === "string")
  ) {
    return null;
  }

  return {
    name: body.name.trim(),
    description: body.description.trim(),
    memberIds: body.memberIds,
  };
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/team/[id]">
) {
  const { id } = await context.params;
  const body: TeamRequestBody = await request.json();
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
