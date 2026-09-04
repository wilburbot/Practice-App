import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { findOwnedPlayer, findOwnedSession, findOwnedTeam } from "../lib/ownership.js";
import { buildPlayerProgress, buildSessionReport, buildSkillBreakdown, buildTeamWeekly } from "../lib/reportQueries.js";
import { askClaude, handleLLMError } from "../lib/llm.js";
import { summarizeTeamForLLM } from "../lib/llmContext.js";

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
  const sessionId = req.query.sessionId as string | undefined;

  const breakdown = await buildSkillBreakdown(team.id, { playerId, position, sessionId });
  res.json({ team, ...breakdown });
});

// AI-generated coaching priorities based on the season's skill trends. Not cached — each call is a
// fresh (billed) request, since it's meant to be regenerated as new stats come in.
reportsRouter.post("/team/:teamId/coaching-insights", async (req: AuthedRequest, res) => {
  const team = await findOwnedTeam(req.params.teamId, req.userId!);
  if (!team) return res.status(404).json({ error: "Team not found" });

  try {
    const summary = await summarizeTeamForLLM(team.id);
    const insights = await askClaude(
      "You are an assistant volleyball coach. Based on this team's season stats, suggest 3-5 concrete, specific " +
        "coaching priorities or drills — a skill that needs work, a rotation or player trend worth addressing, " +
        "or something to reinforce because it's working. Format as a short list, one suggestion per line starting " +
        "with a dash. No markdown headers, no preamble.",
      summary,
      600,
    );
    res.json({ insights });
  } catch (err) {
    handleLLMError(err, res);
  }
});
