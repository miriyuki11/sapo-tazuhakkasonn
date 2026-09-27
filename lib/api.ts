import type { User } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase-server";

export type RouteContext = { params?: Promise<Record<string, string>> };

type AuthenticatedHandler = (
  request: Request,
  context: RouteContext,
  user: User
) => Response | Promise<Response>;

// Next.js always calls route handlers with (request, context), even for static routes; keep the arity fixed so it never shifts into `user`.
export function withAuth(handler: AuthenticatedHandler) {
  return async (
    request: Request,
    context: RouteContext = {}
  ): Promise<Response> => {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    return handler(request, context, user);
  };
}