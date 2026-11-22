import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Role } from "@/lib/roles";
import { AdminPanel } from "@/components/admin-panel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await requireRole([Role.LEAGUE_ADMIN]);
  if (!session) redirect("/login");

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

  const [teams, pendingAdmins] = await Promise.all([
    prisma.team.findMany({
      where: { tournamentId: tournament.id },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        _count: { select: { players: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: Role.PENDING_ADMIN },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-3 py-6 sm:px-4 sm:py-10">
      <h1 className="font-display text-2xl text-white sm:text-3xl">
        League admin
      </h1>
      <p className="mt-2 mb-6 text-sm text-white/60 sm:mb-8">
        Approve admin requests, configure slots, create teams, assign managers.
      </p>
      <AdminPanel
        tournament={tournament}
        teams={teams}
        pendingAdmins={pendingAdmins}
      />
    </main>
  );
}
