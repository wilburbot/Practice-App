import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { findOwnedTeam } from "../lib/ownership.js";

export const teamsRouter = Router();
teamsRouter.use(requireAuth);

teamsRouter.get("/", async (req: AuthedRequest, res) => {
  const teams = await prisma.team.findMany({
    where: { ownerId: req.userId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { players: true, sessions: true } } },
  });
  res.json(teams);
});

const teamSchema = z.object({
  name: z.string().min(1),
  season: z.string().optional(),
});

teamsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = teamSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const team = await prisma.team.create({
    data: { ...parsed.data, ownerId: req.userId! },
  });
  res.status(201).json(team);
});

teamsRouter.get("/:teamId", async (req: AuthedRequest, res) => {
  const team = await findOwnedTeam(req.params.teamId, req.userId!);
  if (!team) return res.status(404).json({ error: "Team not found" });
  res.json(team);
});

teamsRouter.patch("/:teamId", async (req: AuthedRequest, res) => {
  const team = await findOwnedTeam(req.params.teamId, req.userId!);
  if (!team) return res.status(404).json({ error: "Team not found" });
  const parsed = teamSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const updated = await prisma.team.update({ where: { id: team.id }, data: parsed.data });
  res.json(updated);
});

teamsRouter.delete("/:teamId", async (req: AuthedRequest, res) => {
  const team = await findOwnedTeam(req.params.teamId, req.userId!);
  if (!team) return res.status(404).json({ error: "Team not found" });
  await prisma.team.delete({ where: { id: team.id } });
  res.status(204).end();
});

// Returns the team's read-only share link token, generating one on first use.
teamsRouter.get("/:teamId/share", async (req: AuthedRequest, res) => {
  const team = await findOwnedTeam(req.params.teamId, req.userId!);
  if (!team) return res.status(404).json({ error: "Team not found" });

  if (team.shareToken) return res.json({ shareToken: team.shareToken });

  const shareToken = crypto.randomBytes(18).toString("base64url");
  const updated = await prisma.team.update({ where: { id: team.id }, data: { shareToken } });
  res.json({ shareToken: updated.shareToken });
});

// Generates a brand-new share token, invalidating the old link (e.g. if it leaked).
teamsRouter.post("/:teamId/share/rotate", async (req: AuthedRequest, res) => {
  const team = await findOwnedTeam(req.params.teamId, req.userId!);
  if (!team) return res.status(404).json({ error: "Team not found" });

  const shareToken = crypto.randomBytes(18).toString("base64url");
  const updated = await prisma.team.update({ where: { id: team.id }, data: { shareToken } });
  res.json({ shareToken: updated.shareToken });
});
