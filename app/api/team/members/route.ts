import { getMembers } from "../data";
import { withAuth } from "@/lib/api";
import type { User } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_request: Request, _user: User) => {
  void _request;
  void _user;

  return Response.json({
    members: getMembers(),
  });
});
