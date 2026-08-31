import { Router } from "express";
import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { findOwnedSession, findOwnedTeam } from "../lib/ownership.js";

export const sessionsRouter = Router();
sessionsRouter.use(requireAuth);

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".webm";
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("video/")) {
      return cb(new Error("Only video uploads are allowed"));
    }
    cb(null, true);
  },
});

sessionsRouter.get("/", async (req: AuthedRequest, res) => {
  const teamId = req.query.teamId as string | undefined;
  if (!teamId) return res.status(400).json({ error: "teamId query param is required" });
  const team = await findOwnedTeam(teamId, req.userId!);
  if (!team) return res.status(404).json({ error: "Team not found" });

  const sessions = await prisma.session.findMany({
    where: { teamId },
    orderBy: { date: "desc" },
    include: { _count: { select: { statEvents: true } } },
  });
  res.json(sessions);
});

const sessionSchema = z.object({
  teamId: z.string().min(1),
  type: z.enum(["PRACTICE", "MATCH", "SCRIMMAGE"]).default("PRACTICE"),
  date: z.string().datetime().optional(),
  opponent: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

sessionsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = sessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const team = await findOwnedTeam(parsed.data.teamId, req.userId!);
  if (!team) return res.status(404).json({ error: "Team not found" });

  const session = await prisma.session.create({
    data: {
      ...parsed.data,
      date: parsed.data.date ? new Date(parsed.data.date) : undefined,
    },
  });
  res.status(201).json(session);
});

sessionsRouter.get("/:sessionId", async (req: AuthedRequest, res) => {
  const session = await findOwnedSession(req.params.sessionId, req.userId!);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json(session);
});

const updateSessionSchema = sessionSchema.omit({ teamId: true }).partial();

sessionsRouter.patch("/:sessionId", async (req: AuthedRequest, res) => {
  const session = await findOwnedSession(req.params.sessionId, req.userId!);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const parsed = updateSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const updated = await prisma.session.update({
    where: { id: session.id },
    data: {
      ...parsed.data,
      date: parsed.data.date ? new Date(parsed.data.date) : undefined,
    },
  });
  res.json(updated);
});

sessionsRouter.delete("/:sessionId", async (req: AuthedRequest, res) => {
  const session = await findOwnedSession(req.params.sessionId, req.userId!);
  if (!session) return res.status(404).json({ error: "Session not found" });
  await prisma.session.delete({ where: { id: session.id } });
  res.status(204).end();
});

// Marks "recording started now" on the session, server time. Every coach's device reads this back
// to compute stat-tap video timestamps, so taps stay in sync with the one video being recorded even
// when logged from a different device than the one actually recording.
sessionsRouter.post("/:sessionId/recording/start", async (req: AuthedRequest, res) => {
  const session = await findOwnedSession(req.params.sessionId, req.userId!);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { videoStartedAt: new Date() },
  });
  res.json(updated);
});

sessionsRouter.post("/:sessionId/recording/stop", async (req: AuthedRequest, res) => {
  const session = await findOwnedSession(req.params.sessionId, req.userId!);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { videoStartedAt: null },
  });
  res.json(updated);
});

sessionsRouter.post(
  "/:sessionId/video",
  upload.single("video"),
  async (req: AuthedRequest, res) => {
    const session = await findOwnedSession(req.params.sessionId, req.userId!);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (!req.file) return res.status(400).json({ error: "No video file uploaded" });

    const durationSec = req.body.durationSec ? Number(req.body.durationSec) : undefined;
    const updated = await prisma.session.update({
      where: { id: session.id },
      data: {
        videoUrl: `/uploads/${req.file.filename}`,
        videoDurationSec: Number.isFinite(durationSec) ? durationSec : undefined,
      },
    });
    res.status(201).json(updated);
  },
);
