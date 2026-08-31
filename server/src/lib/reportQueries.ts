import type { Player, Session } from "@prisma/client";
import { prisma } from "../db.js";
import { computeCourtTendencies, computeMetrics, computeServingSplits, isoWeekKey } from "./metrics.js";

/** Full box score for one session: per-player metrics + team totals. Caller must have already verified access to `session`. */
export async function buildSessionReport(session: Session) {
  const events = await prisma.statEvent.findMany({
    where: { sessionId: session.id },
    include: { player: true },
  });

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
    include: { session: true },
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

  return {
    player,
    overall: computeMetrics(events),
    weeks,
    tendencies: computeCourtTendencies(events),
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
