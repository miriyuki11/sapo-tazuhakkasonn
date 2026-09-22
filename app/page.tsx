"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Member = {
  id: string;
  slackId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role?: "管理者" | "メンバー";
};

type MembersResponse = {
  members: Member[];
};

type Team = {
  id: string;
  name: string;
  description: string;
  members: Member[];
};

type TeamResponse = {
  team: Team;
};

type TeamPayload = {
  name: string;
  description: string;
  memberIds: string[];
};

const emptyTeam: Team = {
  id: "",
  name: "",
  description: "",
  members: [],
};

export default function Home() {
  const [team, setTeam] = useState<Team>(emptyTeam);

  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const toastTimeoutRef = useRef<number | null>(null);

  const fetchTeamData = useCallback(async () => {
    const [membersResponse, teamResponse] = await Promise.all([
      fetch("/api/team/members", {
        cache: "no-store",
      }),
      fetch("/api/team", {
        cache: "no-store",
      }),
    ]);

    if (!membersResponse.ok || !teamResponse.ok) {
      throw new Error("データの取得に失敗しました");
    }

    const membersData: MembersResponse = await membersResponse.json();
    const teamData: TeamResponse = await teamResponse.json();

    return {
      members: membersData.members,
      team: teamData.team,
    };
  }, []);

  function applyLoadedData(data: { members: Member[]; team: Team }) {
    setAllMembers(data.members);
    setTeam(data.team);
    setQuery("");
  }

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await fetchTeamData();
      applyLoadedData(data);
    } catch (err) {
      console.error(err);
      setError("Slackユーザーまたはチーム情報の取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }, [fetchTeamData]);

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        setLoading(true);
        setError("");
        const data = await fetchTeamData();
        if (!active) {
          return;
        }
        applyLoadedData(data);
      } catch (err) {
        console.error(err);
        if (active) {
          setError("Slackユーザーまたはチーム情報の取得に失敗しました。");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      active = false;
    };
  }, [fetchTeamData]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);
  
  const searchResults = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }
    return allMembers.filter((member) => {
      const alreadyAdded = team.members.some(
        (currentMember) => currentMember.id === member.id
      );
      if (alreadyAdded) {
        return false;
      }
      return (
        member.name.toLowerCase().includes(normalizedQuery) ||
        member.email.toLowerCase().includes(normalizedQuery) ||
        member.slackId.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [query, allMembers, team.members]);

  function handleTeamNameChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    setTeam((current) => ({
      ...current,
      name: event.target.value,
    }));
  }
  
  function handleDescriptionChange(
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) {
    setTeam((current) => ({
      ...current,
      description: event.target.value,
    }));
  }

  function addMember(member: Member) {
    setTeam((current) => ({
      ...current,
      members: [
        ...current.members,
        {
          ...member,
          role: member.role ?? "メンバー",
        },
      ],
    }));
    setQuery("");
  }

  function removeMember(memberId: string) {
    setTeam((current) => ({
      ...current,
      members: current.members.filter(
        (member) => member.id !== memberId
      ),
    }));
  }

  function buildTeamPayload(currentTeam: Team): TeamPayload {
    return {
      name: currentTeam.name.trim(),
      description: currentTeam.description,
      memberIds: currentTeam.members.map((member) => member.id),
    };
  }

  function showToast(message: string, duration = 2500) {
    setToast(message);

    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = window.setTimeout(() => {
      setToast("");
      toastTimeoutRef.current = null;
    }, duration);
  }
  
  async function saveTeam() {
    if (!team.name.trim()) {
      showToast("チーム名を入力してください");
      return;
    }
    try {
      const response = await fetch(
        team.id ? `/api/team/${team.id}` : "/api/team",
        {
          method: team.id ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildTeamPayload(team)),
        }
      );

      if (!response.ok) {
        throw new Error("保存に失敗しました");
      }

      const data: TeamResponse = await response.json();
      setTeam(data.team);
      showToast(`「${data.team.name}」を保存しました`);
    } catch (err) {
      console.error(err);
      showToast("保存に失敗しました");
    }
  }
  
  function createNewTeam() {
    setTeam({
      ...emptyTeam,
      members: [],
    });
    setQuery("");
    showToast("新しいチームを作成できます", 2200);
  }
  
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="workspace-title">
          <div>
            Team Workspace
            <div className="workspace-subtitle">
              ワークスペース
            </div>
          </div>
          <span>⌄</span>
        </div>
        <div className="side-section-title">
          チャンネル
        </div>
        <button className="side-item">
          # general
        </button>
        <button className="side-item">
          # development
        </button>
        <button className="side-item">
          # design
        </button>
        <div className="side-section-title">
          チーム
        </div>
        <button className="side-item active">
          🟢 開発チーム
        </button>
        <button className="side-item">
          🔵 デザインチーム
        </button>
        <button className="side-item">
          🟣 営業チーム
        </button>
        <button
          className="side-item create-team"
          onClick={createNewTeam}
        >
          ＋ チームを作成
        </button>
      </aside>
      <main className="main">
        <header className="topbar">
          <span>⚙️</span>
          <span className="breadcrumb">
            チーム設定
          </span>
          <span>/</span>
          <strong>
            {team.name || "新しいチーム"}
          </strong>
        </header>
        <section className="content">
          <div className="page-heading">
            <div>
              <h1>
                チーム情報
              </h1>
              <p>
                チームの基本情報とメンバーを管理します。
              </p>
            </div>
          </div>
          <div className="card">
            <h2>
              基本情報
            </h2>
            <p className="card-description">
              チーム名と説明を設定してください。
            </p>
            <div className="form-row">
              <label
                className="form-label"
                htmlFor="team-name"
              >
                チーム名
              </label>
              <input
                id="team-name"
                className="input"
                value={team.name}
                onChange={handleTeamNameChange}
                placeholder="例：開発チーム"
              />
            </div>
            <div className="form-row">
              <label
                className="form-label"
                htmlFor="description"
              >
                説明
              </label>
              <textarea
                id="description"
                className="textarea"
                value={team.description}
                onChange={handleDescriptionChange}
                placeholder="このチームの目的や役割を入力してください"
              />
            </div>
          </div>
          <div className="card">
            <h2>
              メンバー管理
            </h2>
            <p className="card-description">
              Slackのユーザーを検索してチームに追加できます。
            </p>
            {loading && (
              <div className="empty">
                Slackからメンバー情報を取得しています...
              </div>
            )}
            {error && (
              <div className="empty">
                {error}
              </div>
            )}
            {!loading && !error && (
              <>
                <label
                  className="form-label"
                  htmlFor="member-search"
                >
                  メンバーを追加
                </label>
                <div className="search-wrap">
                  <span className="search-icon">
                    🔍
                  </span>
                  <input
                    id="member-search"
                    className="search"
                    value={query}
                    onChange={(event) =>
                      setQuery(event.target.value)
                    }
                    placeholder="名前・メールアドレスで検索"
                  />
                </div>
                {query && (
                  <div className="search-results">
                    {searchResults.length > 0 ? (
                      searchResults.map((member) => (
                        <div
                          className="member-row"
                          key={member.id}
                        >
                          {member.avatarUrl ? (
                            <img
                              src={member.avatarUrl}
                              alt={`${member.name}のプロフィール画像`}
                              className="avatar"
                              style={{
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <div className="avatar">
                              {member.name.slice(0, 1)}
                            </div>
                          )}
                          <div className="member-info">
                            <div className="member-name">
                              {member.name}
                            </div>
                            <div className="member-email">
                              {member.email}
                            </div>
                          </div>
                          <button
                            className="btn"
                            onClick={() =>
                              addMember(member)
                            }
                          >
                            追加
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="empty">
                        該当するSlackユーザーがいません。
                      </div>
                    )}
                  </div>
                )}
                <div className="form-label">
                  現在のメンバー（
                  {team.members.length}
                  人）
                </div>
                <div className="search-results">
                  {team.members.length > 0 ? (
                    team.members.map((member) => (
                      <div
                        className="member-row"
                        key={member.id}
                      >
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={`${member.name}のプロフィール画像`}
                            className="avatar"
                            style={{
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <div className="avatar">
                            {member.name.slice(0, 1)}
                          </div>
                        )}
                        <div className="member-info">
                          <div className="member-name">
                            {member.name}
                          </div>
                          <div className="member-email">
                            {member.email}
                          </div>
                        </div>
                        <span
                          style={{
                            color: "#6b696b",
                            fontSize: 13,
                          }}
                        >
                          {member.role ?? "メンバー"}
                        </span>
                        <button
                          className="btn btn-danger"
                          onClick={() =>
                            removeMember(member.id)
                          }
                        >
                          削除
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="empty">
                      まだメンバーが追加されていません。
                    </div>
                  )}
                </div>
                <div className="actions">
                  <button
                    className="btn"
                    onClick={() => void loadData()}
                  >
                    キャンセル
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={saveTeam}
                  >
                    変更を保存
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
        {toast && (
          <div className="toast">
            {toast}
          </div>
        )}
      </main>
    </div>
  );
}
