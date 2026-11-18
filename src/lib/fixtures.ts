/**
 * Single round-robin via the classic circle method.
 * @see https://dev.to/viktor777/building-a-round-robin-tournament-generator-the-math-behind-nn-12-33jm
 *
 * N teams → N*(N-1)/2 matches. Every pair plays exactly once.
 * Display is flat (Match 1…M); rounds are only used for scheduling balance.
 */

export type LeagueFixture = {
  /** 0-based schedule round (for pairing balance; UI stays flat) */
  round: number;
  /** Index within that round */
  slotIndex: number;
  /** Global match number 1…M for display / stable order */
  matchNumber: number;
  homeTeamId: string;
  awayTeamId: string;
};

type TeamLike = { id: string };

/** Total matches in a single round-robin. */
export function totalRoundRobinMatches(teamCount: number) {
  if (teamCount < 2) return 0;
  return (teamCount * (teamCount - 1)) / 2;
}

/**
 * Build a complete single round-robin for the given teams (registered only).
 * Returns a flat list covering every unique pairing.
 */
export function buildRoundRobinFixtures(teams: TeamLike[]): LeagueFixture[] {
  if (teams.length < 2) return [];

  // Work on a mutable list of ids; odd N gets a BYE phantom
  const list: (string | null)[] = teams.map((t) => t.id);
  if (list.length % 2 === 1) list.push(null); // null = BYE

  const n = list.length;
  const rounds = n - 1;
  const half = n / 2;
  const fixtures: LeagueFixture[] = [];
  let matchNumber = 1;

  for (let round = 0; round < rounds; round++) {
    let slotIndex = 0;
    for (let i = 0; i < half; i++) {
      let home = list[i] ?? null;
      let away = list[n - 1 - i] ?? null;
      if (home == null || away == null) continue; // bye

      // Alternate home/away for fairness across rounds
      if (round % 2 === 1) {
        const tmp = home;
        home = away;
        away = tmp;
      } else if (i % 2 === 1) {
        const tmp = home;
        home = away;
        away = tmp;
      }

      fixtures.push({
        round,
        slotIndex: slotIndex++,
        matchNumber: matchNumber++,
        homeTeamId: home,
        awayTeamId: away,
      });
    }

    // Circle rotate: keep index 0 fixed, rotate the rest
    const fixed = list[0]!;
    const rest = list.slice(1);
    const last = rest.pop();
    if (last !== undefined) rest.unshift(last);
    list.splice(0, list.length, fixed, ...rest);
  }

  return fixtures;
}

/** Flatten for DB: one continuous slotIndex 0…M-1, round kept for reference. */
export function flattenFixturesForDb(fixtures: LeagueFixture[]) {
  return fixtures.map((f, i) => ({
    round: f.round,
    slotIndex: i, // globally unique within tournament + isBronze
    homeTeamId: f.homeTeamId,
    awayTeamId: f.awayTeamId,
    matchNumber: f.matchNumber,
  }));
}
