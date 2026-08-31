import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, assetUrl } from "../lib/api";
import type { SessionReport, StatEvent } from "../lib/types";
import { MetricsTable } from "../components/MetricsTable";

function playerLabel(event: StatEvent): string {
  if (!event.player) return "";
  return `${event.player.jerseyNumber != null ? `#${event.player.jerseyNumber} ` : ""}${event.player.firstName}`;
}

export function SessionReviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const markerRefs = useRef(new Map<string, HTMLButtonElement>());
  const [currentTime, setCurrentTime] = useState(0);

  const { data: report, isLoading } = useQuery({
    queryKey: ["session-report", sessionId],
    queryFn: () => api.get<SessionReport>(`/reports/session/${sessionId}`),
    enabled: !!sessionId,
  });

  const { data: events } = useQuery({
    queryKey: ["stats", sessionId],
    queryFn: () => api.get<StatEvent[]>(`/stats?sessionId=${sessionId}`),
    enabled: !!sessionId,
  });

  const seekTo = (event: StatEvent) => {
    if (event.videoTimestampSec == null || !videoRef.current) return;
    videoRef.current.currentTime = event.videoTimestampSec;
    videoRef.current.play();
  };

  const markers = [...(events ?? [])]
    .filter((e) => e.videoTimestampSec != null)
    .sort((a, b) => (a.videoTimestampSec ?? 0) - (b.videoTimestampSec ?? 0));

  // The marker whose timestamp the video is currently at or just past — kept in sync as playback advances.
  const activeMarker = [...markers].reverse().find((m) => (m.videoTimestampSec ?? 0) <= currentTime);

  useEffect(() => {
    if (!activeMarker) return;
    markerRefs.current.get(activeMarker.id)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [activeMarker]);

  if (isLoading || !report) return <p className="p-6">Loading…</p>;

  const { session, team, servingSplits, bySet, players } = report;
  const hasServingData = servingSplits.pointScoring.attempts > 0 || servingSplits.sideOut.attempts > 0;
  const fmtPct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(0)}%`);

  return (
    <div className="p-4 max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-court-dark">
            {session.type === "MATCH" ? `vs ${session.opponent ?? "Opponent"}` : session.type} — Review
          </h1>
          <p className="text-sm text-slate-500">{new Date(session.date).toLocaleString()}</p>
        </div>
        <Link to={`/sessions/${sessionId}/live`} className="tap-target border rounded-lg px-3 py-2 text-sm font-semibold">
          Back to Live Tracking
        </Link>
      </div>

      {session.videoUrl && (
        <div className="bg-white border rounded-xl p-3 flex flex-col gap-3">
          <video
            ref={videoRef}
            controls
            playsInline
            className="w-full max-h-[420px] bg-black rounded-lg"
            src={assetUrl(session.videoUrl)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          />
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
        </div>
      )}

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
