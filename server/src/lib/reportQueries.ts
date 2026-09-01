import type { ActionType, Player, Session } from "@prisma/client";
import { prisma } from "../db.js";
import { computeCourtTendencies, computeMetrics, computeServingSplits, isoWeekKey } from "./metrics.js";

const ACTION_TYPES: ActionType[] = ["ATTACK", "SERVE", "RECEPTION", "DIG", "BLOCK", "SET"];

/** Full box score for one session: per-player metrics + team totals. Caller must have already verified access to `session`. */
export async function buildSessionReport(session: Session) {
  const [events, videos] = await Promise.all([
    prisma.statEvent.findMany({
      where: { sessionId: session.id },
      include: { player: true },
    }),
    prisma.sessionVideo.findMany({
      where: { sessionId: session.id, url: { not: null } },
      orderBy: { startedAt: "asc" },
    }),
  ]);

  const byPlayer = new Map<string, { player: (typeof events)[number]["player"]; events: typeof events }>();
  for (const event of events) {
    const bucket = byPlayer.get(event.playerId) ?? { player: event.player, events: [] };
    bucket.events.push(event);
    byPlayer.set(event.playerId, bucket);
  }

  const players = [...byPlayer.values()]
    .map(({ player, events: playerEvents }) => ({
      player,
      metrics: computeMetrics(playerEvents),
    }))
    .sort((a, b) => b.metrics.points - a.metrics.points);

  const bySetMap = new Map<number, typeof events>();
  for (const event of events) {
    const setNumber = event.setNumber ?? 1;
    const bucket = bySetMap.get(setNumber) ?? [];
    bucket.push(event);
    bySetMap.set(setNumber, bucket);
  }
  const bySet = [...bySetMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([setNumber, setEvents]) => ({ setNumber, team: computeMetrics(setEvents) }));

  return {
    session,
    videos,
    team: computeMetrics(events),
    servingSplits: computeServingSplits(events),
    bySet,
    players,
  };
}

