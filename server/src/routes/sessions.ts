import { Router } from "express";
import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { findOwnedSession, findOwnedTeam } from "../lib/ownership.js";
import { askClaude, handleLLMError } from "../lib/llm.js";
import { buildSessionReport } from "../lib/reportQueries.js";
import type { Session } from "@prisma/client";

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

// Attaches the finalized clip list + the active clip's start time (if one is currently recording),
// so the frontend never has to reason about Session vs SessionVideo separately.
async function serializeSession(session: Session) {
  const [videos, activeClip] = await Promise.all([
    prisma.sessionVideo.findMany({
      where: { sessionId: session.id, url: { not: null } },
      orderBy: { startedAt: "asc" },
    }),
    session.activeVideoClipId
      ? prisma.sessionVideo.findUnique({ where: { id: session.activeVideoClipId } })
      : Promise.resolve(null),
  ]);
  return { ...session, videos, activeVideoStartedAt: activeClip?.startedAt ?? null };
}

sessionsRouter.get("/", async (req: AuthedRequest, res) => {
  const teamId = req.query.teamId as string | undefined;
  if (!teamId) return res.status(400).json({ error: "teamId query param is required" });
  const team = await findOwnedTeam(teamId, req.userId!);
  if (!team) return res.status(404).json({ error: "Team not found" });

  const sessions = await prisma.session.findMany({
    where: { teamId },
    orderBy: { date: "desc" },
    include: { _count: { select: { statEvents: true, videos: true } } },
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
  res.status(201).json(await serializeSession(session));
});

sessionsRouter.get("/:sessionId", async (req: AuthedRequest, res) => {
  const session = await findOwnedSession(req.params.sessionId, req.userId!);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json(await serializeSession(session));
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
  res.json(await serializeSession(updated));
});

sessionsRouter.delete("/:sessionId", async (req: AuthedRequest, res) => {
  const session = await findOwnedSession(req.params.sessionId, req.userId!);
  if (!session) return res.status(404).json({ error: "Session not found" });
  await prisma.session.delete({ where: { id: session.id } });
  res.status(204).end();
});

// Starts a brand-new video clip for this session (never overwrites a previous one — each Start/Stop
// cycle is its own SessionVideo row). New stat taps get linked to this clip via activeVideoClipId so
// every coach's device computes videoTimestampSec against the same shared reference.
sessionsRouter.post("/:sessionId/recording/start", async (req: AuthedRequest, res) => {
  const session = await findOwnedSession(req.params.sessionId, req.userId!);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const clip = await prisma.sessionVideo.create({
    data: { sessionId: session.id, startedAt: new Date() },
  });
  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { activeVideoClipId: clip.id },
  });
  res.json(await serializeSession(updated));
});

sessionsRouter.post("/:sessionId/recording/stop", async (req: AuthedRequest, res) => {
  const session = await findOwnedSession(req.params.sessionId, req.userId!);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { activeVideoClipId: null },
  });
  res.json(await serializeSession(updated));
});

function fmtPct(value: number | null): string {
  return value == null ? "n/a" : `${Math.round(value * 100)}%`;
}

// Generates (and caches) a short AI recap of this session's box score.
sessionsRouter.post("/:sessionId/recap", async (req: AuthedRequest, res) => {
  const session = await findOwnedSession(req.params.sessionId, req.userId!);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const report = await buildSessionReport(session);
  const lines: string[] = [
    `${session.type}${session.opponent ? ` vs ${session.opponent}` : ""} on ${session.date.toDateString()}`,
    `Team totals: ${report.team.points} points, ${report.team.totalErrors} errors, attack efficiency ${fmtPct(report.team.ATTACK.efficiency)}`,
    "",
    "Box score:",
    ...report.players
      .slice(0, 12)
      .map(
        (p) =>
          `${p.player.firstName} ${p.player.lastName}: ${p.metrics.points} pts, ${p.metrics.ATTACK.success} kills/${p.metrics.ATTACK.error} att err, ${p.metrics.SERVE.success} aces, ${p.metrics.DIG.success} digs, ${p.metrics.BLOCK.success} blocks, ${p.metrics.SET.success} assists`,
      ),
  ];

  try {
    const recapText = await askClaude(
      "You are an assistant volleyball coach writing a short recap of a practice or match for the team to read. " +
        "Use only the box score data given. Keep it to 3-5 sentences, mention standout performers by name, and " +
        "note one specific area to work on. Plain text, no markdown headers or bullet points.",
      lines.join("\n"),
      500,
    );
    const updated = await prisma.session.update({
      where: { id: session.id },
      data: { recapText, recapGeneratedAt: new Date() },
    });
    res.json(await serializeSession(updated));
  } catch (err) {
    handleLLMError(err, res);
  }
});

// Finalizes an in-progress clip (started via /recording/start) with the uploaded file. The client
// passes back the clipId it got from /recording/start so this never guesses which clip to attach to.
sessionsRouter.post(
  "/:sessionId/video",
  upload.single("video"),
  async (req: AuthedRequest, res) => {
    const session = await findOwnedSession(req.params.sessionId, req.userId!);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (!req.file) return res.status(400).json({ error: "No video file uploaded" });

    const clipId = req.body.clipId as string | undefined;
    if (!clipId) return res.status(400).json({ error: "clipId is required" });

    const clip = await prisma.sessionVideo.findFirst({ where: { id: clipId, sessionId: session.id } });
    if (!clip) {
      return res.status(404).json({ error: "Recording clip not found — start a new recording and try again." });
    }

    const durationSec = req.body.durationSec ? Number(req.body.durationSec) : undefined;
    await prisma.sessionVideo.update({
      where: { id: clip.id },
      data: {
        url: `/uploads/${req.file.filename}`,
        durationSec: Number.isFinite(durationSec) ? durationSec : undefined,
      },
    });

    // Covers a client that uploads without ever calling /recording/stop first.
    if (session.activeVideoClipId === clip.id) {
      await prisma.session.update({ where: { id: session.id }, data: { activeVideoClipId: null } });
    }

    const updated = await prisma.session.findUniqueOrThrow({ where: { id: session.id } });
    res.status(201).json(await serializeSession(updated));
  },
);
