export const Role = {
  LEAGUE_ADMIN: "LEAGUE_ADMIN",
  PENDING_ADMIN: "PENDING_ADMIN",
  TEAM_MANAGER: "TEAM_MANAGER",
  VISITOR: "VISITOR",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const PlayerRole = {
  STARTER: "STARTER",
  SUB: "SUB",
} as const;

export type PlayerRole = (typeof PlayerRole)[keyof typeof PlayerRole];

export const MatchStatus = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
} as const;

export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus];

export const SIGNUP_INTENT_COOKIE = "football_signup_intent";
export type SignupIntent = "visitor" | "admin";
