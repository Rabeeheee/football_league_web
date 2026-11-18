import { prisma } from "@/lib/prisma";
import { computeStandings } from "@/lib/standings";

export const dynamic = "force-dynamic";

export default async function StandingsPage() {
  const tournament = await prisma.tournament.findFirst();
  const teams = tournament
    ? await prisma.team.findMany({
        where: { tournamentId: tournament.id },
        orderBy: { name: "asc" },
      })
    : [];
  const matches = tournament
    ? await prisma.match.findMany({
        where: { tournamentId: tournament.id },
      })
    : [];

  const rows = computeStandings(teams, matches);

  return (
    <main className="mx-auto max-w-4xl px-3 py-6 sm:px-4 sm:py-10">
      <div className="mb-5 sm:mb-8">
        <h1 className="font-display text-2xl text-white sm:text-3xl">
          Points table
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/60">
          League phase only (knockout is separate). Win = 3 pts, draw = 1 pt,
          loss = 0. Ranked by Pts → GD → GF. Top teams from this table go to
          knockout.
        </p>
        {tournament ? (
          <p className="mt-3 text-sm text-amber-200/80">
            Entry fee ₹{tournament.entryFee} per person (paid offline).
          </p>
        ) : null}
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1 text-[10px] uppercase tracking-wider text-white/40 sm:mb-4 sm:flex-wrap sm:text-[11px]">
        <span className="shrink-0 rounded-md bg-white/5 px-2 py-1">P played</span>
        <span className="shrink-0 rounded-md bg-white/5 px-2 py-1">W / D / L</span>
        <span className="shrink-0 rounded-md bg-white/5 px-2 py-1">GF goals for</span>
        <span className="shrink-0 rounded-md bg-white/5 px-2 py-1">GA against</span>
        <span className="shrink-0 rounded-md bg-white/5 px-2 py-1">GD = GF − GA</span>
        <span className="shrink-0 rounded-md bg-white/5 px-2 py-1">Pts</span>
      </div>

      <div className="table-scroll rounded-2xl border border-white/10 bg-black/40">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-white/50 sm:text-xs">
            <tr>
              <th className="sticky left-0 bg-[#0c1610] px-2 py-3 sm:px-3">#</th>
              <th className="sticky left-7 bg-[#0c1610] px-2 py-3 sm:left-8 sm:px-3">
                Team
              </th>
              <th className="px-2 py-3 text-center sm:px-3">P</th>
              <th className="px-2 py-3 text-center sm:px-3">W</th>
              <th className="px-2 py-3 text-center sm:px-3">D</th>
              <th className="px-2 py-3 text-center sm:px-3">L</th>
              <th className="px-2 py-3 text-center sm:px-3">GF</th>
              <th className="px-2 py-3 text-center sm:px-3">GA</th>
              <th className="px-2 py-3 text-center sm:px-3">GD</th>
              <th className="px-2 py-3 text-center sm:px-3">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.team.id}
                className="border-t border-white/10 text-white/90"
              >
                <td className="sticky left-0 bg-[#080f0b] px-2 py-2.5 text-white/40 sm:px-3 sm:py-3">
                  {i + 1}
                </td>
                <td className="sticky left-7 bg-[#080f0b] px-2 py-2.5 sm:left-8 sm:px-3 sm:py-3">
                  <div className="flex max-w-[9rem] items-center gap-2 sm:max-w-none sm:gap-3">
                    {row.team.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.team.logoUrl}
                        alt=""
                        className="h-7 w-7 shrink-0 rounded-full object-cover sm:h-8 sm:w-8"
                      />
                    ) : (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-800 text-xs font-bold sm:h-8 sm:w-8">
                        {row.team.name.slice(0, 1)}
                      </div>
                    )}
                    <span className="truncate">{row.team.name}</span>
                  </div>
                </td>
                <td className="px-2 py-2.5 text-center sm:px-3 sm:py-3">
                  {row.played}
                </td>
                <td className="px-2 py-2.5 text-center sm:px-3 sm:py-3">
                  {row.won}
                </td>
                <td className="px-2 py-2.5 text-center sm:px-3 sm:py-3">
                  {row.drawn}
                </td>
                <td className="px-2 py-2.5 text-center sm:px-3 sm:py-3">
                  {row.lost}
                </td>
                <td className="px-2 py-2.5 text-center sm:px-3 sm:py-3">
                  {row.goalsFor}
                </td>
                <td className="px-2 py-2.5 text-center sm:px-3 sm:py-3">
                  {row.goalsAgainst}
                </td>
                <td className="px-2 py-2.5 text-center sm:px-3 sm:py-3">
                  {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                </td>
                <td className="px-2 py-2.5 text-center font-semibold text-emerald-300 sm:px-3 sm:py-3">
                  {row.points}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-8 text-center text-white/50"
                >
                  No teams yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
