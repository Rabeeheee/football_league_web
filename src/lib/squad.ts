import type { FormationDef } from "@/lib/pitch";
import { PlayerRole } from "@/lib/roles";

export const MIN_STARTERS = 3;
export const MAX_STARTERS = 11;
export const MIN_SUBS = 0;
export const MAX_SUBS = 7;

export type SquadCounts = {
  starterCount: number;
  subCount: number;
};

export type DefaultPlayerSeed = {
  name: string;
  role: typeof PlayerRole.STARTER | typeof PlayerRole.SUB;
  pitchSlot: string | null;
  posX: number | null;
  posY: number | null;
  sortOrder: number;
};

function parsePercent(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Extra starter coords when squad is larger than a 5-slot preset. */
export function extraStarterPosition(indexBeyondSlots: number): {
  pitchSlot: string;
  posX: number;
  posY: number;
} {
  const col = indexBeyondSlots % 3;
  const row = Math.floor(indexBeyondSlots / 3);
  return {
    pitchSlot: "CM",
    posX: 25 + col * 25,
    posY: 42 + row * 10,
  };
}

export function clampSquadCounts(input: {
  starterCount?: number | null;
  subCount?: number | null;
}): SquadCounts {
  const starterCount = Math.min(
    MAX_STARTERS,
    Math.max(MIN_STARTERS, Math.trunc(input.starterCount ?? 5)),
  );
  const subCount = Math.min(
    MAX_SUBS,
    Math.max(MIN_SUBS, Math.trunc(input.subCount ?? 2)),
  );
  return { starterCount, subCount };
}

export function squadTotal(counts: SquadCounts) {
  return counts.starterCount + counts.subCount;
}

export function assertSquadShape(
  players: { role: string }[],
  counts: SquadCounts,
): string | null {
  const starters = players.filter((p) => p.role === "STARTER").length;
  const subs = players.filter((p) => p.role === "SUB").length;
  if (players.length !== squadTotal(counts)) {
    return `Squad must have exactly ${squadTotal(counts)} players`;
  }
  if (starters !== counts.starterCount || subs !== counts.subCount) {
    return `Need exactly ${counts.starterCount} starters and ${counts.subCount} substitutes`;
  }
  return null;
}

export function buildDefaultPlayers(
  starterCount: number,
  subCount: number,
  formation: FormationDef,
): DefaultPlayerSeed[] {
  const counts = clampSquadCounts({ starterCount, subCount });
  const players: DefaultPlayerSeed[] = [];

  for (let i = 0; i < counts.starterCount; i++) {
    const slot = formation.slots[i];
    if (slot) {
      const pos = formation.positions[slot];
      players.push({
        name: `Player ${i + 1}`,
        role: PlayerRole.STARTER,
        pitchSlot: slot,
        posX: parsePercent(pos?.left, 50),
        posY: parsePercent(pos?.top, 50),
        sortOrder: i,
      });
    } else {
      const extra = extraStarterPosition(i - formation.slots.length);
      players.push({
        name: `Player ${i + 1}`,
        role: PlayerRole.STARTER,
        pitchSlot: extra.pitchSlot,
        posX: extra.posX,
        posY: extra.posY,
        sortOrder: i,
      });
    }
  }

  for (let i = 0; i < counts.subCount; i++) {
    players.push({
      name: `Sub ${i + 1}`,
      role: PlayerRole.SUB,
      pitchSlot: null,
      posX: null,
      posY: null,
      sortOrder: counts.starterCount + i,
    });
  }

  return players;
}

export function isPlaceholderName(name: string, role: string) {
  if (role === "STARTER") return /^Player \d+$/i.test(name.trim());
  if (role === "SUB") return /^Sub \d+$/i.test(name.trim());
  return false;
}

/**
 * Prefer dropping placeholder names first, then highest sortOrder.
 */
export function pickPlayersToRemove<
  T extends { id: string; name: string; role: string; sortOrder: number },
>(players: T[], removeCount: number): T[] {
  if (removeCount <= 0) return [];
  const ranked = [...players].sort((a, b) => {
    const ap = isPlaceholderName(a.name, a.role) ? 0 : 1;
    const bp = isPlaceholderName(b.name, b.role) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return b.sortOrder - a.sortOrder;
  });
  return ranked.slice(0, removeCount);
}
