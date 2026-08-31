export type SessionType = "PRACTICE" | "MATCH" | "SCRIMMAGE";
export type ActionType = "ATTACK" | "SERVE" | "RECEPTION" | "DIG" | "BLOCK" | "SET";
export type ActionResult = "SUCCESS" | "ERROR" | "ATTEMPT";
export type ServingTeam = "OWN" | "OPPONENT";

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
  shareToken?: string | null;
  inviteToken?: string | null;
  createdAt: string;
  _count?: { players: number; sessions: number };
}

export interface TeamMemberUser {
  id: string;
  name: string;
  email: string;
}

export interface TeamMember {
  id: string;
  createdAt: string;
  user: TeamMemberUser;
}

export interface TeamMembers {
  owner: TeamMemberUser | null;
  members: TeamMember[];
}

export interface PublicTeam {
  id: string;
  name: string;
  season: string | null;
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
  videoStartedAt: string | null;
  recapText: string | null;
  recapGeneratedAt: string | null;
  createdAt: string;
  _count?: { statEvents: number };
}

export interface StatEvent {
  id: string;
  sessionId: string;
  playerId: string;
  actionType: ActionType;
  result: ActionResult;
  passRating: number | null;
  servingTeam: ServingTeam | null;
  setNumber: number | null;
  videoTimestampSec: number | null;
  targetX: number | null;
  targetY: number | null;
  createdAt: string;
  player?: Player;
}

export interface CourtPoint {
  x: number;
  y: number;
  result: ActionResult;
}

export interface CourtTendencies {
  attack: CourtPoint[];
  serve: CourtPoint[];
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
  avgPassRating: number | null;
}

export interface ServingSplitStat {
  points: number;
  attempts: number;
  pct: number | null;
}

export interface ServingSplits {
  pointScoring: ServingSplitStat;
  sideOut: ServingSplitStat;
}

export interface SessionReport {
  session: Session;
  team: PlayerMetrics;
  servingSplits: ServingSplits;
  bySet: { setNumber: number; team: PlayerMetrics }[];
  players: { player: Player; metrics: PlayerMetrics }[];
}

export interface HighlightClip {
  sessionId: string;
  videoUrl: string;
  timestampSec: number;
  actionType: ActionType;
  result: ActionResult;
  sessionDate: string;
  sessionType: SessionType;
  opponent: string | null;
}

export interface PlayerProgress {
  player: Player;
  overall: PlayerMetrics;
  weeks: { week: string; metrics: PlayerMetrics }[];
  tendencies: CourtTendencies;
  clips: HighlightClip[];
}

export interface TeamWeekly {
  team: Team;
  weeks: {
    week: string;
    team: PlayerMetrics;
    servingSplits: ServingSplits;
    topPerformers: { player: Player; metrics: PlayerMetrics }[];
  }[];
}

export interface SkillResultBreakdown {
  SUCCESS: number;
  ERROR: number;
  ATTEMPT: number;
}

export interface SkillPlayerStat {
  player: Player;
  success: number;
  error: number;
  attempts: number;
  avgPassRating: number | null;
}

export interface SkillBreakdownEntry {
  actionType: ActionType;
  attempts: number;
  resultBreakdown: SkillResultBreakdown;
  byPlayer: SkillPlayerStat[];
}

export interface TeamSkillBreakdown {
  team: Team | PublicTeam;
  skills: SkillBreakdownEntry[];
}
