"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export default function VerifyEmailPage() {
    const router = useRouter()
    const [isChecking, setIsChecking] = useState(true)

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession()

            // メール確認後、セッションが取得できたらホーム画面へ
            if (session) {
                router.push("/")
            } else {
                setIsChecking(false)
            }
        }

        checkAuth()
    }, [router])

    if (isChecking) {
        return (
            <main className="flex min-h-screen items-center justify-center p-4">
                <div className="w-full max-w-md rounded-xl border bg-white p-8 shadow-md dark:bg-slate-900 dark:border-slate-800 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border border-gray-300 border-t-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-300">認証を確認中...</p>
                </div>
            </main>
        )
    }

    return (
        <main className="flex min-h-screen items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl border bg-white p-8 shadow-md dark:bg-slate-900 dark:border-slate-800">
                <h1 className="text-2xl font-bold text-center mb-6">
                    メールを確認してください
                </h1>

                <div className="space-y-4 text-gray-700 dark:text-gray-300">
                    <p>
                        ご登録いただいたメールアドレスに確認メールを送信しました。
                    </p>
                    <p>
                        メール内のリンクをクリックして、アカウント認証を完了してください。
                    </p>
                    <p>
                        認証が完了すると、自動的にホーム画面へ遷移します。
                    </p>
                </div>

                <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        <strong>メールが届かない場合：</strong>
                        <br />
                        スパムフォルダを確認するか、ログインページで再度サインアップしてください。
                    </p>
                </div>
            </div>
        </main>
    )
}
