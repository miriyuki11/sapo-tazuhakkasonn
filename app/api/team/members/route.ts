import { getMembers } from "../data";

export function GET() {
  return Response.json({
    members: getMembers(),
  });
}
