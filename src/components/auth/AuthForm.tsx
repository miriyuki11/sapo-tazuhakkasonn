"use client"

import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useState } from "react"
import { Button } from "@/src/components/ui/button"
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from "@/src/components/ui/field"
import { Input } from "@/src/components/ui/input"

function getAuthErrorMessage(error: { code?: string; message: string }) {
    const details = `${error.code ?? ""} ${error.message}`.toLowerCase()

    if (details.includes("invalid_credentials") || details.includes("invalid login credentials")) {
        return "メールアドレスまたはパスワードが正しくありません。"
    }
    if (details.includes("user_already_exists") || details.includes("user already registered")) {
        return "このメールアドレスは既に登録されています。"
    }
    if (details.includes("email_not_confirmed")) {
        return "メールアドレスの確認が完了していません。確認メールをご確認ください。"
    }

    return "認証に失敗しました。入力内容をご確認のうえ、再度お試しください。"
}

export function AuthForm({ callbackError = false }: { callbackError?: boolean }) {
    const router = useRouter()
    // モード切り替え状態（true: ログイン / false: サインアップ）
    const [isLoginMode, setIsLoginMode] = useState(true)

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    const [errorMessage, setErrorMessage] = useState<string | null>(
        callbackError
            ? "メール認証を完了できませんでした。確認リンクを再度開いてください。"
            : null
    )
    const [isLoading, setIsLoading] = useState(false)

    const validateForm = (): boolean => {
        if (!email || !email.includes("@")) {
            setErrorMessage("有効なメールアドレスを入力してください")
            return false
        }
        if (password.length < 6) {
            setErrorMessage("パスワードは6文字以上で入力してください")
            return false
        }
        return true
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMessage(null)

        if (!validateForm()) return

        setIsLoading(true)

        try {
            const { error } = isLoginMode
                ? await supabase.auth.signInWithPassword({
                    email,
                    password
                })
                : await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: new URL("/auth/callback", window.location.origin).toString(),
                    },
                })
            if (error) {
                setErrorMessage(getAuthErrorMessage(error))
                return
            }
            if (isLoginMode) {
                router.push("/")
            } else {
                router.push("/auth/verify-email")
            }
        } catch {
            setErrorMessage("認証処理中にエラーが発生しました")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <FieldGroup>
            {/* タイトル */}
            <h2 className="text-center text-xl font-bold">
                {isLoginMode ? "ログイン" : "新規アカウント登録"}
            </h2>

            {/* エラーメッセージ */}
            {errorMessage && (
                <FieldDescription className="text-red-500 font-medium">
                    {errorMessage}
                </FieldDescription>
            )}

            {/* 送信処理を紐付ける form タグ */}
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* メールアドレス */}
                <Field>
                    <FieldLabel htmlFor="fieldgroup-email">Email</FieldLabel>
                    <Input
                        id="fieldgroup-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        disabled={isLoading}
                    />
                </Field>

                {/* パスワード */}
                <Field>
                    <FieldLabel htmlFor="fieldgroup-password">Password</FieldLabel>
                    <Input
                        id="fieldgroup-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="6文字以上のpassword"
                        disabled={isLoading}
                    />
                </Field>

                <FieldDescription>
                    ※パスワードは6文字以上で入力してください。
                </FieldDescription>

                {/* 送信ボタン */}
                <Field orientation="horizontal">
                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading
                            ? "処理中..."
                            : isLoginMode
                                ? "ログイン"
                                : "新規登録"}
                    </Button>
                </Field>
            </form>

            {/* モード切り替えボタン */}
            <Field>
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                        setIsLoginMode(!isLoginMode)
                        setErrorMessage(null)
                    }}
                    disabled={isLoading}
                    className="w-full text-sm"
                >
                    {isLoginMode
                        ? "アカウントをお持ちでない方はこちら（新規登録）"
                        : "すでにアカウントをお持ちの方はこちら（ログイン）"}
                </Button>
            </Field>
        </FieldGroup>
    )
}