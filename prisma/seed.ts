import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Role } from "../src/lib/roles";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  await prisma.user.upsert({
    where: { email: "admin@league.local" },
    update: {},
    create: {
      email: "admin@league.local",
      name: "League Admin",
      passwordHash,
      role: Role.LEAGUE_ADMIN,
    },
  });

  const existing = await prisma.tournament.findFirst();
  if (!existing) {
    await prisma.tournament.create({
      data: {
        name: "Culvert Football League",
        teamSlots: 8,
        entryFee: 100,
        starterCount: 5,
        subCount: 2,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
