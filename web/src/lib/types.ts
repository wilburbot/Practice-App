export type SessionType = "PRACTICE" | "MATCH" | "SCRIMMAGE";
export type ActionType = "ATTACK" | "SERVE" | "RECEPTION" | "DIG" | "BLOCK" | "SET";
export type ActionResult = "SUCCESS" | "ERROR" | "ATTEMPT";

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Team {
  id: string;
  name: string;
  season: string | null;
  ownerId: string;
  createdAt: string;
  _count?: { players: number; sessions: number };
}

export interface Player {
  id: string;
  teamId: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  position: string | null;
  active: boolean;
  createdAt: string;
}

export interface Session {
  id: string;
  teamId: string;
  type: SessionType;
  date: string;
  opponent: string | null;
  notes: string | null;
  videoUrl: string | null;
  videoDurationSec: number | null;
  createdAt: string;
  _count?: { statEvents: number };
}

export interface StatEvent {
  id: string;
  sessionId: string;
  playerId: string;
  actionType: ActionType;
  result: ActionResult;
  setNumber: number | null;
  videoTimestampSec: number | null;
  createdAt: string;
  player?: Player;
}

export interface ActionMetrics {
  attempts: number;
  success: number;
  error: number;
  efficiency: number | null;
}

export interface PlayerMetrics {
  ATTACK: ActionMetrics;
  SERVE: ActionMetrics;
  RECEPTION: ActionMetrics;
  DIG: ActionMetrics;
  BLOCK: ActionMetrics;
  SET: ActionMetrics;
  points: number;
  totalErrors: number;
  totalAttempts: number;
}

export interface SessionReport {
  session: Session;
  team: PlayerMetrics;
  players: { player: Player; metrics: PlayerMetrics }[];
}

export interface PlayerProgress {
  player: Player;
  overall: PlayerMetrics;
  weeks: { week: string; metrics: PlayerMetrics }[];
}

export interface TeamWeekly {
  team: Team;
  weeks: {
    week: string;
    team: PlayerMetrics;
    topPerformers: { player: Player; metrics: PlayerMetrics }[];
  }[];
}
