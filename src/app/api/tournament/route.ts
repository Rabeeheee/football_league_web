import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Role } from "@/lib/roles";
import { resizeAllTeamRosters } from "@/lib/resize-rosters";
import {
  MAX_STARTERS,
  MAX_SUBS,
  MIN_STARTERS,
  MIN_SUBS,
  clampSquadCounts,
} from "@/lib/squad";

export async function GET() {
  let tournament = await prisma.tournament.findFirst({
    include: { _count: { select: { teams: true, matches: true } } },
  });
  if (!tournament) {
    tournament = await prisma.tournament.create({
      data: {
        name: "Culvert Football League",
        teamSlots: 8,
        entryFee: 100,
        starterCount: 5,
        subCount: 2,
      },
      include: { _count: { select: { teams: true, matches: true } } },
    });
  }
  return NextResponse.json({ tournament });
}

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  teamSlots: z.number().int().min(2).max(64).optional(),
  entryFee: z.number().int().min(0).optional(),
  starterCount: z.number().int().min(MIN_STARTERS).max(MAX_STARTERS).optional(),
  subCount: z.number().int().min(MIN_SUBS).max(MAX_SUBS).optional(),
});

export async function PATCH(req: Request) {
  const session = await requireRole([Role.LEAGUE_ADMIN]);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = updateSchema.parse(await req.json());
    let tournament = await prisma.tournament.findFirst();

    const nextCounts = clampSquadCounts({
      starterCount: body.starterCount ?? tournament?.starterCount ?? 5,
      subCount: body.subCount ?? tournament?.subCount ?? 2,
    });

    const countsChanged =
      !!tournament &&
      (tournament.starterCount !== nextCounts.starterCount ||
        tournament.subCount !== nextCounts.subCount);

    if (!tournament) {
      tournament = await prisma.tournament.create({
        data: {
          name: body.name ?? "Culvert Football League",
          teamSlots: body.teamSlots ?? 8,
          entryFee: body.entryFee ?? 100,
          starterCount: nextCounts.starterCount,
          subCount: nextCounts.subCount,
        },
      });
    } else {
      tournament = await prisma.tournament.update({
        where: { id: tournament.id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.teamSlots !== undefined
            ? { teamSlots: body.teamSlots }
            : {}),
          ...(body.entryFee !== undefined ? { entryFee: body.entryFee } : {}),
          starterCount: nextCounts.starterCount,
          subCount: nextCounts.subCount,
        },
      });
    }

    if (countsChanged) {
      await resizeAllTeamRosters(tournament.id, nextCounts);
    }

    return NextResponse.json({
      tournament,
      rostersResized: countsChanged,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 500 },
    );
  }
}
