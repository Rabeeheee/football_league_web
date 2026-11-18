import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { PlayerRole, Role } from "@/lib/roles";
import { DEFAULT_FORMATION, getFormation } from "@/lib/pitch";

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
  managerEmail: z.preprocess(
    emptyToNull,
    z.string().email().nullable().optional(),
  ),
  managerName: z.preprocess(
    emptyToNull,
    z.string().min(2).max(80).nullable().optional(),
  ),
  managerPassword: z.preprocess(
    emptyToNull,
    z.string().min(6).max(100).nullable().optional(),
  ),
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
        data: { name: "Culvert Football League", teamSlots: 8, entryFee: 100 },
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

    let managerId: string | undefined;
    if (body.managerEmail) {
      const email = body.managerEmail.toLowerCase().trim();
      let manager = await prisma.user.findUnique({ where: { email } });
      if (!manager) {
        if (!body.managerPassword || !body.managerName) {
          return NextResponse.json(
            {
              error:
                "New manager requires managerName and managerPassword",
            },
            { status: 400 },
          );
        }
        const bcrypt = await import("bcryptjs");
        const passwordHash = await bcrypt.hash(body.managerPassword, 10);
        manager = await prisma.user.create({
          data: {
            email,
            name: body.managerName.trim(),
            passwordHash,
            role: Role.TEAM_MANAGER,
          },
        });
      } else {
        if (manager.role === Role.VISITOR) {
          manager = await prisma.user.update({
            where: { id: manager.id },
            data: { role: Role.TEAM_MANAGER },
          });
        }
        const alreadyManaging = await prisma.team.findUnique({
          where: { managerId: manager.id },
        });
        if (alreadyManaging) {
          return NextResponse.json(
            { error: "That user already manages a team" },
            { status: 400 },
          );
        }
      }
      managerId = manager.id;
    }

    const formation = getFormation(DEFAULT_FORMATION);
    const defaultNames = [
      "Player 1",
      "Player 2",
      "Player 3",
      "Player 4",
      "Player 5",
      "Sub 1",
      "Sub 2",
    ];

    const team = await prisma.team.create({
      data: {
        name: body.name.trim(),
        logoUrl: body.logoUrl || null,
        formation: formation.id,
        tournamentId: tournament.id,
        managerId: managerId ?? null,
        players: {
          create: defaultNames.map((name, i) => {
            const slot = i < 5 ? formation.slots[i]! : null;
            const pos = slot ? formation.positions[slot] : null;
            return {
              name,
              role: i < 5 ? PlayerRole.STARTER : PlayerRole.SUB,
              pitchSlot: slot,
              posX: pos ? Number.parseFloat(pos.left) : null,
              posY: pos ? Number.parseFloat(pos.top) : null,
              sortOrder: i,
            };
          }),
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
