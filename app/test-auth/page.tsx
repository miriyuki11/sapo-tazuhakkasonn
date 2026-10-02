"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AuthForm } from "@/src/components/auth/AuthForm";
import { AuthFunctionsTest } from "@/src/components/auth/AuthFunctionsTest";
import PrivateNote from "@/components/PrivateNote/PrivateNote";
import ProfileCard from "@/src/components/ProfileCard";
import UserProfileCard from "@/src/components/UserProfileCard";

export default function TestAuthPage() {
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setCurrentUserId(session?.user.id ?? null);
        });
        void supabase.auth.getSession().then(({ data: { session } }) => {
            if (active) {
                setCurrentUserId(session?.user.id ?? null);
            }
        });

        return () => {
            active = false;
            subscription.unsubscribe();
        };
    }, []);

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
            <div className="w-full max-w-lg space-y-6">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h1 className="mb-6 text-center text-xl font-bold text-slate-700 dark:text-slate-200">
                        【動作確認用】認証フォームテスト
                    </h1>
                    <AuthForm />
                </div>
                <AuthFunctionsTest />
                
                {/* ステップ4: 個人メモ関連操作ボタン（編集・キャンセル・削除）を持つ UserProfileCard */}
                {currentUserId ? <div className="w-full">
                    <h2 className="text-lg font-bold mb-3 text-gray-700">【ステップ4 動作確認】個人メモ一覧・編集・キャンセル・削除</h2>
                    <UserProfileCard
                        targetUserId={currentUserId}
                        userName="鈴木 一郎"
                        email="ichiro.suzuki@example.com"
                        role="テックリード"
                    />
                </div> : <p>メモの動作確認にはログインしてください。</p>}

                {/* ステップ3: 他メンバーのプロフィールカード & 個人メモエディタ */}
                {currentUserId ? <div className="w-full">
                    <h2 className="text-lg font-bold mb-3 text-gray-700">【ステップ3 動作確認】プロフィールカード & 個人メモ</h2>
                    <ProfileCard
                        profileId={currentUserId}
                        profileName="佐藤 健太"
                        email="kenta.sato@example.com"
                        role="シニアエンジニア"
                    />
                </div> : null}

                <div className="w-full">
                    <PrivateNote />
                </div>
            </div>
        </main>
    );
}