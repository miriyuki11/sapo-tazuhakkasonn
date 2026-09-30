"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  deleteProfile,
  getProfile,
  saveProfile,
} from "@/lib/profiles";
import { supabase } from "@/lib/supabase";

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [email, setEmail] = useState<string | null>(null);

  // フォームステート
  const [selfIntroduction, setSelfIntroduction] = useState("");
  const [skills, setSkills] = useState("");
  const [communicationStyle, setCommunicationStyle] = useState("");
  const [consultationStyle, setConsultationStyle] = useState("");
  const [freeDescription, setFreeDescription] = useState("");
  const [realtimeStatus, setRealtimeStatus] = useState("作業中💻");

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => {
      setToast("");
    }, 3000);
  };

  useEffect(() => {
    let ignore = false;

    async function loadProfile() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (ignore) return;

        if (!user) {
          setError("ログインが必要です。");
          setLoading(false);
          return;
        }

        setEmail(user.email ?? null);

        const { data: profile, error: fetchErr } = await getProfile();

        if (ignore) return;

        if (fetchErr) {
          console.error("プロフィール取得エラー:", fetchErr);
          setError(`取得失敗: ${fetchErr}`);
        } else if (profile) {
          setSelfIntroduction(profile.self_introduction || "");
          setSkills(profile.skills || "");
          setCommunicationStyle(profile.communication_style || "");
          setConsultationStyle(profile.consultation_style || "");
          setFreeDescription(profile.free_description || "");
          if (profile.realtime_status) {
            setRealtimeStatus(profile.realtime_status);
          }
        }
      } catch (err: unknown) {
        console.error(err);
        if (!ignore) {
          setError("プロフィールの取得中にエラーが発生しました。");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      ignore = true;
    };
  }, []);

  // プロフィールの保存
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const { error: saveErr } = await saveProfile({
        self_introduction: selfIntroduction,
        skills,
        communication_style: communicationStyle,
        consultation_style: consultationStyle,
        free_description: freeDescription,
        realtime_status: realtimeStatus,
      });

      if (saveErr) {
        setError(`保存に失敗しました: ${saveErr}`);
        showToast("保存に失敗しました");
      } else {
        showToast("プロフィールを保存しました！");
      }
    } catch (err) {
      console.error(err);
      setError("保存処理中に予期せぬエラーが発生しました。");
    } finally {
      setSaving(false);
    }
  };

  // プロフィールの削除
  const handleDelete = async () => {
    if (!confirm("本当にプロフィールを削除しますか？")) {
      return;
    }

    setDeleting(true);
    try {
      const { error: delErr } = await deleteProfile();
      if (delErr) {
        setError(`削除失敗: ${delErr}`);
      } else {
        setSelfIntroduction("");
        setSkills("");
        setCommunicationStyle("");
        setConsultationStyle("");
        setFreeDescription("");
        setRealtimeStatus("");
        showToast("プロフィールを削除しました");
      }
    } catch (err) {
      console.error(err);
      setError("削除中にエラーが発生しました。");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="workspace-title">
          <div>
            Team Workspace
            <div className="workspace-subtitle">ワークスペース</div>
          </div>
        </div>

        <div className="side-section-title">メニュー</div>
        <Link href="/" className="side-item" style={{ textDecoration: "none" }}>
          🏠 チーム設定
        </Link>
        <div className="side-item active">👤 マイプロフィール</div>

        <div className="side-section-title">アカウント</div>
        <div className="side-item" style={{ fontSize: 13, color: "#cbd5e1" }}>
          {email || "ログイン中"}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <span>👤</span>
          <span className="breadcrumb">
            <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
              ワークスペース
            </Link>
          </span>
          <span>/</span>
          <strong>マイプロフィール設定</strong>
        </header>

        <section className="content">
          <div className="page-heading">
            <div>
              <h1>プロフィールカード設定</h1>
              <p>
                チームメンバーに共有されるあなたの自己紹介や働き方のスタイル、リアルタイムステータスを設定します。
              </p>
            </div>
          </div>

          {loading ? (
            <div className="card">
              <div className="empty">プロフィールを読み込み中...</div>
            </div>
          ) : (
            <form onSubmit={handleSave}>
              {error && (
                <div
                  className="card"
                  style={{
                    backgroundColor: "#fef2f2",
                    borderColor: "#f87171",
                    color: "#991b1b",
                    marginBottom: 16,
                  }}
                >
                  {error}
                </div>
              )}

              {/* リアルタイムステータス */}
              <div className="card">
                <h2>リアルタイムステータス</h2>
                <p className="card-description">
                  現在のあなたの状況をアイコンや一言で表します。
                </p>
                <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  {[
                    "開発に集中💻",
                    "MTG中🗣️",
                    "ランチ休憩中🍱",
                    "離席中☕",
                    "質問・相談歓迎🙋",
                    "退勤しました🌙",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="btn"
                      style={{
                        padding: "6px 12px",
                        fontSize: 13,
                        borderColor: realtimeStatus === preset ? "#4a154b" : undefined,
                        backgroundColor: realtimeStatus === preset ? "#fdf4ff" : undefined,
                      }}
                      onClick={() => setRealtimeStatus(preset)}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <div className="form-row">
                  <label className="form-label" htmlFor="realtime-status">
                    ステータステキスト
                  </label>
                  <input
                    id="realtime-status"
                    className="input"
                    value={realtimeStatus}
                    onChange={(e) => setRealtimeStatus(e.target.value)}
                    placeholder="例: レビュー中👀、外出中🚶"
                  />
                </div>
              </div>

              {/* 基本情報 */}
              <div className="card">
                <h2>自己紹介とスキル</h2>
                <p className="card-description">
                  これまでの経歴や得意な技術、興味のある分野を入力してください。
                </p>

                <div className="form-row">
                  <label className="form-label" htmlFor="self-introduction">
                    自己紹介
                  </label>
                  <textarea
                    id="self-introduction"
                    className="textarea"
                    rows={4}
                    value={selfIntroduction}
                    onChange={(e) => setSelfIntroduction(e.target.value)}
                    placeholder="はじめまして！〇〇チームでフロントエンドを担当している〇〇です。休日はキャンプや読書を楽しんでいます。"
                  />
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="skills">
                    スキル・得意分野
                  </label>
                  <input
                    id="skills"
                    className="input"
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    placeholder="TypeScript, Next.js, React, Supabase, Go, UI/UXデザイン"
                  />
                </div>
              </div>

              {/* 働き方・相談スタイル */}
              <div className="card">
                <h2>コミュニケーション＆相談スタイル</h2>
                <p className="card-description">
                  チームメンバーがあなたに連絡や相談をする際の目安になります。
                </p>

                <div className="form-row">
                  <label className="form-label" htmlFor="communication-style">
                    コミュニケーションスタイル
                  </label>
                  <textarea
                    id="communication-style"
                    className="textarea"
                    rows={3}
                    value={communicationStyle}
                    onChange={(e) => setCommunicationStyle(e.target.value)}
                    placeholder="Slackでの非同期連絡を好みます。急ぎの場合はメンションをつけてくだされば即座に反応します。"
                  />
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="consultation-style">
                    相談スタイル
                  </label>
                  <textarea
                    id="consultation-style"
                    className="textarea"
                    rows={3}
                    value={consultationStyle}
                    onChange={(e) => setConsultationStyle(e.target.value)}
                    placeholder="いつでもハドル相談歓迎です！一人で悩む前に気軽に声をかけてください。"
                  />
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="free-description">
                    自由記述（ひとこと・趣味など）
                  </label>
                  <textarea
                    id="free-description"
                    className="textarea"
                    rows={3}
                    value={freeDescription}
                    onChange={(e) => setFreeDescription(e.target.value)}
                    placeholder="最近キーボードの自作にハマっています！ガジェット好きな方はぜひ話しかけてください。"
                  />
                </div>

                <div className="actions" style={{ justifyContent: "space-between" }}>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={saving || deleting}
                    onClick={handleDelete}
                  >
                    {deleting ? "削除中..." : "カードを削除"}
                  </button>

                  <div style={{ display: "flex", gap: 12 }}>
                    <Link href="/" className="btn" style={{ textDecoration: "none" }}>
                      キャンセル
                    </Link>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={saving || deleting}
                    >
                      {saving ? "保存中..." : "プロフィールを保存"}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}
        </section>

        {toast && (
          <div
            className="toast"
            style={{
              position: "fixed",
              bottom: 24,
              right: 24,
              backgroundColor: "#1e293b",
              color: "#fff",
              padding: "12px 20px",
              borderRadius: 8,
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              fontSize: 14,
              zIndex: 9999,
            }}
          >
            {toast}
          </div>
        )}
      </main>
    </div>
  );
}
