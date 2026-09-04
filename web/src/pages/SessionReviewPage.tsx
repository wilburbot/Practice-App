import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, assetUrl } from "../lib/api";
import type { SessionReport, StatEvent } from "../lib/types";
import { MetricsTable } from "../components/MetricsTable";
import { SessionRecapCard } from "../components/SessionRecapCard";
import { SessionSettingsCard } from "../components/SessionSettingsCard";

function playerLabel(event: StatEvent): string {
  if (!event.player) return "";
  return `${event.player.jerseyNumber != null ? `#${event.player.jerseyNumber} ` : ""}${event.player.firstName}`;
}

export function SessionReviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const markerRefs = useRef(new Map<string, HTMLButtonElement>());
  const [currentTime, setCurrentTime] = useState(0);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  // A seek that's waiting on a clip switch to finish loading before it can apply.
  const pendingSeekRef = useRef<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "error">("idle");

  const { data: report, isLoading } = useQuery({
    queryKey: ["session-report", sessionId],
    queryFn: () => api.get<SessionReport>(`/reports/session/${sessionId}`),
    enabled: !!sessionId,
  });

  const deleteClip = useMutation({
    mutationFn: (clipId: string) => api.delete(`/sessions/${sessionId}/video/${clipId}`),
    onSuccess: () => {
      setActiveClipId(null);
      queryClient.invalidateQueries({ queryKey: ["session-report", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["stats", sessionId] });
    },
  });

  const addVideo = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("video", file);
      return api.post(`/sessions/${sessionId}/video/manual`, form);
    },
    onMutate: () => setUploadStatus("uploading"),
    onSuccess: () => {
      setUploadStatus("idle");
      queryClient.invalidateQueries({ queryKey: ["session-report", sessionId] });
    },
    onError: () => setUploadStatus("error"),
  });

  const { data: events } = useQuery({
    queryKey: ["stats", sessionId],
    queryFn: () => api.get<StatEvent[]>(`/stats?sessionId=${sessionId}`),
    enabled: !!sessionId,
  });

  useEffect(() => {
    if (!activeClipId && report?.videos.length) {
      setActiveClipId(report.videos[0].id);
    }
  }, [report, activeClipId]);

  const activeClip = report?.videos.find((v) => v.id === activeClipId) ?? null;

  const seekTo = (event: StatEvent) => {
    if (event.videoTimestampSec == null || !event.videoClipId) return;
    if (event.videoClipId !== activeClipId) {
      // Different clip — switch src first, then seek once its metadata has loaded.
      pendingSeekRef.current = event.videoTimestampSec;
      setActiveClipId(event.videoClipId);
      return;
    }
    if (!videoRef.current) return;
    videoRef.current.currentTime = event.videoTimestampSec;
    // Tapping another marker before this play() resolves rejects the promise with a benign
    // "interrupted by a new load request" error — expected when jumping between plays quickly.
    videoRef.current.play().catch(() => {});
  };

  const onLoadedMetadata = () => {
    if (pendingSeekRef.current != null && videoRef.current) {
      videoRef.current.currentTime = pendingSeekRef.current;
      videoRef.current.play().catch(() => {});
      pendingSeekRef.current = null;
    }
  };

  const markers = [...(events ?? [])]
    .filter((e) => e.videoTimestampSec != null && e.videoClipId != null)
    .sort((a, b) => (a.videoTimestampSec ?? 0) - (b.videoTimestampSec ?? 0));

  // The marker whose timestamp the video is currently at or just past, on the clip that's actually
  // playing — kept in sync as playback advances.
  const activeMarker = [...markers]
    .reverse()
    .find((m) => m.videoClipId === activeClipId && (m.videoTimestampSec ?? 0) <= currentTime);

  useEffect(() => {
    if (!activeMarker) return;
    markerRefs.current.get(activeMarker.id)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [activeMarker]);

  if (isLoading || !report) return <p className="p-6">Loading…</p>;

  const { session, team, servingSplits, bySet, players, videos } = report;
  const hasServingData = servingSplits.pointScoring.attempts > 0 || servingSplits.sideOut.attempts > 0;
  const fmtPct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(0)}%`);

  return (
    <div className="p-4 max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-court-dark">
            {session.name || (session.type === "MATCH" ? `vs ${session.opponent ?? "Opponent"}` : session.type)} —
            Review
          </h1>
          <p className="text-sm text-slate-500">{new Date(session.date).toLocaleString()}</p>
        </div>
        <Link to={`/sessions/${sessionId}/live`} className="tap-target border rounded-lg px-3 py-2 text-sm font-semibold">
          Back to Live Tracking
        </Link>
      </div>

      <SessionSettingsCard session={session} />

      <div className="bg-white border rounded-xl p-3 flex flex-col gap-3">
        {videos.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {videos.map((clip, i) => (
              <span key={clip.id} className="inline-flex items-center gap-1">
                <button
                  onClick={() => {
                    pendingSeekRef.current = null;
                    setActiveClipId(clip.id);
                  }}
                  className={`tap-target text-xs border rounded-full px-3 py-1 font-semibold ${
                    activeClipId === clip.id ? "bg-court text-white border-court" : "hover:bg-court hover:text-white"
                  }`}
                >
                  Clip {i + 1} — {new Date(clip.startedAt).toLocaleTimeString()}
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete clip ${i + 1}? Stat taps stay, but lose their video link.`)) {
                      deleteClip.mutate(clip.id);
                    }
                  }}
                  className="tap-target text-xs text-slate-400 hover:text-red-600 px-1"
                  aria-label={`Delete clip ${i + 1}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        {activeClip ? (
          <>
            <video
              ref={videoRef}
              controls
              playsInline
              className="w-full max-h-[420px] bg-black rounded-lg"
              src={assetUrl(activeClip.url!)}
              onLoadedMetadata={onLoadedMetadata}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            />
            {videos.length === 1 && (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    if (window.confirm("Delete this video? Stat taps stay, but lose their video link.")) {
                      deleteClip.mutate(activeClip.id);
                    }
                  }}
                  className="tap-target text-xs text-slate-400 hover:text-red-600"
                >
                  Delete video
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {markers.map((event) => (
                <button
                  key={event.id}
                  ref={(el) => {
                    if (el) markerRefs.current.set(event.id, el);
                    else markerRefs.current.delete(event.id);
                  }}
                  onClick={() => seekTo(event)}
                  className={`tap-target text-xs border rounded-full px-3 py-1 ${
                    activeMarker?.id === event.id ? "bg-court text-white border-court" : "hover:bg-court hover:text-white"
                  }`}
                >
                  {Math.floor((event.videoTimestampSec ?? 0) / 60)}:
                  {String(Math.floor((event.videoTimestampSec ?? 0) % 60)).padStart(2, "0")} — {playerLabel(event)}{" "}
                  {event.actionType}/{event.result}
                </button>
              ))}
              {markers.length === 0 && <p className="text-xs text-slate-400">No stat taps were timestamped to this video.</p>}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400">No video for this session yet.</p>
        )}

        <label className="tap-target self-start text-sm text-court underline cursor-pointer">
          {uploadStatus === "uploading" ? "Uploading…" : videos.length > 0 ? "Add another video" : "Add video"}
          <input
            type="file"
            accept="video/*"
            className="hidden"
            disabled={uploadStatus === "uploading"}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) addVideo.mutate(file);
            }}
          />
        </label>
        {uploadStatus === "error" && <p className="text-xs text-red-600">Upload failed — try again.</p>}
      </div>

      <SessionRecapCard session={session} />

      <div className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold text-court-dark mb-3">Team Totals</h2>
        <MetricsTable rows={[{ label: session.type === "MATCH" ? "Team (match)" : "Team (practice)", metrics: team }]} />
      </div>

      {hasServingData && (
        <div className="bg-white border rounded-xl p-4">
          <h2 className="font-semibold text-court-dark mb-3">Serving Splits</h2>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold text-court-dark">{fmtPct(servingSplits.pointScoring.pct)}</p>
              <p className="text-sm text-slate-500">
                Point-Scoring % ({servingSplits.pointScoring.points}/{servingSplits.pointScoring.attempts} own-serve rallies)
              </p>
            </div>
            <div>
              <p className="text-3xl font-bold text-court-dark">{fmtPct(servingSplits.sideOut.pct)}</p>
              <p className="text-sm text-slate-500">
                Side-Out % ({servingSplits.sideOut.points}/{servingSplits.sideOut.attempts} receiving rallies)
              </p>
            </div>
          </div>
        </div>
      )}

      {bySet.length > 1 && (
        <div className="bg-white border rounded-xl p-4">
          <h2 className="font-semibold text-court-dark mb-3">By Set</h2>
          <div className="flex flex-col gap-4">
            {bySet.map((s) => (
              <div key={s.setNumber}>
                <h3 className="text-sm font-semibold text-slate-500 mb-2">Set {s.setNumber}</h3>
                <MetricsTable rows={[{ label: `Set ${s.setNumber}`, metrics: s.team }]} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold text-court-dark mb-3">Box Score</h2>
        <MetricsTable
          rows={players.map((p) => ({
            label: `${p.player.jerseyNumber != null ? `#${p.player.jerseyNumber} ` : ""}${p.player.firstName} ${p.player.lastName}`,
            metrics: p.metrics,
            href: `/players/${p.player.id}`,
          }))}
        />
      </div>
    </div>
  );
}
