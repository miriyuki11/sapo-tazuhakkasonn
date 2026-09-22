import { createTeam, getTeam, parseTeamRequestBody } from "./data";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    team: getTeam(),
  });
}

export async function POST(request: Request) {
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

  return Response.json(
    {
      team: createTeam(payload),
    },
    {
      status: 201,
    }
  );
}
