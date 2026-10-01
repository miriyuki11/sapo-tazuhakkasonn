import { AuthForm } from "@/src/components/auth/AuthForm"
import { AuthFunctionsTest } from "@/src/components/auth/AuthFunctionsTest"

export default function TestAuthPage() {
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
            </div>
        </main>
    )
}