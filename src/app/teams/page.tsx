import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const teams = await prisma.team.findMany({
    include: {
      manager: { select: { name: true } },
      _count: { select: { players: true } },
    },
    orderBy: { name: "asc" },
  });

  const tournament = await prisma.tournament.findFirst();

  return (
    <main className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-10">
      <div className="mb-5 sm:mb-8">
        <h1 className="font-display text-2xl text-white sm:text-3xl">Teams</h1>
        <p className="mt-2 text-sm text-white/60">
          {teams.length}
          {tournament ? ` / ${tournament.teamSlots}` : ""} teams · tap a team to
          see the pitch lineup
        </p>
      </div>

      {teams.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-black/30 p-6 text-sm text-white/60 sm:p-8">
          No teams yet. League admin can add teams from the Admin panel.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {teams.map((team) => (
            <li key={team.id}>
              <Link
                href={`/teams/${team.id}`}
                className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 p-3.5 transition active:border-emerald-500/40 active:bg-emerald-950/40 sm:gap-4 sm:p-4 sm:hover:border-emerald-500/40 sm:hover:bg-emerald-950/40"
              >
                {team.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={team.logoUrl}
                    alt=""
                    className="h-14 w-14 rounded-full object-cover ring-2 ring-white/20"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-800 text-xl font-bold text-white ring-2 ring-white/20">
                    {team.name.slice(0, 1)}
                  </div>
                )}
                <div>
                  <p className="text-lg font-semibold text-white group-hover:text-emerald-100">
                    {team.name}
                  </p>
                  <p className="text-sm text-white/50">
                    {team.manager
                      ? `Manager: ${team.manager.name}`
                      : "No manager yet"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
