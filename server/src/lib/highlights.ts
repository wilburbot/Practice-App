import { execFile } from "node:child_process";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { prisma } from "../db.js";

// ffmpeg-static's CJS export + ESM .d.ts don't line up well under NodeNext resolution, so require
// it directly rather than fight the broken default-import typing.
const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static") as string | null;

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const PRE_ROLL_SEC = 15;
const POST_ROLL_SEC = 15;

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("ffmpeg binary not found"));
    execFile(ffmpegPath, args, { timeout: 60_000 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Cuts a short clip out of `sourceUrl` (a /uploads/... path) centered on `timestampSec`, with a
 * 15s pre/post-roll window, and saves it under uploads/.
 *
 * Deliberately re-encodes rather than stream-copying: browser MediaRecorder output often has
 * sparse keyframes, so a copy-trim can only start at the nearest keyframe -- which may be well
 * before the requested window (or even push the real moment past the clip's end) and does
 * nothing to shrink the file, defeating the point of a small highlight clip. Re-encoding at a
 * capped resolution/bitrate guarantees both a correct window and a genuinely small file.
 */
async function extractClip(sourceUrl: string, timestampSec: number): Promise<string> {
  const sourcePath = path.join(UPLOAD_DIR, path.basename(sourceUrl));
  const start = Math.max(0, timestampSec - PRE_ROLL_SEC);
  const duration = PRE_ROLL_SEC + POST_ROLL_SEC;
  const filename = `highlight-${crypto.randomUUID()}.mp4`;
  const destPath = path.join(UPLOAD_DIR, filename);

  await runFfmpeg([
    "-ss", String(start),
    "-i", sourcePath,
    "-t", String(duration),
    "-vf", "scale='min(854,iw)':-2",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "28",
    "-c:a", "aac",
    "-b:a", "96k",
    "-movflags", "+faststart",
    "-y",
    destPath,
  ]);

  return `/uploads/${filename}`;
}

/**
 * Generates a short highlight clip for every stat tap linked to this video clip, once the source
 * file has finished uploading. Fire-and-forget from the caller's perspective -- each tap is
 * processed independently so one failure doesn't block the rest, and failures just leave
 * highlightUrl null (the highlight reel falls back to seeking the full video for those).
 */
export async function generateHighlightsForClip(clipId: string): Promise<void> {
  const clip = await prisma.sessionVideo.findUnique({ where: { id: clipId } });
  if (!clip?.url) return;

  const events = await prisma.statEvent.findMany({
    where: { videoClipId: clipId, videoTimestampSec: { not: null }, highlightUrl: null },
  });

  for (const event of events) {
    try {
      const highlightUrl = await extractClip(clip.url, event.videoTimestampSec!);
      await prisma.statEvent.update({ where: { id: event.id }, data: { highlightUrl } });
    } catch (err) {
      console.error(`Failed to generate highlight for stat event ${event.id}:`, err);
    }
  }
}
