import { useEffect, useRef, useState } from "react";
import { assetUrl } from "../lib/api";
import type { HighlightClip } from "../lib/types";

const PRE_ROLL_SEC = 4;
const POST_ROLL_SEC = 2;

const CLIP_LABELS: Record<HighlightClip["actionType"], Record<HighlightClip["result"], string>> = {
  ATTACK: { SUCCESS: "Kill", ERROR: "Attack Error", ATTEMPT: "Attack" },
  SERVE: { SUCCESS: "Ace", ERROR: "Serve Error", ATTEMPT: "Serve" },
  RECEPTION: { SUCCESS: "Good Pass", ERROR: "Reception Error", ATTEMPT: "Reception" },
  DIG: { SUCCESS: "Dig", ERROR: "Dig Error", ATTEMPT: "Dig" },
  BLOCK: { SUCCESS: "Block Kill", ERROR: "Block Error", ATTEMPT: "Block" },
  SET: { SUCCESS: "Assist", ERROR: "Set Error", ATTEMPT: "Set" },
};

export function HighlightReelCard({ clips }: { clips: HighlightClip[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<"highlights" | "all">("highlights");
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const loadedUrlRef = useRef<string | null>(null);

  const filtered = mode === "highlights" ? clips.filter((c) => c.result === "SUCCESS") : clips;
  const clip = filtered[index];
  // A highlightUrl clip is already a short (~30s) extract centered on the moment — play it from
  // the start with no seeking needed. Only fall back to seeking within the full recording (heavier
  // to load, especially for a long practice video) when no snippet has been generated yet.
  const isSnippet = !!clip?.highlightUrl;
  const clipSrc = clip?.highlightUrl ?? clip?.videoUrl ?? null;

  // Clamp index when the filter changes and shrinks the list.
  useEffect(() => {
    if (index >= filtered.length) setIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, filtered.length]);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !clip || !clipSrc) return;
    const url = assetUrl(clipSrc);
    const start = isSnippet ? 0 : Math.max(0, clip.timestampSec - PRE_ROLL_SEC);

    if (loadedUrlRef.current !== url) {
      loadedUrlRef.current = url;
      videoEl.src = url;
      const onLoaded = () => {
        videoEl.currentTime = start;
        if (isPlaying) videoEl.play().catch(() => {});
      };
      videoEl.addEventListener("loadedmetadata", onLoaded, { once: true });
      return () => videoEl.removeEventListener("loadedmetadata", onLoaded);
    } else {
      videoEl.currentTime = start;
      if (isPlaying) videoEl.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip?.sessionId, clip?.timestampSec, clipSrc]);

  const onTimeUpdate = () => {
    if (isSnippet) return; // short snippet just plays out naturally and advances via onEnded
    const videoEl = videoRef.current;
    if (!videoEl || !clip) return;
    if (videoEl.currentTime >= clip.timestampSec + POST_ROLL_SEC) {
      goTo(index + 1);
    }
  };

  const goTo = (next: number) => {
    if (next < 0 || next >= filtered.length) {
      setIsPlaying(false);
      return;
    }
    setIndex(next);
  };

  const togglePlay = () => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    if (isPlaying) {
      videoEl.pause();
      setIsPlaying(false);
    } else {
      videoEl.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  if (clips.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 className="font-semibold text-slate-900">Highlight Reel</h2>
        <div className="flex gap-1">
          <button
            onClick={() => setMode("highlights")}
            className={`tap-target text-xs px-3 py-1.5 rounded-full border font-semibold ${
              mode === "highlights" ? "bg-court text-white border-court" : "bg-white"
            }`}
          >
            Highlights Only
          </button>
          <button
            onClick={() => setMode("all")}
            className={`tap-target text-xs px-3 py-1.5 rounded-full border font-semibold ${
              mode === "all" ? "bg-court text-white border-court" : "bg-white"
            }`}
          >
            All Plays
          </button>
        </div>
      </div>

      {filtered.length === 0 || !clip ? (
        <p className="text-sm text-slate-400">No {mode === "highlights" ? "highlight" : "tagged"} clips yet.</p>
      ) : (
        <>
          <video
            ref={videoRef}
            playsInline
            controls
            className="w-full max-h-[420px] bg-black rounded-lg"
            onTimeUpdate={onTimeUpdate}
            onEnded={() => goTo(index + 1)}
          />
          <div className="flex items-center justify-between flex-wrap gap-2 mt-3">
            <p className="text-sm text-slate-700">
              Clip {index + 1} of {filtered.length} — {CLIP_LABELS[clip.actionType][clip.result]}
              {clip.sessionType === "MATCH" && clip.opponent ? ` vs ${clip.opponent}` : ""} ·{" "}
              {new Date(clip.sessionDate).toLocaleDateString()}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => goTo(index - 1)}
                disabled={index === 0}
                className="tap-target border rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
              >
                ◀ Prev
              </button>
              <button
                onClick={togglePlay}
                className="tap-target bg-court text-white rounded-lg px-4 py-1.5 text-sm font-semibold"
              >
                {isPlaying ? "Pause" : "Play"}
              </button>
              <button
                onClick={() => goTo(index + 1)}
                disabled={index === filtered.length - 1}
                className="tap-target border rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
              >
                Next ▶
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
