import type { User } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase-server";

type AuthenticatedHandler<Args extends unknown[]> = (
  ...args: [...Args, user: User]
) => Response | Promise<Response>;

export function withAuth<Args extends unknown[]>(
  handler: AuthenticatedHandler<Args>
) {
  return async (...args: Args): Promise<Response> => {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    return handler(...args, user);
  };
}