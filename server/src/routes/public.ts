import { Router } from "express";
import { prisma } from "../db.js";
import { findPlayerByShareToken, findSessionByShareToken, findTeamByShareToken } from "../lib/publicAccess.js";
import { buildPlayerProgress, buildSessionReport, buildTeamWeekly } from "../lib/reportQueries.js";

// Unauthenticated, read-only routes for the share link a coach hands out to players/parents/assistant
// coaches. Nothing here can be used to modify data — every handler resolves access purely from the
// shareToken in the URL, never a login, so treat this token like a password: anyone with the link can view.
export const publicRouter = Router();

publicRouter.get("/:shareToken", async (req, res) => {
  const team = await findTeamByShareToken(req.params.shareToken);
  if (!team) return res.status(404).json({ error: "Invalid or expired share link" });
  res.json({ id: team.id, name: team.name, season: team.season });
});

publicRouter.get("/:shareToken/players", async (req, res) => {
  const team = await findTeamByShareToken(req.params.shareToken);
  if (!team) return res.status(404).json({ error: "Invalid or expired share link" });

  const players = await prisma.player.findMany({
    where: { teamId: team.id, active: true },
    orderBy: [{ jerseyNumber: { sort: "asc", nulls: "last" } }, { lastName: "asc" }],
  });
  res.json(players);
});

publicRouter.get("/:shareToken/sessions", async (req, res) => {
  const team = await findTeamByShareToken(req.params.shareToken);
  if (!team) return res.status(404).json({ error: "Invalid or expired share link" });

  const sessions = await prisma.session.findMany({
    where: { teamId: team.id },
    orderBy: { date: "desc" },
    include: { _count: { select: { statEvents: true } } },
  });
  res.json(sessions);
});

publicRouter.get("/:shareToken/sessions/:sessionId", async (req, res) => {
  const session = await findSessionByShareToken(req.params.shareToken, req.params.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json(await buildSessionReport(session));
});

publicRouter.get("/:shareToken/sessions/:sessionId/stats", async (req, res) => {
  const session = await findSessionByShareToken(req.params.shareToken, req.params.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const events = await prisma.statEvent.findMany({
    where: { sessionId: session.id },
    include: { player: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(events);
});

publicRouter.get("/:shareToken/players/:playerId/progress", async (req, res) => {
  const player = await findPlayerByShareToken(req.params.shareToken, req.params.playerId);
  if (!player) return res.status(404).json({ error: "Player not found" });
  res.json(await buildPlayerProgress(player));
});

publicRouter.get("/:shareToken/weekly", async (req, res) => {
  const team = await findTeamByShareToken(req.params.shareToken);
  if (!team) return res.status(404).json({ error: "Invalid or expired share link" });

  const playerId = req.query.playerId as string | undefined;
  const position = req.query.position as string | undefined;

  const { weeks } = await buildTeamWeekly(team.id, { playerId, position });
  res.json({ team: { id: team.id, name: team.name, season: team.season }, weeks });
});
