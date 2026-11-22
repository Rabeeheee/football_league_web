import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { FixturesView } from "@/components/fixtures-view";
import { Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function FixturesPage() {
  let tournament = await prisma.tournament.findFirst();
  if (!tournament) {
    tournament = await prisma.tournament.create({
      data: {
        name: "Culvert Football League",
        teamSlots: 8,
        entryFee: 100,
        starterCount: 5,
        subCount: 2,
      },
    });
  }

  const [matches, teamCount] = await Promise.all([
    prisma.match.findMany({
      where: { tournamentId: tournament.id },
      include: { homeTeam: true, awayTeam: true, winnerTeam: true },
      orderBy: [{ slotIndex: "asc" }],
    }),
    prisma.team.count({ where: { tournamentId: tournament.id } }),
  ]);

  const session = await getSession();
  const isAdmin = session?.user?.role === Role.LEAGUE_ADMIN;

  return (
    <main className="mx-auto max-w-[1400px] px-3 py-6 sm:px-4 sm:py-10">
      <div className="mb-5 sm:mb-8">
        <h1 className="font-display text-2xl text-white sm:text-3xl">
          Fixtures
        </h1>
        <p className="mt-2 text-sm text-white/60">
          League phase first, then knockout for the top teams.{" "}
          {isAdmin
            ? "League allows draws; knockout needs a winner."
            : "Scores are entered by the league admin."}
        </p>
      </div>
      <FixturesView
        initialMatches={matches}
        tournament={tournament}
        teamsRegistered={teamCount}
        isAdmin={!!isAdmin}
      />
    </main>
  );
}
