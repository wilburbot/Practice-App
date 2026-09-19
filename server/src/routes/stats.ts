import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { findOwnedPlayer, findOwnedSession, findOwnedStatEvent } from "../lib/ownership.js";

export const statsRouter = Router();
statsRouter.use(requireAuth);

const ACTION_TYPES = ["ATTACK", "SERVE", "RECEPTION", "DIG", "BLOCK", "SET"] as const;
const RESULTS = ["SUCCESS", "ERROR", "ATTEMPT", "BLOCKED"] as const;
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
  // Which recorded clip videoTimestampSec is relative to — the live tracking screen passes the
  // session's current activeVideoClipId here so playback knows which file to seek within.
  videoClipId: z.string().optional().nullable(),
  // Normalized 0-1 position on the opponent's court where an attack/serve landed, for tendency charts.
  targetX: z.number().min(0).max(1).optional().nullable(),
  targetY: z.number().min(0).max(1).optional().nullable(),
});

statsRouter.get("/", async (req: AuthedRequest, res) => {
  const sessionId = req.query.sessionId as string | undefined;
  if (!sessionId) return res.status(400).json({ error: "sessionId query param is required" });
  const session = await findOwnedSession(sessionId, req.userId!);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const events = await prisma.statEvent.findMany({
    where: { sessionId },
    include: { player: true, videoClip: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(events);
});

statsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = statEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const { sessionId, playerId, videoClipId } = parsed.data;

  const [session, player] = await Promise.all([
    findOwnedSession(sessionId, req.userId!),
    findOwnedPlayer(playerId, req.userId!),
  ]);
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (!player || player.teamId !== session.teamId) {
    return res.status(404).json({ error: "Player not found on this team" });
  }
  if (videoClipId) {
    const clip = await prisma.sessionVideo.findFirst({ where: { id: videoClipId, sessionId } });
    if (!clip) return res.status(404).json({ error: "Video clip not found on this session" });
  }

  const event = await prisma.statEvent.create({ data: parsed.data });
  res.status(201).json(event);
});

const targetSchema = z.object({
  targetX: z.number().min(0).max(1).nullable(),
  targetY: z.number().min(0).max(1).nullable(),
});

// Retroactively tags (or clears) where an already-logged attack/serve landed — used from the
// Recent Events list so setting court location never blocks the live tap-to-track flow.
statsRouter.patch("/:eventId/target", async (req: AuthedRequest, res) => {
  const event = await findOwnedStatEvent(req.params.eventId, req.userId!);
  if (!event) return res.status(404).json({ error: "Stat event not found" });

  const parsed = targetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }

  const updated = await prisma.statEvent.update({ where: { id: event.id }, data: parsed.data });
  res.json(updated);
});

statsRouter.delete("/:eventId", async (req: AuthedRequest, res) => {
  const event = await findOwnedStatEvent(req.params.eventId, req.userId!);
  if (!event) return res.status(404).json({ error: "Stat event not found" });
  await prisma.statEvent.delete({ where: { id: event.id } });
  res.status(204).end();
});
