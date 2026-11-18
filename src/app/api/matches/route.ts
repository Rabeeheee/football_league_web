import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { MatchStatus, Role } from "@/lib/roles";
import {
  buildRoundRobinFixtures,
  flattenFixturesForDb,
  totalRoundRobinMatches,
} from "@/lib/fixtures";
import {
  MatchPhase,
  buildKnockoutFromStandings,
  knockoutParent,
  knockoutRoundCount,
} from "@/lib/knockout";
import { computeStandings } from "@/lib/standings";

async function loadMatches(tournamentId: string) {
  return prisma.match.findMany({
    where: { tournamentId },
    include: { homeTeam: true, awayTeam: true, winnerTeam: true },
    orderBy: [
      { phase: "asc" },
      { isBronze: "asc" },
      { round: "asc" },
      { slotIndex: "asc" },
    ],
  });
}

export async function GET() {
  const tournament = await prisma.tournament.findFirst();
  if (!tournament) {
    return NextResponse.json({ matches: [], tournament: null });
  }
  const matches = await loadMatches(tournament.id);
  return NextResponse.json({ matches, tournament });
}

const postSchema = z.object({
  /** league = regenerate round-robin; knockout = start knockout from table */
  action: z.enum(["league", "knockout"]).default("league"),
});

export async function POST(req: Request) {
  const session = await requireRole([Role.LEAGUE_ADMIN]);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let action: "league" | "knockout" = "league";
  try {
    const json = await req.json();
    action = postSchema.parse(json).action;
  } catch {
    action = "league";
  }

  const tournament = await prisma.tournament.findFirst({
    include: { teams: { orderBy: { createdAt: "asc" } } },
  });
  if (!tournament) {
    return NextResponse.json({ error: "No tournament" }, { status: 400 });
  }
  if (tournament.teams.length < 2) {
    return NextResponse.json(
      { error: "Need at least 2 registered teams" },
      { status: 400 },
    );
  }

  if (action === "league") {
    const fixtures = buildRoundRobinFixtures(tournament.teams);
    const expected = totalRoundRobinMatches(tournament.teams.length);
    if (fixtures.length !== expected) {
      return NextResponse.json(
        { error: `Generator mismatch: ${fixtures.length} vs ${expected}` },
        { status: 500 },
      );
    }
    const rows = flattenFixturesForDb(fixtures);

    await prisma.$transaction(async (tx) => {
      // Regenerating league clears knockout too (fresh season)
      await tx.match.deleteMany({ where: { tournamentId: tournament.id } });
      const chunkSize = 50;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        await tx.match.createMany({
          data: chunk.map((f) => ({
            tournamentId: tournament.id,
            phase: MatchPhase.LEAGUE,
            round: f.round,
            slotIndex: f.slotIndex,
            isBronze: false,
            homeTeamId: f.homeTeamId,
            awayTeamId: f.awayTeamId,
            status: MatchStatus.PENDING,
          })),
        });
      }
    });

    const matches = await loadMatches(tournament.id);
    return NextResponse.json({
      matches,
      meta: { action: "league", totalMatches: matches.length },
    });
  }

  // —— Knockout from league standings ——
  const leagueMatches = await prisma.match.findMany({
    where: { tournamentId: tournament.id, phase: MatchPhase.LEAGUE },
  });
  if (leagueMatches.length === 0) {
    return NextResponse.json(
      { error: "Generate and play the league phase first" },
      { status: 400 },
    );
  }
  const unfinished = leagueMatches.filter((m) => m.status !== MatchStatus.COMPLETED);
  if (unfinished.length > 0) {
    return NextResponse.json(
      {
        error: `Finish all league matches first (${unfinished.length} left)`,
      },
      { status: 400 },
    );
  }

  const standings = computeStandings(tournament.teams, leagueMatches);
  const { fieldSize, slots } = buildKnockoutFromStandings(standings);

  await prisma.$transaction(async (tx) => {
    await tx.match.deleteMany({
      where: { tournamentId: tournament.id, phase: MatchPhase.KNOCKOUT },
    });
    await tx.match.createMany({
      data: slots.map((s) => ({
        tournamentId: tournament.id,
        phase: MatchPhase.KNOCKOUT,
        round: s.round,
        slotIndex: s.slotIndex,
        isBronze: s.isBronze,
        homeTeamId: s.homeTeamId,
        awayTeamId: s.awayTeamId,
        status: MatchStatus.PENDING,
      })),
    });
  });

  const matches = await loadMatches(tournament.id);
  return NextResponse.json({
    matches,
    meta: {
      action: "knockout",
      fieldSize,
      qualified: standings.slice(0, fieldSize).map((r) => r.team.name),
    },
  });
}

