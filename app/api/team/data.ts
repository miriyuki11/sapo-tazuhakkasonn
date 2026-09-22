type Member = {
  id: string;
  slackId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role?: "管理者" | "メンバー";
};

type TeamRecord = {
  id: string;
  name: string;
  description: string;
  members: Member[];
};

type TeamPayload = {
  name: string;
  description: string;
  memberIds: string[];
};

type TeamRequestBody = {
  name?: unknown;
  description?: unknown;
  memberIds?: unknown;
};

const members: Member[] = [
  {
    id: "member-1",
    slackId: "sato",
    name: "佐藤 花子",
    email: "hanako.sato@example.com",
    avatarUrl: "https://placehold.co/84x84/png?text=%E4%BD%90",
    role: "管理者",
  },
  {
    id: "member-2",
    slackId: "tanaka",
    name: "田中 健",
    email: "ken.tanaka@example.com",
    avatarUrl: "https://placehold.co/84x84/png?text=%E7%94%B0",
  },
  {
    id: "member-3",
    slackId: "suzuki",
    name: "鈴木 愛",
    email: "ai.suzuki@example.com",
    avatarUrl: "https://placehold.co/84x84/png?text=%E9%88%B4",
  },
  {
    id: "member-4",
    slackId: "yamada",
    name: "山田 太郎",
    email: "taro.yamada@example.com",
  },
];

let currentTeam: TeamRecord = {
  id: "team-development",
  name: "開発チーム",
  description: "新しいサービスの開発を行うチームです。",
  members: members
    .filter((member) => member.id === "member-1" || member.id === "member-2")
    .map((member) => ({
      ...member,
      role: member.role ?? "メンバー",
    })),
};

function resolveMembers(memberIds: string[]) {
  return memberIds
    .map((memberId) => members.find((member) => member.id === memberId))
    .filter((member): member is Member => Boolean(member))
    .map((member) => ({
      ...member,
      role: member.role ?? "メンバー",
    }));
}

export function getMembers() {
  return members;
}

export function getTeam() {
  return currentTeam;
}

export function createTeam(payload: TeamPayload) {
  currentTeam = {
    id: `team-${Date.now()}`,
    name: payload.name,
    description: payload.description,
    members: resolveMembers(payload.memberIds),
  };

  return currentTeam;
}

export function updateTeam(id: string, payload: TeamPayload) {
  if (currentTeam.id !== id) {
    return null;
  }

  currentTeam = {
    id,
    name: payload.name,
    description: payload.description,
    members: resolveMembers(payload.memberIds),
  };

  return currentTeam;
}

export function parseTeamRequestBody(body: TeamRequestBody) {
  if (
    typeof body.name !== "string" ||
    !body.name.trim() ||
    typeof body.description !== "string" ||
    !Array.isArray(body.memberIds) ||
    !body.memberIds.every(
      (memberId) =>
        typeof memberId === "string" &&
        members.some((member) => member.id === memberId)
    )
  ) {
    return null;
  }

  return {
    name: body.name.trim(),
    description: body.description.trim(),
    memberIds: body.memberIds,
  };
}
