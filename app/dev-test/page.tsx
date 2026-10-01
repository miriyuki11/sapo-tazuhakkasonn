"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  getPrivateNotes,
  createPrivateNote,
  updatePrivateNote,
  deletePrivateNote,
  type UserPrivateNote,
} from "@/utils/privateNotes";
import { AuthForm } from "@/src/components/auth/AuthForm";
import type { Session, User } from "@supabase/supabase-js";

export default function DevTestPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [notes, setNotes] = useState<UserPrivateNote[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // 手動作成用フォーム入力
  const [targetUserIdInput, setTargetUserIdInput] = useState("");
  const [newContentInput, setNewContentInput] = useState("");

  const addLog = useCallback((message: string, data?: unknown) => {
    const timestamp = new Date().toLocaleTimeString();
    const logLine = `[${timestamp}] ${message}`;
    setLogs((prev) => [...prev, logLine]);
    if (data !== undefined) {
      console.log(`[DevTest] ${message}`, data);
    } else {
      console.log(`[DevTest] ${message}`);
    }
  }, []);

  const refreshNotes = useCallback(async () => {
    setLoadingNotes(true);
    addLog("メモ一覧を取得中...");
    const data = await getPrivateNotes();
    if (data) {
      setNotes(data);
      addLog(`✅ メモ一覧取得完了: ${data.length}件のメモがあります`, data);
    } else {
      addLog("❌ メモ一覧の取得に失敗しました");
    }
    setLoadingNotes(false);
  }, [addLog]);

  useEffect(() => {
    // 現在の認証セッションを取得
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTargetUserIdInput(session.user.id);
        refreshNotes();
      }
    });

    // 認証状態の変化を監視
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTargetUserIdInput(session.user.id);
        refreshNotes();
      } else {
        setNotes([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshNotes]);

  // 全てのCRUD操作を一括で実行するテスト関数
  const runCrudTests = async () => {
    if (!session || !user) {
      addLog("⚠️ 認証されていません。先にログインしてください。");
      return;
    }

    setIsRunning(true);
    setLogs([]);
    addLog("--- Supabase 個人メモ CRUD 自動テスト開始 ---");

    try {
      let allPassed = true;
      // 1. CREATE (作成)
      addLog("=== 1. ノート作成テスト (createPrivateNote) ===");
      const testContent = `Supabaseクライアント検証メモ (${new Date().toLocaleTimeString()})`;
      const created = await createPrivateNote({
        target_user_id: user.id, // 自分宛のメモとして作成
        note_content: testContent,
      });

      if (!created) {
        allPassed = false;
        addLog("❌ メモの作成に失敗したため、テストを中断します。");
        setIsRunning(false);
        return;
      }
      addLog(`✅ メモ作成成功 (ID: ${created.id})`, created);
      const testNoteId = created.id;

      // 2. READ (取得) - 作成後
      addLog("=== 2. 全てのメモ取得テスト (getPrivateNotes) ===");
      const notesAfterCreate = await getPrivateNotes();
      const createReadPassed = !!notesAfterCreate?.some((note) => note.id === testNoteId);
      allPassed &&= createReadPassed;
      addLog(
        `${createReadPassed ? "✅" : "❌"} 取得完了 (${notesAfterCreate?.length ?? 0}件)`,
        notesAfterCreate
      );
      if (notesAfterCreate) setNotes(notesAfterCreate);

      // 3. UPDATE (更新)
      addLog("=== 3. ノート更新テスト (updatePrivateNote) ===");
      const updatedContent = `${testContent} [UPDATED - Supabaseクライアントで更新成功]`;
      const updated = await updatePrivateNote(testNoteId, {
        note_content: updatedContent,
      });

      if (updated) {
        const updatePassed = updated.note_content === updatedContent;
        allPassed &&= updatePassed;
        addLog(`${updatePassed ? "✅" : "❌"} メモ更新成功: "${updated.note_content}"`, updated);
      } else {
        allPassed = false;
        addLog("❌ メモの更新に失敗しました。");
      }

      // 4. READ (取得) - 更新後
      addLog("=== 4. 更新後のメモ取得確認 ===");
      const notesAfterUpdate = await getPrivateNotes();
      const updateReadPassed = !!notesAfterUpdate?.some(
        (note) => note.id === testNoteId && note.note_content === updatedContent
      );
      allPassed &&= updateReadPassed;
      addLog(
        `${updateReadPassed ? "✅" : "❌"} 更新後のメモ一覧取得 (${notesAfterUpdate?.length ?? 0}件)`,
        notesAfterUpdate
      );
      if (notesAfterUpdate) setNotes(notesAfterUpdate);

      // 5. DELETE (削除)
      addLog("=== 5. ノート削除テスト (deletePrivateNote) ===");
      const deleted = await deletePrivateNote(testNoteId);
      if (deleted) {
        addLog(`✅ メモ (ID: ${testNoteId}) 削除成功`);
      } else {
        allPassed = false;
        addLog(`❌ メモ (ID: ${testNoteId}) 削除失敗`);
      }

      // 6. READ (取得) - 削除後
      addLog("=== 6. 削除後のメモ取得確認 ===");
      const notesAfterDelete = await getPrivateNotes();
      const deleteReadPassed =
        !!notesAfterDelete && !notesAfterDelete.some((note) => note.id === testNoteId);
      allPassed &&= deleteReadPassed;
      addLog(
        `${deleteReadPassed ? "✅" : "❌"} 削除後のメモ一覧取得 (${notesAfterDelete?.length ?? 0}件)`,
        notesAfterDelete
      );
      if (notesAfterDelete) setNotes(notesAfterDelete);

      addLog(
        allPassed
          ? "--- 🎉 Supabase 個人メモ CRUD テスト全ステップ成功完了 ---"
          : "--- ❌ Supabase 個人メモ CRUD テストに失敗したステップがあります ---"
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addLog(`❌ 予期せぬエラー: ${message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // 手動作成ハンドラ
  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContentInput.trim()) return;

    addLog(`手動作成開始: "${newContentInput}"`);
    const created = await createPrivateNote({
      target_user_id: targetUserIdInput || undefined,
      note_content: newContentInput.trim(),
    });

    if (created) {
      addLog(`✅ 手動作成成功 (ID: ${created.id})`, created);
      setNewContentInput("");
      refreshNotes();
    } else {
      addLog("❌ 手動作成に失敗しました");
    }
  };

  // 手動削除ハンドラ
  const handleManualDelete = async (noteId: string) => {
    if (!confirm("このメモを削除しますか？")) return;
    addLog(`手動削除開始: ID ${noteId}`);
    const ok = await deletePrivateNote(noteId);
    if (ok) {
      addLog(`✅ 削除完了: ID ${noteId}`);
      refreshNotes();
    } else {
      addLog(`❌ 削除失敗: ID ${noteId}`);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 dark:bg-slate-950">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* ヘッダー */}
        <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                Supabase 個人メモ CRUD 移行テスト
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                ステップ3: <code>utils/privateNotes.ts</code> を介した <code>user_private_notes</code> テーブル操作の動作確認
              </p>
            </div>
            {session && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => supabase.auth.signOut()}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                >
                  ログアウト
                </button>
              </div>
            )}
          </div>

          {/* 認証状態バッジ */}
          <div className="mt-4 rounded-lg bg-slate-100 p-3 text-xs dark:bg-slate-800">
            {session ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <strong className="text-slate-700 dark:text-slate-200">認証済みユーザー:</strong>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">{session.user.email}</span>
                </div>
                <div className="text-slate-500 dark:text-slate-400 font-mono">
                  UID: {session.user.id}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span>未ログインです。テストを実行するには先にログインしてください。</span>
              </div>
            )}
          </div>
        </header>

        {!session ? (
          /* 未ログイン時: ログインUI表示 */
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-center text-lg font-bold text-slate-700 dark:text-slate-200">
              ログインしてテストを開始
            </h2>
            <div className="mx-auto max-w-md">
              <AuthForm />
            </div>
          </div>
        ) : (
          /* ログイン時: CRUDテスト実行エリア */
          <>
            {/* 一括テスト実行カード */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    一括 CRUD テスト実行
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    作成(C) → 取得(R) → 更新(U) → 取得(R) → 削除(D) → 取得(R) の全フローを自動実行します
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={runCrudTests}
                  className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isRunning ? "テスト実行中..." : "CRUDテストを実行 (コンソールを確認)"}
                </button>
              </div>

              {/* ログコンソール */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                  <span>実行ログ (Console出力と同じ内容を表示)</span>
                  {logs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setLogs([])}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      クリア
                    </button>
                  )}
                </div>
                <div className="max-h-56 overflow-y-auto rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-200">
                  {logs.length === 0 ? (
                    <span className="text-slate-600">まだテストは実行されていません。</span>
                  ) : (
                    logs.map((log, i) => <div key={i}>{log}</div>)
                  )}
                </div>
              </div>
            </div>

            {/* 手動メモ作成フォーム */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                手動メモ作成
              </h2>
              <form onSubmit={handleManualCreate} className="mt-4 space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="target-user-id" className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                      対象ユーザーID (target_user_id)
                    </label>
                    <input
                      id="target-user-id"
                      type="text"
                      value={targetUserIdInput}
                      onChange={(e) => setTargetUserIdInput(e.target.value)}
                      placeholder="対象ユーザーのUUID（デフォルトは自身）"
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label htmlFor="note-content" className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                      メモ本文 (note_content)
                    </label>
                    <input
                      id="note-content"
                      type="text"
                      value={newContentInput}
                      onChange={(e) => setNewContentInput(e.target.value)}
                      placeholder="メモの内容を入力"
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    メモを作成
                  </button>
                </div>
              </form>
            </div>

            {/* 現在のメモ一覧表示 */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  現在のメモ一覧 ({notes.length}件)
                </h2>
                <button
                  type="button"
                  disabled={loadingNotes}
                  onClick={refreshNotes}
                  className="rounded border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {loadingNotes ? "取得中..." : "一覧を再取得"}
                </button>
              </div>

              <div className="mt-4">
                {notes.length === 0 ? (
                  <p className="text-center py-6 text-sm text-slate-400">
                    メモがありません。「CRUDテストを実行」または手動作成をお試しください。
                  </p>
                ) : (
                  <div className="space-y-3">
                    {notes.map((note) => (
                      <div
                        key={note.id}
                        className="rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
                      >
                        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                              {note.note_content}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-slate-400">
                              <span>ID: {note.id}</span>
                              <span>Target: {note.target_user_id}</span>
                              <span>作成日: {new Date(note.created_at).toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                const newText = prompt("新しいメモ内容を入力してください", note.note_content);
                                if (newText !== null && newText.trim()) {
                                  addLog(`手動更新: ID ${note.id}`);
                                  const updated = await updatePrivateNote(note.id, {
                                    note_content: newText.trim(),
                                  });
                                  if (updated) {
                                    addLog(`✅ 更新完了: "${updated.note_content}"`);
                                    refreshNotes();
                                  }
                                }
                              }}
                              className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              編集
                            </button>
                            <button
                              type="button"
                              onClick={() => handleManualDelete(note.id)}
                              className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                            >
                              削除
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
