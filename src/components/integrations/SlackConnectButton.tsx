"use client";

import { useState } from "react";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { supabase } from "@/lib/supabase";

type SlackOAuthStartResponse = {
    authorize_url?: unknown;
};

export function SlackConnectButton() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function startSlackOAuth() {
        setLoading(true);
        setError("");

        try {
            const {
                data: { session },
                error: sessionError,
            } = await supabase.auth.getSession();

            if (sessionError || !session) {
                setError("連携を始めるにはIntrocardにログインしてください。");
                return;
            }

            const { data, error: functionError } = await supabase.functions.invoke(
                "slack-oauth",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                    },
                },
            );

            if (functionError) {
                console.error("Failed to start Slack OAuth:", functionError);
                setError("Slack連携を開始できませんでした。時間をおいて再度お試しください。");
                return;
            }

            const response = data as SlackOAuthStartResponse | null;
            if (typeof response?.authorize_url !== "string") {
                setError("Slackの認証URLを取得できませんでした。");
                return;
            }

            const authorizeUrl = new URL(response.authorize_url);
            if (
                authorizeUrl.protocol !== "https:" ||
                authorizeUrl.hostname !== "slack.com" ||
                authorizeUrl.pathname !== "/oauth/v2/authorize"
            ) {
                setError("Slackの認証URLが不正です。");
                return;
            }

            window.location.assign(authorizeUrl.toString());
        } catch (cause) {
            console.error("Unexpected error starting Slack OAuth:", cause);
            setError("Slack連携を開始できませんでした。時間をおいて再度お試しください。");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div>
            <Button type="button" onClick={startSlackOAuth} disabled={loading}>
                {loading ? (
                    <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : (
                    <ArrowUpRight aria-hidden="true" />
                )}
                {loading ? "Slackに接続中..." : "Slackと連携する"}
            </Button>
            {error && (
                <p className="mt-2 text-sm text-destructive" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}