const resultSchema = z.object({
  matchId: z.string(),
  homeGoals: z.number().int().min(0).max(99),
  awayGoals: z.number().int().min(0).max(99),
});

export async function PATCH(req: Request) {
  const session = await requireRole([Role.LEAGUE_ADMIN]);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = resultSchema.parse(await req.json());
    const { matchId, homeGoals, awayGoals } = body;
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }
    if (!match.homeTeamId || !match.awayTeamId) {
      return NextResponse.json(
        { error: "Both teams must be set" },
        { status: 400 },
      );
    }

    const isKnockout = match.phase === MatchPhase.KNOCKOUT;

    if (isKnockout && homeGoals === awayGoals) {
      return NextResponse.json(
        { error: "Knockout matches need a winner — no draws" },
        { status: 400 },
      );
    }

    const winnerTeamId =
      homeGoals === awayGoals
        ? null
        : homeGoals > awayGoals
          ? match.homeTeamId
          : match.awayTeamId;

    await prisma.match.update({
      where: { id: matchId },
      data: {
        winnerTeamId,
        homeGoals,
        awayGoals,
        status: MatchStatus.COMPLETED,
      },
    });

    // Advance winner in knockout tree
    if (isKnockout && winnerTeamId && !match.isBronze) {
      const parent = knockoutParent(match.round, match.slotIndex);
      const parentMatch = await prisma.match.findFirst({
        where: {
          tournamentId: match.tournamentId,
          phase: MatchPhase.KNOCKOUT,
          round: parent.round,
          slotIndex: parent.slotIndex,
          isBronze: false,
        },
      });
      if (parentMatch) {
        await prisma.match.update({
          where: { id: parentMatch.id },
          data: parent.isHome
            ? {
                homeTeamId: winnerTeamId,
                winnerTeamId: null,
                homeGoals: null,
                awayGoals: null,
                status: MatchStatus.PENDING,
              }
            : {
                awayTeamId: winnerTeamId,
                winnerTeamId: null,
                homeGoals: null,
                awayGoals: null,
                status: MatchStatus.PENDING,
              },
        });
      }

      // Feed losers into bronze when both semis done
      const koMatches = await prisma.match.findMany({
        where: {
          tournamentId: match.tournamentId,
          phase: MatchPhase.KNOCKOUT,
        },
      });
      const rounds = knockoutRoundCount(
        // infer field size from first round match count
        (koMatches.filter((m) => m.round === 0 && !m.isBronze).length || 1) * 2,
      );
      if (match.round === rounds - 2) {
        const loserId =
          winnerTeamId === match.homeTeamId
            ? match.awayTeamId
            : match.homeTeamId;
        const bronze = koMatches.find((m) => m.isBronze);
        if (bronze && loserId) {
          await prisma.match.update({
            where: { id: bronze.id },
            data: {
              ...(match.slotIndex === 0
                ? { homeTeamId: loserId }
                : { awayTeamId: loserId }),
              winnerTeamId: null,
              homeGoals: null,
              awayGoals: null,
              status: MatchStatus.PENDING,
            },
          });
        }
      }
    }

    const matches = await loadMatches(match.tournamentId);
    return NextResponse.json({ matches });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
