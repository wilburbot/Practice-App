import type { ActionResult, ActionType, ServingTeam } from "@prisma/client";

export interface StatEventLike {
  actionType: ActionType;
  result: ActionResult;
  passRating?: number | null;
  servingTeam?: ServingTeam | null;
  targetX?: number | null;
  targetY?: number | null;
}

export interface ActionMetrics {
  attempts: number;
  success: number;
  error: number;
  /** (success - error) / attempts, null when there are no attempts */
  efficiency: number | null;
}

export interface PlayerMetrics {
  ATTACK: ActionMetrics;
  SERVE: ActionMetrics;
  RECEPTION: ActionMetrics;
  DIG: ActionMetrics;
  BLOCK: ActionMetrics;
  SET: ActionMetrics;
  /** Kills + aces + block kills — the classic "points won" tally */
  points: number;
  /** Total errors across every action type */
  totalErrors: number;
  totalAttempts: number;
  /** Average 0-3 passer rating on RECEPTION events that were graded, null if none graded */
  avgPassRating: number | null;
  /**
   * Share of graded receptions rated 2 or 3 (Good/Perfect) — excludes rating-1 (Poor) passes,
   * unlike RECEPTION.success which counts every non-error reception. Null if none graded.
   */
  goodReceivePct: number | null;
}

const ACTION_TYPES: ActionType[] = ["ATTACK", "SERVE", "RECEPTION", "DIG", "BLOCK", "SET"];

function emptyAction(): ActionMetrics {
  return { attempts: 0, success: 0, error: 0, efficiency: null };
}

export function computeMetrics(events: StatEventLike[]): PlayerMetrics {
  const byType = Object.fromEntries(ACTION_TYPES.map((t) => [t, emptyAction()])) as Record<
    ActionType,
    ActionMetrics
  >;

  let passRatingSum = 0;
  let passRatingCount = 0;
  let goodReceiveCount = 0;

  for (const event of events) {
    const bucket = byType[event.actionType];
    bucket.attempts += 1;
    if (event.result === "SUCCESS") bucket.success += 1;
    if (event.result === "ERROR") bucket.error += 1;
    if (event.actionType === "RECEPTION" && event.passRating != null) {
      passRatingSum += event.passRating;
      passRatingCount += 1;
      if (event.passRating >= 2) goodReceiveCount += 1;
    }
  }

  for (const type of ACTION_TYPES) {
    const bucket = byType[type];
    bucket.efficiency = bucket.attempts > 0 ? (bucket.success - bucket.error) / bucket.attempts : null;
  }

  const points = byType.ATTACK.success + byType.SERVE.success + byType.BLOCK.success;
  const totalErrors = ACTION_TYPES.reduce((sum, t) => sum + byType[t].error, 0);
  const totalAttempts = ACTION_TYPES.reduce((sum, t) => sum + byType[t].attempts, 0);
  const avgPassRating = passRatingCount > 0 ? passRatingSum / passRatingCount : null;
  const goodReceivePct = passRatingCount > 0 ? goodReceiveCount / passRatingCount : null;

  return {
    ...(byType as PlayerMetrics),
    points,
    totalErrors,
    totalAttempts,
    avgPassRating,
    goodReceivePct,
  };
}

export interface ServingSplitStat {
  points: number;
  attempts: number;
  pct: number | null;
}

export interface ServingSplits {
  /** "Point-scoring %" — points won per rally while this team served */
  pointScoring: ServingSplitStat;
  /** "Side-out %" — points won per rally while this team was receiving */
  sideOut: ServingSplitStat;
}

/**
 * Requires the coach to flip a serving-team toggle live so each event is tagged with who
 * served that rally. One SERVE event = one rally started on our serve; one RECEPTION event =
 * one rally started on the opponent's serve — so those attempt counts double as rally counts.
 */
export function computeServingSplits(events: StatEventLike[]): ServingSplits {
  let ownServeAttempts = 0;
  let ownServePoints = 0;
  let receiveAttempts = 0;
  let receivePoints = 0;

  for (const event of events) {
    if (event.servingTeam === "OWN") {
      if (event.actionType === "SERVE") ownServeAttempts += 1;
      if (event.result === "SUCCESS" && (event.actionType === "SERVE" || event.actionType === "ATTACK" || event.actionType === "BLOCK")) {
        ownServePoints += 1;
      }
    } else if (event.servingTeam === "OPPONENT") {
      if (event.actionType === "RECEPTION") receiveAttempts += 1;
      if (event.result === "SUCCESS" && (event.actionType === "ATTACK" || event.actionType === "BLOCK")) {
        receivePoints += 1;
      }
    }
  }

  return {
    pointScoring: {
      points: ownServePoints,
      attempts: ownServeAttempts,
      pct: ownServeAttempts > 0 ? ownServePoints / ownServeAttempts : null,
    },
    sideOut: {
      points: receivePoints,
      attempts: receiveAttempts,
      pct: receiveAttempts > 0 ? receivePoints / receiveAttempts : null,
    },
  };
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

/** Pulls out every ATTACK/SERVE event with a tagged court location, for a spray-chart tendency view. */
export function computeCourtTendencies(events: StatEventLike[]): CourtTendencies {
  const toPoints = (actionType: ActionType) =>
    events
      .filter((e) => e.actionType === actionType && e.targetX != null && e.targetY != null)
      .map((e) => ({ x: e.targetX!, y: e.targetY!, result: e.result }));

  return { attack: toPoints("ATTACK"), serve: toPoints("SERVE") };
}

/** ISO week key like "2026-W35", used to bucket events for progress charts. */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
