"use client";

import { useState } from "react";
import {
  signUpUser,
  signInUser,
  signOutUser,
  getCurrentSession,
  getUser,
} from "@/src/lib/supabase/auth";

export function AuthFunctionsTest() {
  const [testEmail, setTestEmail] = useState("test-user@example.com");
  const [testPassword, setTestPassword] = useState("password123");
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleTestFlow = async () => {
    setIsRunning(true);
    setLogs([]);
    addLog("--- 認証関数テストフロー開始 ---");

    try {
      // 1. サインアップ
      addLog(`1. signUpUser(${testEmail}) を実行中...`);
      const { data: signUpData, error: signUpError } = await signUpUser(
        testEmail,
        testPassword
      );
      if (signUpError) {
        addLog(`⚠️ サインアップ結果: ${signUpError.message} (既存ユーザーの場合があります)`);
      } else {
        addLog(`✅ サインアップ成功: ユーザーID ${signUpData?.user?.id ?? "確認待ち"}`);
      }

      // 2. サインイン
      addLog(`2. signInUser(${testEmail}) を実行中...`);
      const { data: signInData, error: signInError } = await signInUser(
        testEmail,
        testPassword
      );
      if (signInError) {
        addLog(`❌ サインイン失敗: ${signInError.message}`);
      } else {
        addLog(`✅ サインイン成功: ユーザーID ${signInData?.user?.id}`);
      }

      // 3. セッション取得
      addLog("3. getCurrentSession() を実行中...");
      const { session, error: sessionError } = await getCurrentSession();
      if (sessionError) {
        addLog(`❌ セッション取得失敗: ${sessionError.message}`);
      } else {
        addLog(`✅ 現在のセッション: ${session ? `有効 (User: ${session.user.email})` : "なし"}`);
      }

      // 4. ユーザー情報取得
      addLog("4. getUser() を実行中...");
      const { user, error: userError } = await getUser();
      if (userError) {
        addLog(`❌ ユーザー取得失敗: ${userError.message}`);
      } else {
        addLog(`✅ 現在のユーザー: ${user ? `${user.email} (${user.id})` : "なし"}`);
      }

      // 5. ログアウト
      addLog("5. signOutUser() を実行中...");
      const { error: signOutError } = await signOutUser();
      if (signOutError) {
        addLog(`❌ サインアウト失敗: ${signOutError.message}`);
      } else {
        addLog("✅ サインアウト完了");
      }

      // 6. ログアウト後のセッション確認
      addLog("6. サインアウト後の getCurrentSession() を確認中...");
      const { session: afterSession } = await getCurrentSession();
      addLog(`✅ サインアウト後セッション: ${afterSession ? "残存しています" : "null (期待通り)"}`);

      addLog("--- 認証関数テストフロー完了 ---");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addLog(`❌ 予期せぬエラー: ${message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
        ステップ2: Supabase Auth ラッパー関数テスト
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        <code>src/lib/supabase/auth.ts</code> の関数群（signUpUser, signInUser, signOutUser, getCurrentSession, getUser）を実行し、動作確認を行います。
      </p>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            テスト用メールアドレス
          </label>
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            テスト用パスワード
          </label>
          <input
            type="password"
            value={testPassword}
            onChange={(e) => setTestPassword(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isRunning}
          onClick={handleTestFlow}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isRunning ? "テスト実行中..." : "一連の認証フローを実行"}
        </button>

        <button
          type="button"
          disabled={isRunning}
          onClick={async () => {
            addLog("getCurrentSession() を実行");
            const { session } = await getCurrentSession();
            addLog(`セッション: ${session ? session.user.email : "未ログイン"}`);
          }}
          className="rounded border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          セッション確認
        </button>

        <button
          type="button"
          disabled={isRunning}
          onClick={async () => {
            addLog("signOutUser() を実行");
            await signOutUser();
            addLog("サインアウトしました");
          }}
          className="rounded border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
        >
          サインアウト
        </button>
      </div>

      {logs.length > 0 && (
        <div className="mt-4 max-h-48 overflow-y-auto rounded bg-slate-950 p-3 font-mono text-xs text-slate-200">
          {logs.map((log, index) => (
            <div key={index}>{log}</div>
          ))}
        </div>
      )}
    </div>
  );
}
