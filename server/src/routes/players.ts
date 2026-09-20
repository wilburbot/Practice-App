import { Router } from "express";
import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { findOwnedPlayer, findOwnedTeam } from "../lib/ownership.js";

export const playersRouter = Router();
playersRouter.use(requireAuth);

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const uploadPhoto = multer({
  storage: photoStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image uploads are allowed"));
    }
    cb(null, true);
  },
});

/** Best-effort delete of a previously uploaded photo file — a missing file is not an error. */
async function deletePhotoFile(photoUrl: string | null) {
  if (!photoUrl?.startsWith("/uploads/")) return;
  await fs.unlink(path.join(UPLOAD_DIR, path.basename(photoUrl))).catch(() => {});
}

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

playersRouter.post("/:playerId/photo", uploadPhoto.single("photo"), async (req: AuthedRequest, res) => {
  const player = await findOwnedPlayer(req.params.playerId, req.userId!);
  if (!player) return res.status(404).json({ error: "Player not found" });
  if (!req.file) return res.status(400).json({ error: "No photo uploaded" });

  await deletePhotoFile(player.photoUrl);
  const updated = await prisma.player.update({
    where: { id: player.id },
    data: { photoUrl: `/uploads/${req.file.filename}` },
  });
  res.json(updated);
});

playersRouter.delete("/:playerId/photo", async (req: AuthedRequest, res) => {
  const player = await findOwnedPlayer(req.params.playerId, req.userId!);
  if (!player) return res.status(404).json({ error: "Player not found" });

  await deletePhotoFile(player.photoUrl);
  const updated = await prisma.player.update({ where: { id: player.id }, data: { photoUrl: null } });
  res.json(updated);
});
