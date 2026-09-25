import { AuthForm } from "@/src/components/auth/AuthForm";

export default function LoginPage() {
    return (
        <main className="flex min-h-screen items-center justify-center p-4">
            {/* 画面の中央に認証フォームを配置 */}
            <div className="w-full max-w-md rounded-xl border bg-white p-5 shadow-md dark:bg-slate-900 dark:border-slate-800">
                <AuthForm />
            </div>
        </main>
    );
}