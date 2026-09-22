import { createTeam, getTeam } from "./data";

export const dynamic = "force-dynamic";

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

export function GET() {
  return Response.json({
    team: getTeam(),
  });
}

export async function POST(request: Request) {
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

  return Response.json(
    {
      team: createTeam(payload),
    },
    {
      status: 201,
    }
  );
}
