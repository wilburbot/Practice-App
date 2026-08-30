import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, assetUrl } from "../lib/api";
import type { SessionReport, StatEvent } from "../lib/types";
import { MetricsTable } from "../components/MetricsTable";

export function SessionReviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);

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

  if (isLoading || !report) return <p className="p-6">Loading…</p>;

  const { session, team, players } = report;
  const markers = (events ?? []).filter((e) => e.videoTimestampSec != null);

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
          <video ref={videoRef} controls playsInline className="w-full max-h-[420px] bg-black rounded-lg" src={assetUrl(session.videoUrl)} />
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {markers.map((event) => (
              <button
                key={event.id}
                onClick={() => seekTo(event)}
                className="tap-target text-xs border rounded-full px-3 py-1 hover:bg-court hover:text-white"
              >
                {Math.floor((event.videoTimestampSec ?? 0) / 60)}:
                {String(Math.floor((event.videoTimestampSec ?? 0) % 60)).padStart(2, "0")} — {event.actionType}/
                {event.result}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold text-court-dark mb-3">Team Totals</h2>
        <MetricsTable rows={[{ label: session.type === "MATCH" ? "Team (match)" : "Team (practice)", metrics: team }]} />
      </div>

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
