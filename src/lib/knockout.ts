import type { StandingRow } from "@/lib/standings";

export const MatchPhase = {
  LEAGUE: "LEAGUE",
  KNOCKOUT: "KNOCKOUT",
} as const;

export type MatchPhase = (typeof MatchPhase)[keyof typeof MatchPhase];

/** Largest power of 2 that is <= n and at least 2 (knockout field size). */
export function knockoutFieldSize(teamCount: number): number {
  if (teamCount < 2) return 0;
  let p = 1;
  while (p * 2 <= teamCount) p *= 2;
  return Math.max(2, p);
}

export function knockoutRoundCount(fieldSize: number): number {
  if (fieldSize < 2) return 0;
  return Math.log2(fieldSize);
}

export function knockoutRoundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - 1 - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semi-finals";
  if (fromEnd === 2) return "Quarter-finals";
  if (fromEnd === 3) return "Round of 16";
  return `Round of ${Math.pow(2, fromEnd + 1)}`;
}

export type KnockoutSlot = {
  round: number;
  slotIndex: number;
  isBronze: boolean;
  homeTeamId: string | null;
  awayTeamId: string | null;
};

/**
 * Build knockout tree for top `fieldSize` standings (1 vs last, 2 vs 2nd-last, …).
 * Includes a bronze match when there are semi-finals.
 */
export function buildKnockoutFromStandings(
  standings: StandingRow[],
  fieldSize?: number,
): { fieldSize: number; rounds: number; slots: KnockoutSlot[] } {
  const size = fieldSize ?? knockoutFieldSize(standings.length);
  const rounds = knockoutRoundCount(size);
  const seeds = standings.slice(0, size).map((r) => r.team.id);
  const slots: KnockoutSlot[] = [];

  // First round: 1st vs last, 2nd vs 2nd-last, …
  const firstRoundMatches = size / 2;
  for (let i = 0; i < firstRoundMatches; i++) {
    slots.push({
      round: 0,
      slotIndex: i,
      isBronze: false,
      homeTeamId: seeds[i] ?? null,
      awayTeamId: seeds[size - 1 - i] ?? null,
    });
  }

  // Later rounds empty until winners advance
  for (let round = 1; round < rounds; round++) {
    const count = size / Math.pow(2, round + 1);
    for (let slotIndex = 0; slotIndex < count; slotIndex++) {
      slots.push({
        round,
        slotIndex,
        isBronze: false,
        homeTeamId: null,
        awayTeamId: null,
      });
    }
  }

  // Bronze final (3rd place) when we have at least semis
  if (rounds >= 2) {
    slots.push({
      round: rounds - 1,
      slotIndex: 1,
      isBronze: true,
      homeTeamId: null,
      awayTeamId: null,
    });
  }

  return { fieldSize: size, rounds, slots };
}

export function knockoutParent(
  round: number,
  slotIndex: number,
): { round: number; slotIndex: number; isHome: boolean } {
  return {
    round: round + 1,
    slotIndex: Math.floor(slotIndex / 2),
    isHome: slotIndex % 2 === 0,
  };
}
