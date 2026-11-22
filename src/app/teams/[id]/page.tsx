import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { PitchEditor } from "@/components/pitch-editor";
import { Role } from "@/lib/roles";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function TeamDetailPage({ params }: Props) {
  const { id } = await params;
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      players: { orderBy: { sortOrder: "asc" } },
      manager: { select: { id: true, name: true, image: true } },
      tournament: {
        select: { starterCount: true, subCount: true },
      },
    },
  });
  if (!team) notFound();

  const session = await getSession();
  const canEdit =
    !!session?.user &&
    (session.user.role === Role.LEAGUE_ADMIN ||
      team.managerId === session.user.id);

  const viewer =
    session?.user
      ? {
          name: session.user.name,
          image: session.user.image ?? null,
        }
      : null;

  return (
    <main className="mx-auto max-w-6xl px-3 py-5 sm:px-4 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/teams"
          className="inline-flex min-h-10 items-center text-sm text-emerald-300/80 hover:text-emerald-200"
        >
          ← All teams
        </Link>
        {viewer && (
          <Link
            href="/profile"
            className="inline-flex max-w-[60%] items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 pl-1 pr-3 hover:bg-white/10"
          >
            {viewer.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={viewer.image}
                alt=""
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-800 text-xs font-bold text-white">
                {viewer.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="truncate text-sm font-medium text-white/90">
              {viewer.name}
            </span>
          </Link>
        )}
      </div>
      <p className="mt-1 font-display text-sm tracking-wide text-white/40">
        Game plan
      </p>
      <div className="mt-3 sm:mt-4">
        <PitchEditor
          teamId={team.id}
          initialPlayers={team.players}
          initialFormation={team.formation}
          canEdit={canEdit}
          teamName={team.name}
          logoUrl={team.logoUrl}
          managerName={team.manager?.name}
          managerImage={team.manager?.image}
          viewer={viewer}
          starterCount={team.tournament.starterCount}
          subCount={team.tournament.subCount}
        />
      </div>
      {!canEdit && (
        <p className="mt-4 text-center text-sm text-white/40">
          View only — sign in as this team&apos;s manager to edit the squad.
        </p>
      )}
    </main>
  );
}
