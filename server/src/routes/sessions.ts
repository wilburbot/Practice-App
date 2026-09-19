import { Router, raw } from "express";
import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { findOwnedSession, findOwnedTeam } from "../lib/ownership.js";
import { askClaude, handleLLMError } from "../lib/llm.js";
import { buildSessionReport } from "../lib/reportQueries.js";
import { generateHighlightsForClip } from "../lib/highlights.js";
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
  name: z.string().trim().max(120).optional().nullable(),
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

    generateHighlightsForClip(clip.id).catch((err) => console.error("Highlight generation failed:", err));

    const updated = await prisma.session.findUniqueOrThrow({ where: { id: session.id } });
    res.status(201).json(await serializeSession(updated));
  },
);

// Adds a video clip outside the live-recording flow (e.g. a phone recording added after practice) —
// creates its own SessionVideo row directly, so it never touches activeVideoClipId or the shared clock.
sessionsRouter.post(
  "/:sessionId/video/manual",
  upload.single("video"),
  async (req: AuthedRequest, res) => {
    const session = await findOwnedSession(req.params.sessionId, req.userId!);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (!req.file) return res.status(400).json({ error: "No video file uploaded" });

    const durationSec = req.body.durationSec ? Number(req.body.durationSec) : undefined;
    await prisma.sessionVideo.create({
      data: {
        sessionId: session.id,
        url: `/uploads/${req.file.filename}`,
        durationSec: Number.isFinite(durationSec) ? durationSec : undefined,
      },
    });

    res.status(201).json(await serializeSession(session));
  },
);

const CHUNKS_DIR = path.join(UPLOAD_DIR, ".chunks");
const UPLOAD_ID_RE = /^[a-zA-Z0-9_-]{1,100}$/;

function chunkDir(sessionId: string, uploadId: string): string {
  return path.join(CHUNKS_DIR, `${sessionId}-${uploadId}`);
}

// One piece of a large video, uploaded as a raw request body instead of multipart — long practice
// recordings can be hundreds of MB, and a single giant POST is exactly what tends to lag or drop on
// courtside wifi/cellular. Splitting it lets the client retry just the failed piece instead of the
// whole file, and lets us show real upload progress.
sessionsRouter.post(
  "/:sessionId/video/chunk/:uploadId/:index",
  raw({ type: "*/*", limit: "8mb" }),
  async (req: AuthedRequest, res) => {
    const session = await findOwnedSession(req.params.sessionId, req.userId!);
    if (!session) return res.status(404).json({ error: "Session not found" });

    const { uploadId, index } = req.params;
    if (!UPLOAD_ID_RE.test(uploadId)) return res.status(400).json({ error: "Invalid uploadId" });
    const idx = Number(index);
    if (!Number.isInteger(idx) || idx < 0) return res.status(400).json({ error: "Invalid chunk index" });
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: "Empty chunk body" });
    }

    const dir = chunkDir(session.id, uploadId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, String(idx)), req.body);
    res.status(204).end();
  },
);

const chunkCompleteSchema = z.object({
  uploadId: z.string().regex(UPLOAD_ID_RE),
  totalChunks: z.number().int().min(1),
  ext: z
    .string()
    .regex(/^[a-zA-Z0-9]{1,10}$/)
    .default("webm"),
  durationSec: z.number().optional().nullable(),
  // Present when finalizing a live-recording clip started via /recording/start; absent for a
  // manually added video, which creates its own new clip instead.
  clipId: z.string().optional().nullable(),
});

// Reassembles a chunked upload into the final file, then finalizes it exactly like the single-shot
// upload routes below (attach to an existing clip, or create a new one for a manual add).
sessionsRouter.post("/:sessionId/video/chunk/complete", async (req: AuthedRequest, res) => {
  const session = await findOwnedSession(req.params.sessionId, req.userId!);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const parsed = chunkCompleteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const { uploadId, totalChunks, ext, durationSec, clipId } = parsed.data;

  const dir = chunkDir(session.id, uploadId);
  const finalFilename = `${crypto.randomUUID()}.${ext}`;
  const finalPath = path.join(UPLOAD_DIR, finalFilename);

  try {
    const writeStream = fsSync.createWriteStream(finalPath);
    for (let i = 0; i < totalChunks; i++) {
      const data = await fs.readFile(path.join(dir, String(i)));
      if (!writeStream.write(data)) {
        await new Promise<void>((resolve) => writeStream.once("drain", () => resolve()));
      }
    }
    await new Promise<void>((resolve, reject) => {
      writeStream.end((err?: Error | null) => (err ? reject(err) : resolve()));
    });
  } catch {
    await fs.unlink(finalPath).catch(() => {});
    return res.status(400).json({ error: "Upload incomplete — one or more parts are missing. Please retry." });
  }
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});

  if (clipId) {
    const clip = await prisma.sessionVideo.findFirst({ where: { id: clipId, sessionId: session.id } });
    if (!clip) {
      await fs.unlink(finalPath).catch(() => {});
      return res.status(404).json({ error: "Recording clip not found — start a new recording and try again." });
    }
    await prisma.sessionVideo.update({
      where: { id: clip.id },
      data: { url: `/uploads/${finalFilename}`, durationSec: durationSec ?? undefined },
    });
    if (session.activeVideoClipId === clip.id) {
      await prisma.session.update({ where: { id: session.id }, data: { activeVideoClipId: null } });
    }
    generateHighlightsForClip(clip.id).catch((err) => console.error("Highlight generation failed:", err));
  } else {
    await prisma.sessionVideo.create({
      data: { sessionId: session.id, url: `/uploads/${finalFilename}`, durationSec: durationSec ?? undefined },
    });
  }

  const updated = await prisma.session.findUniqueOrThrow({ where: { id: session.id } });
  res.status(201).json(await serializeSession(updated));
});

// Removes one video clip (and its file). Stat taps that were linked to it keep their timestamp but
// lose the video reference (onDelete: SetNull), same as if that clip never had a file uploaded.
sessionsRouter.delete("/:sessionId/video/:clipId", async (req: AuthedRequest, res) => {
  const session = await findOwnedSession(req.params.sessionId, req.userId!);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const clip = await prisma.sessionVideo.findFirst({
    where: { id: req.params.clipId, sessionId: session.id },
  });
  if (!clip) return res.status(404).json({ error: "Video clip not found" });

  await prisma.sessionVideo.delete({ where: { id: clip.id } });

  if (clip.url) {
    const filePath = path.join(UPLOAD_DIR, path.basename(clip.url));
    await fs.unlink(filePath).catch(() => {});
  }

  const updated = await prisma.session.findUniqueOrThrow({ where: { id: session.id } });
  res.json(await serializeSession(updated));
});
