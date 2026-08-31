import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { findOwnedPlayer, findOwnedSession } from "../lib/ownership.js";

export const statsRouter = Router();
statsRouter.use(requireAuth);

const ACTION_TYPES = ["ATTACK", "SERVE", "RECEPTION", "DIG", "BLOCK", "SET"] as const;
const RESULTS = ["SUCCESS", "ERROR", "ATTEMPT"] as const;
const SERVING_TEAMS = ["OWN", "OPPONENT"] as const;

const statEventSchema = z.object({
  sessionId: z.string().min(1),
  playerId: z.string().min(1),
  actionType: z.enum(ACTION_TYPES),
  result: z.enum(RESULTS),
  passRating: z.number().int().min(0).max(3).optional().nullable(),
  servingTeam: z.enum(SERVING_TEAMS).optional().nullable(),
  setNumber: z.number().int().min(1).max(10).optional().nullable(),
  videoTimestampSec: z.number().min(0).optional().nullable(),
});

statsRouter.get("/", async (req: AuthedRequest, res) => {
  const sessionId = req.query.sessionId as string | undefined;
  if (!sessionId) return res.status(400).json({ error: "sessionId query param is required" });
  const session = await findOwnedSession(sessionId, req.userId!);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const events = await prisma.statEvent.findMany({
    where: { sessionId },
    include: { player: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(events);
});

statsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = statEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const { sessionId, playerId } = parsed.data;

  const [session, player] = await Promise.all([
    findOwnedSession(sessionId, req.userId!),
    findOwnedPlayer(playerId, req.userId!),
  ]);
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (!player || player.teamId !== session.teamId) {
    return res.status(404).json({ error: "Player not found on this team" });
  }

  const event = await prisma.statEvent.create({ data: parsed.data });
  res.status(201).json(event);
});

statsRouter.delete("/:eventId", async (req: AuthedRequest, res) => {
  const event = await prisma.statEvent.findFirst({
    where: { id: req.params.eventId, session: { team: { ownerId: req.userId } } },
  });
  if (!event) return res.status(404).json({ error: "Stat event not found" });
  await prisma.statEvent.delete({ where: { id: event.id } });
  res.status(204).end();
});
