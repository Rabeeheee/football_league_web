"use client";

import { useEffect, useMemo, useState } from "react";
import type { Match, Team, Tournament } from "@prisma/client";
import { totalRoundRobinMatches } from "@/lib/fixtures";
import {
  MatchPhase,
  knockoutFieldSize,
  knockoutRoundCount,
} from "@/lib/knockout";
import { KnockoutBracket } from "@/components/knockout-bracket";

type MatchWithTeams = Match & {
  homeTeam: Team | null;
  awayTeam: Team | null;
  winnerTeam: Team | null;
};

type Props = {
  initialMatches: MatchWithTeams[];
  tournament: Tournament;
  teamsRegistered: number;
  isAdmin: boolean;
};

export function FixturesView({
  initialMatches,
  tournament,
  teamsRegistered,
  isAdmin,
}: Props) {
  const [matches, setMatches] = useState(initialMatches);
  const [busy, setBusy] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phaseTab, setPhaseTab] = useState<"LEAGUE" | "KNOCKOUT">("LEAGUE");
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");

  useEffect(() => {
    setMatches(initialMatches);
  }, [initialMatches]);

  const leagueMatches = useMemo(
    () =>
      matches
        .filter((m) => (m.phase || MatchPhase.LEAGUE) === MatchPhase.LEAGUE)
        .sort((a, b) => a.slotIndex - b.slotIndex),
    [matches],
  );

  const knockoutMatches = useMemo(
    () =>
      matches
        .filter((m) => m.phase === MatchPhase.KNOCKOUT)
        .sort((a, b) => {
          if (a.isBronze !== b.isBronze) return a.isBronze ? 1 : -1;
          if (a.round !== b.round) return a.round - b.round;
          return a.slotIndex - b.slotIndex;
        }),
    [matches],
  );

  const activeList =
    phaseTab === "LEAGUE" ? leagueMatches : knockoutMatches;

  const visible = useMemo(() => {
    if (filter === "open") {
      return activeList.filter((m) => m.status !== "COMPLETED");
    }
    if (filter === "done") {
      return activeList.filter((m) => m.status === "COMPLETED");
    }
    return activeList;
  }, [activeList, filter]);

  const leagueDone =
    leagueMatches.length > 0 &&
    leagueMatches.every((m) => m.status === "COMPLETED");
  const leagueCompleted = leagueMatches.filter(
    (m) => m.status === "COMPLETED",
  ).length;
  const expectedLeague = totalRoundRobinMatches(teamsRegistered);
  const koField = knockoutFieldSize(teamsRegistered);
  const koRounds = knockoutRoundCount(koField);

  const tableLeader = useMemo(() => {
    const pts = new Map<string, { team: Team; points: number; gd: number }>();
    for (const m of leagueMatches) {
      if (m.status !== "COMPLETED" || !m.homeTeam || !m.awayTeam) continue;
      const hg = m.homeGoals ?? 0;
      const ag = m.awayGoals ?? 0;
      for (const team of [m.homeTeam, m.awayTeam]) {
        if (!pts.has(team.id)) pts.set(team.id, { team, points: 0, gd: 0 });
      }
      const home = pts.get(m.homeTeam.id)!;
      const away = pts.get(m.awayTeam.id)!;
      home.gd += hg - ag;
      away.gd += ag - hg;
      if (hg > ag) home.points += 3;
      else if (ag > hg) away.points += 3;
      else {
        home.points += 1;
        away.points += 1;
      }
    }
    return (
      [...pts.values()].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.gd - a.gd;
      })[0]?.team ?? null
    );
  }, [leagueMatches]);

  const champion = useMemo(() => {
    const final = knockoutMatches.find(
      (m) =>
        !m.isBronze &&
        m.status === "COMPLETED" &&
        m.round ===
          Math.max(
            0,
            ...knockoutMatches.filter((x) => !x.isBronze).map((x) => x.round),
          ),
    );
    return final?.winnerTeam ?? null;
  }, [knockoutMatches]);

  async function postAction(action: "league" | "knockout") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMatches(data.matches);
      setPhaseTab(action === "knockout" ? "KNOCKOUT" : "LEAGUE");
      setFilter("all");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitResult(
    matchId: string,
    homeGoals: number,
    awayGoals: number,
  ) {
    setError(null);
    setSavingId(matchId);

    // Optimistic update so UI + navigation stay responsive
    const previous = matches;
    setMatches((prev) =>
      prev.map((m) => {
        if (m.id !== matchId) return m;
        const winnerTeamId =
          homeGoals === awayGoals
            ? null
            : homeGoals > awayGoals
              ? m.homeTeamId
              : m.awayTeamId;
        const winnerTeam =
          winnerTeamId === m.homeTeamId
            ? m.homeTeam
            : winnerTeamId === m.awayTeamId
              ? m.awayTeam
              : null;
        return {
          ...m,
          homeGoals,
          awayGoals,
          winnerTeamId,
          winnerTeam,
          status: "COMPLETED",
        };
      }),
    );

    try {
      const res = await fetch("/api/matches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, homeGoals, awayGoals }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMatches(data.matches);
    } catch (e) {
      setMatches(previous);
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSavingId(null);
    }
  }

  if (matches.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/40 p-8 text-center sm:p-10">
        <p className="font-display text-2xl text-white/80">No fixtures yet</p>
        <p className="mt-2 text-sm text-white/50">
          Phase 1 — league: every team plays every other (
          {expectedLeague} matches for {teamsRegistered} teams).
          <br />
          Phase 2 — knockout: top {koField || 2} from the table play
          semis/finals.
        </p>
        {isAdmin && teamsRegistered >= 2 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => postAction("league")}
            className="mt-6 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-60"
          >
            {busy ? "Generating…" : `Start league (${expectedLeague} matches)`}
          </button>
        )}
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/30 px-4 py-3 text-sm text-white/70">
        <p className="font-semibold text-emerald-200">How the competition works</p>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs sm:text-sm">
          <li>
            <span className="text-white">League phase</span> — all fixtures
            ({leagueMatches.length || expectedLeague}). Draws allowed. Builds
            the points table.
          </li>
          <li>
            <span className="text-white">After league is finished</span> —
            start knockout. Top {koField} teams play{" "}
            {koRounds >= 2 ? "semi-finals → final" : "the final"}
            {koRounds >= 2 ? " (+ 3rd place)" : ""}. No draws.
          </li>
        </ol>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-stretch gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
              League phase
            </p>
            <p className="mt-1 font-display text-xl text-white sm:text-2xl">
              {leagueCompleted} / {leagueMatches.length || "—"} played
            </p>
            <p className="text-xs text-white/45">
              {leagueDone ? "Complete — ready for knockout" : "In progress"}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/20 to-amber-900/10 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-200/80">
              {champion ? "Champion" : "Table leaders"}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <TeamBadge team={champion ?? tableLeader} large />
              <span className="font-display truncate text-lg text-white sm:text-xl">
                {(champion ?? tableLeader)?.name ?? "TBD"}
              </span>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="flex flex-col gap-2 sm:items-end">
            <button
              type="button"
              disabled={busy || teamsRegistered < 2}
              onClick={() => postAction("league")}
              className="rounded-lg border border-white/20 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-60"
            >
              Regenerate league
            </button>
            <button
              type="button"
              disabled={busy || !leagueDone}
              onClick={() => postAction("knockout")}
              className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-40"
            >
              {knockoutMatches.length
                ? "Regenerate knockout"
                : `Start knockout (top ${koField})`}
            </button>
            {!leagueDone && (
              <p className="max-w-xs text-[11px] text-white/40">
                Play every league match first, then start knockout for the next
                rounds.
              </p>
            )}
            {error && <p className="text-sm text-red-300">{error}</p>}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setPhaseTab("LEAGUE");
            setFilter("all");
          }}
          className={`rounded-full px-4 py-2 text-xs font-semibold ${
            phaseTab === "LEAGUE"
              ? "bg-emerald-500 text-white"
              : "bg-white/10 text-white/60"
          }`}
        >
          League ({leagueMatches.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setPhaseTab("KNOCKOUT");
            setFilter("all");
          }}
          className={`rounded-full px-4 py-2 text-xs font-semibold ${
            phaseTab === "KNOCKOUT"
              ? "bg-amber-500 text-black"
              : "bg-white/10 text-white/60"
          }`}
        >
          Knockout ({knockoutMatches.length})
        </button>
      </div>

      {phaseTab === "KNOCKOUT" && knockoutMatches.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/15 bg-black/30 p-8 text-center text-sm text-white/50">
          {leagueDone
            ? isAdmin
              ? "League finished. Click “Start knockout” for the bracket."
              : "League finished. Waiting for admin to start knockout."
            : `Finish all ${leagueMatches.length} league matches first. Knockout is the next stage.`}
        </div>
      )}

      {phaseTab === "KNOCKOUT" && knockoutMatches.length > 0 && (
        <KnockoutBracket
          matches={knockoutMatches}
          isAdmin={isAdmin}
          locked={busy}
          savingId={savingId}
          onSubmit={submitResult}
        />
      )}

      {phaseTab === "LEAGUE" && activeList.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["all", `All (${activeList.length})`],
                [
                  "open",
                  `To play (${activeList.filter((m) => m.status !== "COMPLETED").length})`,
                ],
                [
                  "done",
                  `Played (${activeList.filter((m) => m.status === "COMPLETED").length})`,
                ],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold ${
                  filter === id
                    ? "bg-white/20 text-white"
                    : "bg-white/5 text-white/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <ul className="space-y-3">
            {visible.map((m) => (
              <li key={m.id}>
                <MatchCard
                  match={m}
                  label={`Match ${m.slotIndex + 1}`}
                  isAdmin={isAdmin}
                  locked={busy}
                  saving={savingId === m.id}
                  allowDraw
                  onSubmit={submitResult}
                />
              </li>
            ))}
          </ul>
          {visible.length === 0 && (
            <p className="py-8 text-center text-sm text-white/45">
              No matches in this filter.
            </p>
          )}
        </>
      )}

      {teamsRegistered < tournament.teamSlots && phaseTab === "LEAGUE" && (
        <p className="text-center text-[11px] text-amber-200/60">
          {teamsRegistered}/{tournament.teamSlots} teams registered — add more
          in Admin, then regenerate league for a bigger fixture list.
        </p>
      )}
    </div>
  );
}

