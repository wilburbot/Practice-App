import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { findOwnedPlayer, findOwnedSession, findOwnedTeam } from "../lib/ownership.js";
import { computeMetrics, isoWeekKey } from "../lib/metrics.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

// Full box score for one session: per-player metrics + team totals.
reportsRouter.get("/session/:sessionId", async (req: AuthedRequest, res) => {
  const session = await findOwnedSession(req.params.sessionId, req.userId!);
  if (!session) return res.status(404).json({ error: "Session not found" });

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

  res.json({
    session,
    team: computeMetrics(events),
    players,
  });
});

// Time series of a single player's metrics, bucketed by week, for progress charts.
reportsRouter.get("/player/:playerId/progress", async (req: AuthedRequest, res) => {
  const player = await findOwnedPlayer(req.params.playerId, req.userId!);
  if (!player) return res.status(404).json({ error: "Player not found" });

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

  res.json({ player, overall: computeMetrics(events), weeks });
});

// Team-wide weekly rollup: totals per week plus that week's top performers.
reportsRouter.get("/team/:teamId/weekly", async (req: AuthedRequest, res) => {
  const team = await findOwnedTeam(req.params.teamId, req.userId!);
  if (!team) return res.status(404).json({ error: "Team not found" });

  const events = await prisma.statEvent.findMany({
    where: { session: { teamId: team.id } },
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
        .map(([playerId, playerEvents]) => ({
          player: playerEvents[0]!.player,
          metrics: computeMetrics(playerEvents),
        }))
        .sort((a, b) => b.metrics.points - a.metrics.points)
        .slice(0, 3);

      return { week, team: computeMetrics(weekEvents), topPerformers };
    });

  res.json({ team, weeks });
});
