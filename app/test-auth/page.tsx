import { AuthForm } from "@/src/components/auth/AuthForm"

export default function TestAuthPage() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
            <div className="w-full max-w-md">
                <h1 className="mb-6 text-center text-xl font-bold text-slate-700">
                    【動作確認用】認証フォームテスト
                </h1>
                <AuthForm />
            </div>
        </main>
    )
}