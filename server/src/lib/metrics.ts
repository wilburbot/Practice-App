import type { ActionResult, ActionType } from "@prisma/client";

export interface StatEventLike {
  actionType: ActionType;
  result: ActionResult;
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

  for (const event of events) {
    const bucket = byType[event.actionType];
    bucket.attempts += 1;
    if (event.result === "SUCCESS") bucket.success += 1;
    if (event.result === "ERROR") bucket.error += 1;
  }

  for (const type of ACTION_TYPES) {
    const bucket = byType[type];
    bucket.efficiency = bucket.attempts > 0 ? (bucket.success - bucket.error) / bucket.attempts : null;
  }

  const points = byType.ATTACK.success + byType.SERVE.success + byType.BLOCK.success;
  const totalErrors = ACTION_TYPES.reduce((sum, t) => sum + byType[t].error, 0);
  const totalAttempts = ACTION_TYPES.reduce((sum, t) => sum + byType[t].attempts, 0);

  return {
    ...(byType as PlayerMetrics),
    points,
    totalErrors,
    totalAttempts,
  };
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
