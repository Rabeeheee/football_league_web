import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Role } from "@/lib/roles";
import { DEFAULT_FORMATION, getFormation } from "@/lib/pitch";
import { buildDefaultPlayers, clampSquadCounts } from "@/lib/squad";

export async function GET() {
  const teams = await prisma.team.findMany({
    include: {
      manager: { select: { id: true, name: true, email: true } },
      players: { orderBy: { sortOrder: "asc" } },
      _count: { select: { players: true } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ teams });
}

const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

const createSchema = z.object({
  name: z.string().min(2).max(80),
  logoUrl: z.preprocess(emptyToNull, z.string().nullable().optional()),
  managerEmail: z.string().trim().email("Manager email is required"),
  managerName: z.string().trim().min(2, "Manager name is required").max(80),
});

export async function POST(req: Request) {
  const session = await requireRole([Role.LEAGUE_ADMIN]);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = createSchema.parse(await req.json());
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

    const teamCount = await prisma.team.count({
      where: { tournamentId: tournament.id },
    });
    if (teamCount >= tournament.teamSlots) {
      return NextResponse.json(
        { error: `Team limit reached (${tournament.teamSlots})` },
        { status: 400 },
      );
    }

    const email = body.managerEmail.toLowerCase().trim();
    let manager = await prisma.user.findUnique({ where: { email } });
    if (!manager) {
      // No password — manager signs in with Google using this email
      manager = await prisma.user.create({
        data: {
          email,
          name: body.managerName.trim(),
          passwordHash: null,
          role: Role.TEAM_MANAGER,
        },
      });
    } else {
      const alreadyManaging = await prisma.team.findUnique({
        where: { managerId: manager.id },
      });
      if (alreadyManaging) {
        return NextResponse.json(
          { error: "That user already manages a team" },
          { status: 400 },
        );
      }
      // Existing account: attach as manager (keep their password; form password ignored)
      if (
        manager.role === Role.VISITOR ||
        manager.role === Role.PENDING_ADMIN ||
        manager.role === Role.TEAM_MANAGER
      ) {
        manager = await prisma.user.update({
          where: { id: manager.id },
          data: {
            role: Role.TEAM_MANAGER,
            name: body.managerName.trim() || manager.name,
          },
        });
      } else if (manager.role === Role.LEAGUE_ADMIN) {
        // Admins can also manage a team without demoting
        manager = await prisma.user.update({
          where: { id: manager.id },
          data: { name: body.managerName.trim() || manager.name },
        });
      }
    }
    const managerId = manager.id;

    const formation = getFormation(DEFAULT_FORMATION);
    const counts = clampSquadCounts({
      starterCount: tournament.starterCount,
      subCount: tournament.subCount,
    });
    const defaultPlayers = buildDefaultPlayers(
      counts.starterCount,
      counts.subCount,
      formation,
    );

    const team = await prisma.team.create({
      data: {
        name: body.name.trim(),
        logoUrl: body.logoUrl || null,
        formation: formation.id,
        tournamentId: tournament.id,
        managerId: managerId ?? null,
        players: {
          create: defaultPlayers,
        },
      },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        players: { orderBy: { sortOrder: "asc" } },
      },
    });

    return NextResponse.json({ team }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}
