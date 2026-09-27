import { createServerSupabaseClient } from "@/lib/supabase-server";

function redirect(request: Request, path: string) {
    return Response.redirect(new URL(path, request.url));
}

export async function GET(request: Request) {
    const callbackUrl = new URL(request.url);
    const code = callbackUrl.searchParams.get("code");
    const tokenHash = callbackUrl.searchParams.get("token_hash");
    const type = callbackUrl.searchParams.get("type");

    if (!code && !(tokenHash && (type === "signup" || type === "email"))) {
        return redirect(request, "/login?error=auth_callback");
    }

    const supabase = await createServerSupabaseClient();
    const { error } = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : await supabase.auth.verifyOtp({
            token_hash: tokenHash!,
            type: type as "signup" | "email",
        });

    if (error) {
        return redirect(request, "/login?error=auth_callback");
    }

    return redirect(request, "/");
}