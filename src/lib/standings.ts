import type { Match, Team } from "@prisma/client";

export type StandingRow = {
  team: Team;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
};

export function computeStandings(
  teams: Team[],
  matches: Match[],
): StandingRow[] {
  const map = new Map<string, StandingRow>();
  for (const team of teams) {
    map.set(team.id, {
      team,
      played: 0,
      won: 0,
      lost: 0,
      drawn: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0,
    });
  }

  for (const match of matches) {
    if (match.status !== "COMPLETED") continue;
    // Points table = league phase only (knockout is separate)
    if ("phase" in match && match.phase && match.phase !== "LEAGUE") continue;
    const homeId = match.homeTeamId;
    const awayId = match.awayTeamId;
    if (!homeId || !awayId) continue;

    const home = map.get(homeId);
    const away = map.get(awayId);
    if (!home || !away) continue;

    const hg = match.homeGoals ?? 0;
    const ag = match.awayGoals ?? 0;

    home.played += 1;
    away.played += 1;
    home.goalsFor += hg;
    home.goalsAgainst += ag;
    away.goalsFor += ag;
    away.goalsAgainst += hg;

    if (match.winnerTeamId === homeId) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (match.winnerTeamId === awayId) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else if (hg === ag) {
      // Draw (league matches)
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    } else {
      // Fallback from scores if winner missing
      if (hg > ag) {
        home.won += 1;
        home.points += 3;
        away.lost += 1;
      } else if (ag > hg) {
        away.won += 1;
        away.points += 3;
        home.lost += 1;
      }
    }
  }

  for (const row of map.values()) {
    row.goalDiff = row.goalsFor - row.goalsAgainst;
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    if (b.won !== a.won) return b.won - a.won;
    return a.team.name.localeCompare(b.team.name);
  });
}
