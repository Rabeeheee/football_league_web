export type PitchSlot = string;

export type FormationDef = {
  id: string;
  label: string;
  /** Short coaching note */
  blurb: string;
  /** Starter slots including GK — order used when remapping players */
  slots: string[];
  /** % positions on vertical pitch (top = attack, bottom = own goal) */
  positions: Record<string, { top: string; left: string }>;
};

/**
 * 5-a-side shapes (outfield numbers only; GK is separate).
 * Written defense → attack, per standard 5v5 coaching guides:
 * https://lineupdesk.com/5v5-soccer-formations/
 * https://drawtactics.com/5-a-side-football-formations
 */
export const FORMATIONS: FormationDef[] = [
  {
    id: "1-2-1",
    label: "1-2-1",
    blurb: "Diamond — 1 defender, 2 wide, 1 striker",
    slots: ["GK", "CB", "LM", "RM", "ST"],
    positions: {
      ST: { top: "14%", left: "50%" },
      LM: { top: "40%", left: "18%" },
      RM: { top: "40%", left: "82%" },
      CB: { top: "62%", left: "50%" },
      GK: { top: "86%", left: "50%" },
    },
  },
  {
    id: "2-1-1",
    label: "2-1-1",
    blurb: "Pyramid — 2 defenders, 1 mid, 1 striker",
    slots: ["GK", "LB", "RB", "CM", "ST"],
    positions: {
      ST: { top: "14%", left: "50%" },
      CM: { top: "40%", left: "50%" },
      LB: { top: "60%", left: "22%" },
      RB: { top: "60%", left: "78%" },
      GK: { top: "86%", left: "50%" },
    },
  },
  {
    id: "1-1-2",
    label: "1-1-2",
    blurb: "1 defender, 1 mid, 2 strikers",
    slots: ["GK", "CB", "CM", "LS", "RS"],
    positions: {
      LS: { top: "14%", left: "28%" },
      RS: { top: "14%", left: "72%" },
      CM: { top: "40%", left: "50%" },
      CB: { top: "62%", left: "50%" },
      GK: { top: "86%", left: "50%" },
    },
  },
  {
    id: "2-2",
    label: "2-2",
    blurb: "Box — 2 defenders, 2 forwards",
    slots: ["GK", "LB", "RB", "LM", "RM"],
    positions: {
      LM: { top: "18%", left: "28%" },
      RM: { top: "18%", left: "72%" },
      LB: { top: "58%", left: "28%" },
      RB: { top: "58%", left: "72%" },
      GK: { top: "86%", left: "50%" },
    },
  },
  {
    id: "1-3",
    label: "1-3",
    blurb: "Attacking — 1 defender, 3 up front",
    slots: ["GK", "CB", "LM", "ST", "RM"],
    positions: {
      LM: { top: "16%", left: "18%" },
      ST: { top: "14%", left: "50%" },
      RM: { top: "16%", left: "82%" },
      CB: { top: "58%", left: "50%" },
      GK: { top: "86%", left: "50%" },
    },
  },
  {
    id: "3-1",
    label: "3-1",
    blurb: "Defensive — 3 at the back, 1 striker",
    slots: ["GK", "LB", "CB", "RB", "ST"],
    positions: {
      ST: { top: "16%", left: "50%" },
      LB: { top: "52%", left: "18%" },
      CB: { top: "56%", left: "50%" },
      RB: { top: "52%", left: "82%" },
      GK: { top: "86%", left: "50%" },
    },
  },
];

export const DEFAULT_FORMATION = FORMATIONS[0]!.id;

export function getFormation(id: string | null | undefined): FormationDef {
  return FORMATIONS.find((f) => f.id === id) ?? FORMATIONS[0]!;
}

function parsePercent(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Remap starters onto a formation (labels + free % coords). */
export function applyFormationSlots<
  T extends {
    role: string;
    pitchSlot: string | null;
    sortOrder: number;
    posX?: number | null;
    posY?: number | null;
  },
>(players: T[], formation: FormationDef): T[] {
  const starters = players
    .filter((p) => p.role === "STARTER")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const others = players
    .filter((p) => p.role !== "STARTER")
    .map((p) => ({ ...p, posX: null, posY: null }));

  const remapped = starters.map((p, i) => {
    const slot = formation.slots[i] ?? p.pitchSlot ?? "ST";
    const pos = formation.positions[slot];
    return {
      ...p,
      pitchSlot: slot,
      posX: parsePercent(pos?.left, 50),
      posY: parsePercent(pos?.top, 50),
    };
  });
  return [...remapped, ...others];
}

export function clampPitchPercent(n: number) {
  return Math.min(92, Math.max(8, n));
}

/** Ensure starters have coords (from saved values or formation defaults). */
export function ensurePlayerCoords<
  T extends {
    role: string;
    pitchSlot: string | null;
    posX?: number | null;
    posY?: number | null;
    sortOrder: number;
  },
>(players: T[], formation: FormationDef): T[] {
  const hasCoords = players.some(
    (p) => p.role === "STARTER" && p.posX != null && p.posY != null,
  );
  if (hasCoords) {
    return players.map((p) => {
      if (p.role !== "STARTER") return { ...p, posX: null, posY: null };
      if (p.posX != null && p.posY != null) return p;
      const slot = p.pitchSlot ?? "ST";
      const pos = formation.positions[slot];
      return {
        ...p,
        posX: parsePercent(pos?.left, 50),
        posY: parsePercent(pos?.top, 50),
      };
    });
  }
  return applyFormationSlots(players, formation);
}

export const PITCH_SLOTS = getFormation(DEFAULT_FORMATION).slots;
export const SLOT_POSITIONS = getFormation(DEFAULT_FORMATION).positions;

export const STARTER_COUNT = 5;
export const SUB_COUNT = 2;

/**
 * Detect a formation code from free pitch positions.
 * Clusters all starters by vertical band (defense → attack).
 * Example: 1 deep + 3 mid + 1 high → "1-3-1"
 */
export function detectFormationFromPositions(
  players: { role: string; posX?: number | null; posY?: number | null }[],
): string {
  const starters = players.filter(
    (p) =>
      p.role === "STARTER" &&
      p.posX != null &&
      p.posY != null &&
      Number.isFinite(p.posX) &&
      Number.isFinite(p.posY),
  );
  if (starters.length < 2) return "Custom";

  // Sort defense → attack (our pitch: larger posY = closer to own goal)
  const sorted = [...starters].sort(
    (a, b) => (b.posY as number) - (a.posY as number),
  );

  const bands: number[][] = [];
  const threshold = 12; // % — players within this Y distance share a line

  for (const p of sorted) {
    const y = p.posY as number;
    const last = bands[bands.length - 1];
    if (!last) {
      bands.push([y]);
      continue;
    }
    const avg = last.reduce((s, v) => s + v, 0) / last.length;
    if (Math.abs(avg - y) <= threshold) {
      last.push(y);
    } else {
      bands.push([y]);
    }
  }

  // bands are defense → attack; counts become the formation string
  const counts = bands.map((b) => b.length);
  return counts.join("-");
}

export function isPresetFormation(id: string) {
  return FORMATIONS.some((f) => f.id === id);
}
