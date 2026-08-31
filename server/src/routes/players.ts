import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { findOwnedPlayer, findOwnedTeam } from "../lib/ownership.js";

export const playersRouter = Router();
playersRouter.use(requireAuth);

playersRouter.get("/", async (req: AuthedRequest, res) => {
  const teamId = req.query.teamId as string | undefined;
  if (!teamId) return res.status(400).json({ error: "teamId query param is required" });
  const team = await findOwnedTeam(teamId, req.userId!);
  if (!team) return res.status(404).json({ error: "Team not found" });

  const players = await prisma.player.findMany({
    where: { teamId },
    orderBy: [{ active: "desc" }, { jerseyNumber: { sort: "asc", nulls: "last" } }, { lastName: "asc" }],
  });
  res.json(players);
});

const playerSchema = z.object({
  teamId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  jerseyNumber: z.number().int().min(0).max(999).optional().nullable(),
  position: z.string().optional().nullable(),
});

playersRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = playerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const team = await findOwnedTeam(parsed.data.teamId, req.userId!);
  if (!team) return res.status(404).json({ error: "Team not found" });

  const player = await prisma.player.create({ data: parsed.data });
  res.status(201).json(player);
});

const updateSchema = playerSchema.omit({ teamId: true }).partial().extend({
  active: z.boolean().optional(),
});

playersRouter.patch("/:playerId", async (req: AuthedRequest, res) => {
  const player = await findOwnedPlayer(req.params.playerId, req.userId!);
  if (!player) return res.status(404).json({ error: "Player not found" });
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const updated = await prisma.player.update({ where: { id: player.id }, data: parsed.data });
  res.json(updated);
});

playersRouter.delete("/:playerId", async (req: AuthedRequest, res) => {
  const player = await findOwnedPlayer(req.params.playerId, req.userId!);
  if (!player) return res.status(404).json({ error: "Player not found" });
  await prisma.player.delete({ where: { id: player.id } });
  res.status(204).end();
});
