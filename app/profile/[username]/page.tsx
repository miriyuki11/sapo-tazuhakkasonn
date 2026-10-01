import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  PUBLIC_PROFILE_FIELD_LABELS,
  getPublicProfileBySlug,
  type PublicProfileCard,
  type PublicProfileField,
} from "@/lib/profiles";

type PageParams = {
  params: Promise<{ username: string }>;
};

const FIELD_ORDER: PublicProfileField[] = [
  "self_introduction",
  "skills",
  "communication_style",
  "consultation_style",
  "free_description",
  "realtime_status",
];

function getFieldValue(
  profile: PublicProfileCard,
  field: PublicProfileField
): string | null {
  return profile[field];
}

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const { username } = await params;
  const profile = await getPublicProfileBySlug(username);

  if (!profile) {
    return { title: "プロフィールが見つかりません" };
  }

  const title = `${profile.slug} のプロフィールカード`;
  const description =
    profile.self_introduction?.slice(0, 120) ||
    "Introcard の公開プロフィールカードです。";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function PublicProfilePage({ params }: PageParams) {
  const { username } = await params;
  const profile = await getPublicProfileBySlug(username);

  if (!profile) {
    notFound();
  }

  const fields = FIELD_ORDER.filter((field) =>
    getFieldValue(profile, field)?.trim()
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-12">
      <header>
        <p className="text-sm text-muted-foreground">プロフィールカード</p>
        <h1 className="text-2xl font-bold">{profile.slug}</h1>
      </header>

      {fields.length === 0 ? (
        <p className="text-muted-foreground">
          公開されているプロフィール項目はありません。
        </p>
      ) : (
        <dl className="flex flex-col gap-5">
          {fields.map((field) => (
            <div key={field} className="rounded-lg border border-border p-4">
              <dt className="text-sm font-semibold text-muted-foreground">
                {PUBLIC_PROFILE_FIELD_LABELS[field]}
              </dt>
              <dd className="mt-1 whitespace-pre-wrap">
                {getFieldValue(profile, field)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </main>
  );
}
