import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { findOwnedPlayer, findOwnedSession, findOwnedTeam } from "../lib/ownership.js";
import { buildPlayerProgress, buildSessionReport, buildSkillBreakdown, buildTeamWeekly } from "../lib/reportQueries.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

// Full box score for one session: per-player metrics + team totals.
reportsRouter.get("/session/:sessionId", async (req: AuthedRequest, res) => {
  const session = await findOwnedSession(req.params.sessionId, req.userId!);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json(await buildSessionReport(session));
});

// Time series of a single player's metrics, bucketed by week, for progress charts.
reportsRouter.get("/player/:playerId/progress", async (req: AuthedRequest, res) => {
  const player = await findOwnedPlayer(req.params.playerId, req.userId!);
  if (!player) return res.status(404).json({ error: "Player not found" });
  res.json(await buildPlayerProgress(player));
});

// Team-wide weekly rollup: totals per week plus that week's top performers.
// Optionally scoped to one player and/or one position via query params.
reportsRouter.get("/team/:teamId/weekly", async (req: AuthedRequest, res) => {
  const team = await findOwnedTeam(req.params.teamId, req.userId!);
  if (!team) return res.status(404).json({ error: "Team not found" });

  const playerId = req.query.playerId as string | undefined;
  const position = req.query.position as string | undefined;

  const { weeks } = await buildTeamWeekly(team.id, { playerId, position });
  res.json({ team, weeks });
});

// Per-skill breakdown (Attack/Serve/Reception/Dig/Block/Set) for the whole season.
// Optionally scoped to one player and/or one position via query params.
reportsRouter.get("/team/:teamId/skills", async (req: AuthedRequest, res) => {
  const team = await findOwnedTeam(req.params.teamId, req.userId!);
  if (!team) return res.status(404).json({ error: "Team not found" });

  const playerId = req.query.playerId as string | undefined;
  const position = req.query.position as string | undefined;

  const breakdown = await buildSkillBreakdown(team.id, { playerId, position });
  res.json({ team, ...breakdown });
});
