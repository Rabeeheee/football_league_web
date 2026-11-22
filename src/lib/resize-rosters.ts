import { prisma } from "@/lib/prisma";
import { getFormation } from "@/lib/pitch";
import {
  buildDefaultPlayers,
  clampSquadCounts,
  pickPlayersToRemove,
  type SquadCounts,
} from "@/lib/squad";
import { PlayerRole } from "@/lib/roles";

/** Resize every team in a tournament to match starter/sub counts. */
export async function resizeAllTeamRosters(
  tournamentId: string,
  countsInput: SquadCounts,
) {
  const counts = clampSquadCounts(countsInput);
  const teams = await prisma.team.findMany({
    where: { tournamentId },
    include: { players: { orderBy: { sortOrder: "asc" } } },
  });

  for (const team of teams) {
    const formation = getFormation(team.formation);
    const starters = team.players.filter((p) => p.role === PlayerRole.STARTER);
    const subs = team.players.filter((p) => p.role === PlayerRole.SUB);

    const starterRemove = pickPlayersToRemove(
      starters,
      Math.max(0, starters.length - counts.starterCount),
    );
    const subRemove = pickPlayersToRemove(
      subs,
      Math.max(0, subs.length - counts.subCount),
    );
    const removeIds = new Set(
      [...starterRemove, ...subRemove].map((p) => p.id),
    );

    const keptStarters = starters.filter((p) => !removeIds.has(p.id));
    const keptSubs = subs.filter((p) => !removeIds.has(p.id));

    const defaults = buildDefaultPlayers(
      counts.starterCount,
      counts.subCount,
      formation,
    );
    const starterSeeds = defaults.filter((d) => d.role === PlayerRole.STARTER);
    const subSeeds = defaults.filter((d) => d.role === PlayerRole.SUB);

    const startersToAdd = Math.max(
      0,
      counts.starterCount - keptStarters.length,
    );
    const subsToAdd = Math.max(0, counts.subCount - keptSubs.length);

    await prisma.$transaction(async (tx) => {
      if (removeIds.size > 0) {
        await tx.player.deleteMany({
          where: { id: { in: [...removeIds] } },
        });
      }

      // Ensure kept starters have coords / slots
      for (let i = 0; i < keptStarters.length; i++) {
        const seed = starterSeeds[i]!;
        const p = keptStarters[i]!;
        await tx.player.update({
          where: { id: p.id },
          data: {
            role: PlayerRole.STARTER,
            pitchSlot: p.pitchSlot || seed.pitchSlot,
            posX: p.posX ?? seed.posX,
            posY: p.posY ?? seed.posY,
            sortOrder: i,
          },
        });
      }

      for (let i = 0; i < keptSubs.length; i++) {
        const p = keptSubs[i]!;
        await tx.player.update({
          where: { id: p.id },
          data: {
            role: PlayerRole.SUB,
            pitchSlot: null,
            posX: null,
            posY: null,
            sortOrder: counts.starterCount + i,
          },
        });
      }

      for (let i = 0; i < startersToAdd; i++) {
        const seed = starterSeeds[keptStarters.length + i]!;
        await tx.player.create({
          data: {
            teamId: team.id,
            name: seed.name,
            role: seed.role,
            pitchSlot: seed.pitchSlot,
            posX: seed.posX,
            posY: seed.posY,
            sortOrder: keptStarters.length + i,
          },
        });
      }

      for (let i = 0; i < subsToAdd; i++) {
        const seed = subSeeds[keptSubs.length + i]!;
        await tx.player.create({
          data: {
            teamId: team.id,
            name: seed.name,
            role: seed.role,
            pitchSlot: null,
            posX: null,
            posY: null,
            sortOrder: counts.starterCount + keptSubs.length + i,
          },
        });
      }
    });
  }

  return counts;
}
