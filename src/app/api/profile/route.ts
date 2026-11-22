import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      passwordHash: true,
      managedTeam: { select: { id: true, name: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      hasPassword: !!user.passwordHash,
      managedTeam: user.managedTeam,
    },
  });
}

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  image: z.string().nullable().optional(),
  currentPassword: z.string().min(1).max(100).optional(),
  newPassword: z.string().min(6).max(100).optional(),
});

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = patchSchema.parse(await req.json());
    const existing = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const data: {
      name?: string;
      image?: string | null;
      passwordHash?: string;
    } = {};

    if (body.name !== undefined) data.name = body.name;
    if (body.image !== undefined) data.image = body.image;

    if (body.newPassword) {
      if (existing.passwordHash) {
        if (!body.currentPassword) {
          return NextResponse.json(
            { error: "Current password is required" },
            { status: 400 },
          );
        }
        const ok = await bcrypt.compare(
          body.currentPassword,
          existing.passwordHash,
        );
        if (!ok) {
          return NextResponse.json(
            { error: "Current password is incorrect" },
            { status: 400 },
          );
        }
      }
      data.passwordHash = await bcrypt.hash(body.newPassword, 10);
    }

    const user = await prisma.user.update({
      where: { id: existing.id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        passwordHash: true,
        managedTeam: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
        hasPassword: !!user.passwordHash,
        managedTeam: user.managedTeam,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 400 },
    );
  }
}
