import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, requireRole } from "@/lib/session";
import { Role } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      manager: { select: { id: true, name: true, email: true } },
      players: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!team) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ team });
}

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  logoUrl: z.string().optional().nullable(),
  formation: z.string().optional(),
  managerEmail: z.string().email().optional().nullable(),
  managerName: z.string().min(2).max(80).optional().nullable(),
  managerPassword: z.string().min(6).max(100).optional().nullable(),
});

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === Role.LEAGUE_ADMIN;
  const isManager = team.managerId === session.user.id;
  if (!isAdmin && !isManager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = updateSchema.parse(await req.json());
    const data: {
      name?: string;
      logoUrl?: string | null;
      formation?: string;
      managerId?: string | null;
    } = {};

    if (body.name !== undefined) data.name = body.name.trim();
    if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl;
    if (body.formation !== undefined) data.formation = body.formation;

    if (isAdmin && body.managerEmail !== undefined) {
      if (!body.managerEmail) {
        data.managerId = null;
      } else {
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
        } else if (manager.role === Role.VISITOR) {
          manager = await prisma.user.update({
            where: { id: manager.id },
            data: { role: Role.TEAM_MANAGER },
          });
        }
        data.managerId = manager.id;
      }
    }

    const updated = await prisma.team.update({
      where: { id },
      data,
      include: {
        manager: { select: { id: true, name: true, email: true } },
        players: { orderBy: { sortOrder: "asc" } },
      },
    });

    return NextResponse.json({ team: updated });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await requireRole([Role.LEAGUE_ADMIN]);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await prisma.team.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