/** Time series of a single player's metrics, bucketed by week. Caller must have already verified access to `player`. */
export async function buildPlayerProgress(player: Player) {
  const events = await prisma.statEvent.findMany({
    where: { playerId: player.id },
    include: { session: true, videoClip: true },
    orderBy: { createdAt: "asc" },
  });

  const byWeek = new Map<string, typeof events>();
  for (const event of events) {
    const key = isoWeekKey(event.session.date);
    const bucket = byWeek.get(key) ?? [];
    bucket.push(event);
    byWeek.set(key, bucket);
  }

  const weeks = [...byWeek.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([week, weekEvents]) => ({ week, metrics: computeMetrics(weekEvents) }));

  const bySession = new Map<string, typeof events>();
  for (const event of events) {
    const bucket = bySession.get(event.sessionId) ?? [];
    bucket.push(event);
    bySession.set(event.sessionId, bucket);
  }
  const sessions = [...bySession.values()]
    .map((sessionEvents) => ({
      sessionId: sessionEvents[0]!.sessionId,
      date: sessionEvents[0]!.session.date,
      type: sessionEvents[0]!.session.type,
      opponent: sessionEvents[0]!.session.opponent,
      metrics: computeMetrics(sessionEvents),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // Every tagged moment that has video, in chronological order — powers the auto-advancing
  // highlight reel. createdAt order (the query's sort) is chronological across sessions already.
  // Each clip resolves to the exact recording it was tagged during, not just "the session's video" —
  // a session can have several clips if the coach started/stopped recording more than once.
  const clips = events
    .filter((e) => e.videoClip?.url && e.videoTimestampSec != null)
    .map((e) => ({
      sessionId: e.sessionId,
      videoUrl: e.videoClip!.url!,
      timestampSec: e.videoTimestampSec!,
      actionType: e.actionType,
      result: e.result,
      sessionDate: e.session.date,
      sessionType: e.session.type,
      opponent: e.session.opponent,
    }));

  return {
    player,
    overall: computeMetrics(events),
    weeks,
    sessions,
    tendencies: computeCourtTendencies(events),
    clips,
  };
}

/** Team-wide weekly rollup: totals per week plus that week's top performers, optionally scoped to one player/position. */
export async function buildTeamWeekly(
  teamId: string,
  filters: { playerId?: string; position?: string } = {},
) {
  const events = await prisma.statEvent.findMany({
    where: {
      session: { teamId },
      ...(filters.playerId ? { playerId: filters.playerId } : {}),
      ...(filters.position ? { player: { position: filters.position } } : {}),
    },
    include: { session: true, player: true },
    orderBy: { createdAt: "asc" },
  });

  const byWeek = new Map<string, typeof events>();
  for (const event of events) {
    const key = isoWeekKey(event.session.date);
    const bucket = byWeek.get(key) ?? [];
    bucket.push(event);
    byWeek.set(key, bucket);
  }

  const weeks = [...byWeek.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([week, weekEvents]) => {
      const byPlayer = new Map<string, typeof weekEvents>();
      for (const event of weekEvents) {
        const bucket = byPlayer.get(event.playerId) ?? [];
        bucket.push(event);
        byPlayer.set(event.playerId, bucket);
      }
      const topPerformers = [...byPlayer.entries()]
        .map(([, playerEvents]) => ({
          player: playerEvents[0]!.player,
          metrics: computeMetrics(playerEvents),
        }))
        .sort((a, b) => b.metrics.points - a.metrics.points)
        .slice(0, 3);

      return {
        week,
        team: computeMetrics(weekEvents),
        servingSplits: computeServingSplits(weekEvents),
        topPerformers,
      };
    });

  return { weeks };
}

/**
 * Per-skill breakdown for a team's whole season: how often each result happened (for a pie chart)
 * and which players account for the most success on that skill (for a bar chart).
 */
export async function buildSkillBreakdown(
  teamId: string,
  filters: { playerId?: string; position?: string } = {},
) {
  const events = await prisma.statEvent.findMany({
    where: {
      session: { teamId },
      ...(filters.playerId ? { playerId: filters.playerId } : {}),
      ...(filters.position ? { player: { position: filters.position } } : {}),
    },
    include: { player: true },
  });

  const skills = ACTION_TYPES.map((actionType) => {
    const skillEvents = events.filter((e) => e.actionType === actionType);
    const resultBreakdown = {
      SUCCESS: skillEvents.filter((e) => e.result === "SUCCESS").length,
      ERROR: skillEvents.filter((e) => e.result === "ERROR").length,
      ATTEMPT: skillEvents.filter((e) => e.result === "ATTEMPT").length,
    };

    const byPlayerMap = new Map<
      string,
      {
        player: (typeof skillEvents)[number]["player"];
        success: number;
        error: number;
        attempts: number;
        passRatingSum: number;
        passRatingCount: number;
      }
    >();
    for (const event of skillEvents) {
      const bucket =
        byPlayerMap.get(event.playerId) ??
        { player: event.player, success: 0, error: 0, attempts: 0, passRatingSum: 0, passRatingCount: 0 };
      bucket.attempts += 1;
      if (event.result === "SUCCESS") bucket.success += 1;
      if (event.result === "ERROR") bucket.error += 1;
      if (event.passRating != null) {
        bucket.passRatingSum += event.passRating;
        bucket.passRatingCount += 1;
      }
      byPlayerMap.set(event.playerId, bucket);
    }
    const byPlayer = [...byPlayerMap.values()]
      .map(({ passRatingSum, passRatingCount, ...rest }) => ({
        ...rest,
        avgPassRating: passRatingCount > 0 ? passRatingSum / passRatingCount : null,
      }))
      .sort((a, b) => b.success - a.success);

    return { actionType, attempts: skillEvents.length, resultBreakdown, byPlayer };
  });

  return { skills };
}
