import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { Role } from "@/lib/roles";
import { detectFormationFromPositions, isPresetFormation } from "@/lib/pitch";
import { assertSquadShape, clampSquadCounts, squadTotal } from "@/lib/squad";

const playerSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(80),
  role: z.enum(["STARTER", "SUB"]),
  pitchSlot: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  posX: z.number().min(0).max(100).nullable().optional(),
  posY: z.number().min(0).max(100).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

const updateSchema = z.object({
  teamId: z.string(),
  formation: z.string().min(1).max(40).optional(),
  players: z.array(playerSchema).min(3).max(18),
});

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = updateSchema.parse(await req.json());
    const team = await prisma.team.findUnique({
      where: { id: body.teamId },
      include: { tournament: true },
    });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const isAdmin = session.user.role === Role.LEAGUE_ADMIN;
    const isManager = team.managerId === session.user.id;
    if (!isAdmin && !isManager) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const counts = clampSquadCounts({
      starterCount: team.tournament.starterCount,
      subCount: team.tournament.subCount,
    });

    if (body.players.length !== squadTotal(counts)) {
      return NextResponse.json(
        {
          error: `Squad must have exactly ${squadTotal(counts)} players (${counts.starterCount}+${counts.subCount})`,
        },
        { status: 400 },
      );
    }

    const shapeError = assertSquadShape(body.players, counts);
    if (shapeError) {
      return NextResponse.json({ error: shapeError }, { status: 400 });
    }

    const starters = body.players.filter((p) => p.role === "STARTER");
    for (const p of starters) {
      if (p.posX == null || p.posY == null) {
        return NextResponse.json(
          { error: "Each starter needs a pitch position" },
          { status: 400 },
        );
      }
      if (!p.pitchSlot) {
        return NextResponse.json(
          { error: "Each starter needs a position label" },
          { status: 400 },
        );
      }
    }

    const existingIds = new Set(
      (
        await prisma.player.findMany({
          where: { teamId: body.teamId },
          select: { id: true },
        })
      ).map((p) => p.id),
    );
    for (const p of body.players) {
      if (!existingIds.has(p.id)) {
        return NextResponse.json(
          { error: "Unknown player id — refresh and try again" },
          { status: 400 },
        );
      }
    }

    const detected = detectFormationFromPositions(body.players);
    const formationId = (body.formation?.trim() || detected || team.formation)
      .slice(0, 40);

    if (
      !isPresetFormation(formationId) &&
      !/^\d+(-\d+)+$/.test(formationId) &&
      formationId !== "Custom"
    ) {
      return NextResponse.json(
        { error: "Invalid formation" },
        { status: 400 },
      );
    }

    await prisma.$transaction([
      prisma.team.update({
        where: { id: body.teamId },
        data: { formation: formationId },
      }),
      ...body.players.map((p, index) =>
        prisma.player.update({
          where: { id: p.id },
          data: {
            name: p.name.trim(),
            role: p.role,
            pitchSlot: p.role === "STARTER" ? p.pitchSlot ?? null : null,
            avatarUrl: p.avatarUrl ?? null,
            posX: p.role === "STARTER" ? p.posX ?? null : null,
            posY: p.role === "STARTER" ? p.posY ?? null : null,
            sortOrder: p.sortOrder ?? index,
          },
        }),
      ),
    ]);

    const updatedTeam = await prisma.team.findUnique({
      where: { id: body.teamId },
      include: { players: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json({
      players: updatedTeam?.players ?? [],
      formation: updatedTeam?.formation,
      detectedFormation: detected,
      starterCount: counts.starterCount,
      subCount: counts.subCount,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Update failed",
      },
      { status: 500 },
    );
  }
}
