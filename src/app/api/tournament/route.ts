import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Role } from "@/lib/roles";

export async function GET() {
  let tournament = await prisma.tournament.findFirst({
    include: { _count: { select: { teams: true, matches: true } } },
  });
  if (!tournament) {
    tournament = await prisma.tournament.create({
      data: { name: "Culvert Football League", teamSlots: 8, entryFee: 100 },
      include: { _count: { select: { teams: true, matches: true } } },
    });
  }
  return NextResponse.json({ tournament });
}

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  teamSlots: z.number().int().min(2).max(64).optional(),
  entryFee: z.number().int().min(0).optional(),
});

export async function PATCH(req: Request) {
  const session = await requireRole([Role.LEAGUE_ADMIN]);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = updateSchema.parse(await req.json());
    let tournament = await prisma.tournament.findFirst();
    if (!tournament) {
      tournament = await prisma.tournament.create({
        data: {
          name: body.name ?? "Culvert Football League",
          teamSlots: body.teamSlots ?? 8,
          entryFee: body.entryFee ?? 100,
        },
      });
    } else {
      tournament = await prisma.tournament.update({
        where: { id: tournament.id },
        data: body,
      });
    }
    return NextResponse.json({ tournament });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