function MatchCard({
  match,
  label,
  isAdmin,
  locked,
  saving,
  allowDraw,
  onSubmit,
}: {
  match: MatchWithTeams;
  label: string;
  isAdmin: boolean;
  locked: boolean;
  saving: boolean;
  allowDraw: boolean;
  onSubmit: (matchId: string, homeGoals: number, awayGoals: number) => void;
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

  const bothSet = !!match.homeTeamId && !!match.awayTeamId;
  const ready = isAdmin && !locked && bothSet;
  const scoresReady = homeGoals !== "" && awayGoals !== "";
  const isDrawScores =
    scoresReady && Number(homeGoals) === Number(awayGoals);
  const canSave =
    ready && !saving && scoresReady && (allowDraw || !isDrawScores);
  const completed = match.status === "COMPLETED";
  const isDraw =
    completed &&
    match.homeGoals != null &&
    match.awayGoals != null &&
    match.homeGoals === match.awayGoals;

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-[#0d1511] shadow-lg ${
        completed ? "border-emerald-500/35" : "border-white/12"
      }`}
    >
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
          {label}
        </span>
        {completed ? (
          <span className="text-[10px] font-semibold text-emerald-300/80">
            {isDraw ? "Draw" : "Final"}
          </span>
        ) : !bothSet ? (
          <span className="text-[10px] text-white/30">Waiting</span>
        ) : (
          <span className="text-[10px] text-white/30">Pending</span>
        )}
      </div>

      <div className="sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
        <TeamLine
          team={match.homeTeam}
          winner={!isDraw && match.winnerTeamId === match.homeTeamId}
          goals={completed ? match.homeGoals : null}
          align="left"
        />
        <div className="hidden items-center justify-center px-2 text-xs font-semibold text-white/25 sm:flex">
          vs
        </div>
        <div className="border-t border-white/10 sm:hidden" />
        <TeamLine
          team={match.awayTeam}
          winner={!isDraw && match.winnerTeamId === match.awayTeamId}
          goals={completed ? match.awayGoals : null}
          align="right"
        />
      </div>

      {ready && (
        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-[#08110c] px-3 py-2">
          <input
            type="number"
            min={0}
            max={99}
            inputMode="numeric"
            aria-label="Home goals"
            placeholder="0"
            value={homeGoals}
            onChange={(e) => setHomeGoals(e.target.value)}
            className="w-12 rounded border border-white/20 bg-black/50 px-1 py-1 text-center text-sm text-white"
          />
          <span className="text-xs text-white/35">–</span>
          <input
            type="number"
            min={0}
            max={99}
            inputMode="numeric"
            aria-label="Away goals"
            placeholder="0"
            value={awayGoals}
            onChange={(e) => setAwayGoals(e.target.value)}
            className="w-12 rounded border border-white/20 bg-black/50 px-1 py-1 text-center text-sm text-white"
          />
          {!allowDraw && (
            <span className="text-[10px] text-amber-200/60">no draws</span>
          )}
          <button
            type="button"
            disabled={!canSave}
            className="ml-auto rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
            onClick={() =>
              onSubmit(match.id, Number(homeGoals), Number(awayGoals))
            }
          >
            {saving ? "Saving…" : completed ? "Update score" : "Save score"}
          </button>
        </div>
      )}
    </div>
  );
}

function TeamLine({
  team,
  winner,
  goals,
  align,
}: {
  team: Team | null;
  winner?: boolean;
  goals?: number | null;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex min-h-12 items-center gap-2 px-3 py-2 ${
        winner ? "bg-emerald-500/15" : ""
      } ${align === "right" ? "sm:flex-row-reverse sm:text-right" : ""}`}
    >
      <TeamBadge team={team} />
      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          team ? "font-medium text-white" : "text-white/35"
        }`}
      >
        {team?.name ?? "TBD"}
      </span>
      <span
        className={`w-6 text-sm font-bold tabular-nums ${
          winner ? "text-emerald-300" : "text-white/70"
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
  const size = large ? "h-9 w-9 text-sm" : "h-7 w-7 text-[10px]";
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
