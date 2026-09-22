import { getMembers } from "../data";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    members: getMembers(),
  });
}
