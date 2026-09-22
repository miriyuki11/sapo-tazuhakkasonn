import { createTeam, getTeam, parseTeamRequestBody } from "./data";

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

export function GET() {
  return Response.json({
    team: getTeam(),
  });
}

export async function POST(request: Request) {
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
}
