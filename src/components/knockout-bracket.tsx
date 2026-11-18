"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Match, Team } from "@prisma/client";
import { knockoutRoundCount, knockoutRoundLabel } from "@/lib/knockout";

export type MatchWithTeams = Match & {
  homeTeam: Team | null;
  awayTeam: Team | null;
  winnerTeam: Team | null;
};

type Props = {
  matches: MatchWithTeams[];
  isAdmin: boolean;
  busy: boolean;
  onSubmit: (matchId: string, homeGoals: number, awayGoals: number) => void;
};

const MATCH_H = 118;
const MATCH_GAP_BASE = 36;
const COL_W = 220;
const COL_GAP = 56;

export function KnockoutBracket({
  matches,
  isAdmin,
  busy,
  onSubmit,
}: Props) {
  const [mobileRound, setMobileRound] = useState(0);
  const [paths, setPaths] = useState<string[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);
  const matchRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const mainMatches = useMemo(
    () => matches.filter((m) => !m.isBronze),
    [matches],
  );
  const bronze = matches.find((m) => m.isBronze) ?? null;

  const firstRoundCount = mainMatches.filter((m) => m.round === 0).length || 1;
  const fieldSize = firstRoundCount * 2;
  const rounds = knockoutRoundCount(fieldSize);

  const byRound = useMemo(() => {
    const map: MatchWithTeams[][] = Array.from({ length: rounds }, () => []);
    for (const m of mainMatches) {
      if (m.round >= 0 && m.round < rounds) map[m.round]!.push(m);
    }
    for (const list of map) list.sort((a, b) => a.slotIndex - b.slotIndex);
    return map;
  }, [mainMatches, rounds]);

  const roundLabels = useMemo(
    () =>
      Array.from({ length: rounds }, (_, r) =>
        knockoutRoundLabel(r, rounds),
      ),
    [rounds],
  );

  function matchTop(round: number, slotIndex: number) {
    const step = (MATCH_H + MATCH_GAP_BASE) * Math.pow(2, round);
    const offset = ((MATCH_H + MATCH_GAP_BASE) * (Math.pow(2, round) - 1)) / 2;
    return offset + slotIndex * step;
  }

  const bracketHeight = useMemo(() => {
    return firstRoundCount * (MATCH_H + MATCH_GAP_BASE) + 40;
  }, [firstRoundCount]);

  const finalMatch = byRound[rounds - 1]?.[0] ?? null;
  const championTeam =
    finalMatch?.status === "COMPLETED" ? finalMatch.winnerTeam : null;

  const drawConnectors = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const stageBox = stage.getBoundingClientRect();
    const next: string[] = [];

    for (let round = 0; round < rounds - 1; round++) {
      const feeders = byRound[round] ?? [];
      for (const match of feeders) {
        const parentSlot = Math.floor(match.slotIndex / 2);
        const parent = byRound[round + 1]?.find(
          (m) => m.slotIndex === parentSlot,
        );
        if (!parent) continue;

        const fromEl = matchRefs.current.get(match.id);
        const toEl = matchRefs.current.get(parent.id);
        if (!fromEl || !toEl) continue;

        const a = fromEl.getBoundingClientRect();
        const b = toEl.getBoundingClientRect();
        const x1 = a.right - stageBox.left;
        const y1 = a.top + a.height / 2 - stageBox.top;
        const x2 = b.left - stageBox.left;
        const y2 = b.top + b.height / 2 - stageBox.top;
        const mid = x1 + (x2 - x1) / 2;
        next.push(`M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`);
      }
    }
    setPaths(next);
  }, [byRound, rounds]);

  useLayoutEffect(() => {
    drawConnectors();
  }, [drawConnectors, matches, bracketHeight]);

  useEffect(() => {
    const onResize = () => drawConnectors();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [drawConnectors]);

  useEffect(() => {
    if (mobileRound > rounds) setMobileRound(0);
  }, [mobileRound, rounds]);

  const stageWidth = rounds * COL_W + (rounds - 1) * COL_GAP + 180;

  if (mainMatches.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Mobile: round tabs */}
      <div className="lg:hidden">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {roundLabels.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setMobileRound(i)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold ${
                mobileRound === i
                  ? "bg-amber-500 text-black"
                  : "bg-white/10 text-white/60"
              }`}
            >
              {label}
            </button>
          ))}
          {bronze && (
            <button
              type="button"
              onClick={() => setMobileRound(rounds)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold ${
                mobileRound === rounds
                  ? "bg-amber-500 text-black"
                  : "bg-white/10 text-white/60"
              }`}
            >
              3rd place
            </button>
          )}
        </div>
        <div className="space-y-3">
          {(mobileRound === rounds
            ? bronze
              ? [bronze]
              : []
            : byRound[mobileRound] ?? []
          ).map((m) => (
            <BracketMatchCard
              key={m.id}
              match={m}
              isAdmin={isAdmin}
              busy={busy}
              onSubmit={onSubmit}
              wide
            />
          ))}
        </div>
      </div>

      {/* Desktop: classic L→R bracket tree */}
      <div className="hidden overflow-x-auto rounded-2xl border border-white/10 bg-[#040a07] lg:block">
        <div
          className="relative p-6 xl:p-8"
          style={{ minWidth: stageWidth, minHeight: bracketHeight + 100 }}
        >
          <div className="mb-6 flex" style={{ gap: COL_GAP }}>
            {roundLabels.map((label) => (
              <div
                key={label}
                className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/50"
                style={{ width: COL_W }}
              >
                {label}
              </div>
            ))}
            <div
              className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/50"
              style={{ width: 140 }}
            >
              Winner
            </div>
          </div>

          <div
            ref={stageRef}
            className="relative"
            style={{ height: bracketHeight, width: stageWidth - 64 }}
          >
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              aria-hidden
            >
              {paths.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke="rgba(251, 191, 36, 0.28)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </svg>

            {byRound.map((roundMatches, round) => (
              <div
                key={round}
                className="absolute top-0"
                style={{ left: round * (COL_W + COL_GAP), width: COL_W }}
              >
                {roundMatches.map((m) => (
                  <div
                    key={m.id}
                    ref={(el) => {
                      if (el) matchRefs.current.set(m.id, el);
                      else matchRefs.current.delete(m.id);
                    }}
                    className="absolute left-0 w-full"
                    style={{ top: matchTop(round, m.slotIndex) }}
                  >
                    <BracketMatchCard
                      match={m}
                      isAdmin={isAdmin}
                      busy={busy}
                      onSubmit={onSubmit}
                    />
                  </div>
                ))}
              </div>
            ))}

            <div
              className="absolute"
              style={{
                left: rounds * (COL_W + COL_GAP),
                top: matchTop(rounds - 1, 0) + MATCH_H / 2 - 36,
                width: 140,
              }}
            >
              <div className="rounded-xl border border-amber-400/50 bg-amber-500/10 p-3 text-center shadow-[0_0_30px_rgba(245,158,11,0.15)]">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-amber-200/70">
                  Champion
                </p>
                <div className="mt-2 flex justify-center">
                  <TeamBadge team={championTeam} large />
                </div>
                <p className="mt-1 truncate text-xs font-semibold text-white">
                  {championTeam?.name ?? "?"}
                </p>
              </div>
            </div>
          </div>

          {bronze && (
            <div className="mt-10 border-t border-white/10 pt-6">
              <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                Bronze · 3rd place
              </p>
              <div className="mx-auto max-w-xs">
                <BracketMatchCard
                  match={bronze}
                  isAdmin={isAdmin}
                  busy={busy}
                  onSubmit={onSubmit}
                  wide
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BracketMatchCard({
  match,
  isAdmin,
  busy,
  onSubmit,
  wide,
}: {
  match: MatchWithTeams;
  isAdmin: boolean;
  busy: boolean;
  onSubmit: (matchId: string, homeGoals: number, awayGoals: number) => void;
  wide?: boolean;
}) {
  const [homeGoals, setHomeGoals] = useState(
    match.homeGoals != null ? String(match.homeGoals) : "",
  );
  const [awayGoals, setAwayGoals] = useState(
    match.awayGoals != null ? String(match.awayGoals) : "",
  );

  useEffect(() => {
    setHomeGoals(match.homeGoals != null ? String(match.homeGoals) : "");
    setAwayGoals(match.awayGoals != null ? String(match.awayGoals) : "");
  }, [match.homeGoals, match.awayGoals, match.id]);

  const ready =
    isAdmin && !busy && !!match.homeTeamId && !!match.awayTeamId;
  const canSave =
    ready &&
    homeGoals !== "" &&
    awayGoals !== "" &&
    Number(homeGoals) !== Number(awayGoals);
  const completed = match.status === "COMPLETED";

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border bg-[#0d1511] shadow-lg ${
        completed ? "border-amber-500/40" : "border-white/12"
      } ${wide ? "" : "min-h-[118px]"}`}
    >
      <TeamLine
        team={match.homeTeam}
        winner={match.winnerTeamId === match.homeTeamId}
        goals={completed ? match.homeGoals : null}
      />
      <div className="border-t border-white/10" />
      <TeamLine
        team={match.awayTeam}
        winner={match.winnerTeamId === match.awayTeamId}
        goals={completed ? match.awayGoals : null}
      />

      {ready ? (
        <div className="mt-auto flex items-center gap-1.5 border-t border-white/10 bg-[#08110c] px-2 py-1.5">
          <input
            type="number"
            min={0}
            max={99}
            inputMode="numeric"
            aria-label="Home goals"
            placeholder="0"
            value={homeGoals}
            onChange={(e) => setHomeGoals(e.target.value)}
            className="w-9 rounded border border-white/20 bg-black/50 px-1 py-0.5 text-center text-xs text-white"
          />
          <span className="text-[10px] text-white/35">–</span>
          <input
            type="number"
            min={0}
            max={99}
            inputMode="numeric"
            aria-label="Away goals"
            placeholder="0"
            value={awayGoals}
            onChange={(e) => setAwayGoals(e.target.value)}
            className="w-9 rounded border border-white/20 bg-black/50 px-1 py-0.5 text-center text-xs text-white"
          />
          <span className="text-[9px] text-amber-200/50">no draw</span>
          <button
            type="button"
            disabled={!canSave}
            className="ml-auto rounded bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-black hover:bg-amber-400 disabled:opacity-40"
            onClick={() =>
              onSubmit(match.id, Number(homeGoals), Number(awayGoals))
            }
          >
            {completed ? "Update" : "Save"}
          </button>
        </div>
      ) : !match.homeTeamId || !match.awayTeamId ? (
        <div className="mt-auto border-t border-white/5 px-2 py-1.5 text-center text-[9px] uppercase tracking-wider text-white/30">
          Waiting for winner
        </div>
      ) : (
        <div className="mt-auto h-8 border-t border-white/5" aria-hidden />
      )}
    </div>
  );
}

function TeamLine({
  team,
  winner,
  goals,
}: {
  team: Team | null;
  winner?: boolean;
  goals?: number | null;
}) {
  return (
    <div
      className={`flex h-10 items-center gap-2 px-2.5 ${
        winner ? "bg-amber-500/15" : ""
      }`}
    >
      <TeamBadge team={team} />
      <span
        className={`min-w-0 flex-1 truncate text-[13px] ${
          team ? "font-medium text-white" : "text-white/35"
        }`}
      >
        {team?.name ?? "TBD"}
      </span>
      <span
        className={`w-5 text-right text-sm font-bold tabular-nums ${
          winner ? "text-amber-300" : "text-white/70"
        }`}
      >
        {goals != null ? goals : ""}
      </span>
    </div>
  );
}

function TeamBadge({
  team,
  large,
}: {
  team: Team | null;
  large?: boolean;
}) {
  const size = large ? "h-9 w-9 text-sm" : "h-6 w-6 text-[10px]";
  if (!team) {
    return (
      <div
        className={`flex ${size} shrink-0 items-center justify-center rounded-md bg-white/8 font-bold text-white/30`}
      >
        ?
      </div>
    );
  }
  if (team.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={team.logoUrl}
        alt=""
        className={`${size} shrink-0 rounded-md object-cover`}
      />
    );
  }
  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center rounded-md bg-emerald-800 font-bold text-white`}
    >
      {team.name.slice(0, 1)}
    </div>
  );
}
