import { api } from "./api";
import type { Session } from "./types";

// Long practice recordings can run hundreds of MB — a single giant POST is exactly what tends to
// lag or drop on courtside wifi/cellular. Splitting into small chunks lets a dropped connection
// retry just the failed piece instead of restarting the whole file, and gives real upload progress.
const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB
const MAX_CHUNK_RETRIES = 4;

function extFromMimeType(mimeType: string): string {
  return mimeType.includes("mp4") ? "mp4" : "webm";
}

async function uploadChunkWithRetry(sessionId: string, uploadId: string, index: number, chunk: Blob): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_CHUNK_RETRIES; attempt++) {
    try {
      await api.postBinary(`/sessions/${sessionId}/video/chunk/${uploadId}/${index}`, chunk);
      return;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_CHUNK_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Chunk ${index} failed to upload`);
}

/** Reads a video file's duration client-side (for a manually-added file that skipped recording). */
export function readVideoDuration(file: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const videoEl = document.createElement("video");
    videoEl.preload = "metadata";
    videoEl.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(videoEl.duration) ? videoEl.duration : null);
    };
    videoEl.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    videoEl.src = url;
  });
}

export interface ChunkedUploadOptions {
  sessionId: string;
  blob: Blob;
  durationSec: number | null;
  /** Attach to this existing recording clip (live-tracking flow) instead of creating a new one. */
  clipId?: string;
  onProgress?: (fraction: number) => void;
}

/** Uploads a recorded video in small pieces, with per-chunk retry, instead of one large request. */
export async function uploadVideoChunked({
  sessionId,
  blob,
  durationSec,
  clipId,
  onProgress,
}: ChunkedUploadOptions): Promise<Session> {
  const uploadId = crypto.randomUUID();
  const totalChunks = Math.max(1, Math.ceil(blob.size / CHUNK_SIZE));
  const ext = extFromMimeType(blob.type);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const chunk = blob.slice(start, Math.min(start + CHUNK_SIZE, blob.size));
    await uploadChunkWithRetry(sessionId, uploadId, i, chunk);
    onProgress?.((i + 1) / totalChunks);
  }

  return api.post<Session>(`/sessions/${sessionId}/video/chunk/complete`, {
    uploadId,
    totalChunks,
    ext,
    durationSec,
    clipId: clipId ?? null,
  });
}
