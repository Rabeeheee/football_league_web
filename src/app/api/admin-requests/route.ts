import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Role } from "@/lib/roles";

export async function GET() {
  const session = await requireRole([Role.LEAGUE_ADMIN]);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pending = await prisma.user.findMany({
    where: { role: Role.PENDING_ADMIN },
    select: { id: true, name: true, email: true, image: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ pending });
}

const actionSchema = z.object({
  userId: z.string(),
  action: z.enum(["approve", "reject"]),
});

export async function PATCH(req: Request) {
  const session = await requireRole([Role.LEAGUE_ADMIN]);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { userId, action } = actionSchema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== Role.PENDING_ADMIN) {
      return NextResponse.json(
        { error: "No pending admin request for that user" },
        { status: 400 },
      );
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        role: action === "approve" ? Role.LEAGUE_ADMIN : Role.VISITOR,
      },
      select: { id: true, name: true, email: true, role: true },
    });

    return NextResponse.json({ user: updated });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
