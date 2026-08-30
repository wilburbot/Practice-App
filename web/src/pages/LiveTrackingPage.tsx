import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Player, Session, StatEvent } from "../lib/types";
import { ACTION_GROUPS } from "../lib/actions";
import { useCamera } from "../hooks/useCamera";

export function LiveTrackingPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const camera = useCamera();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");

  const { data: session } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => api.get<Session>(`/sessions/${sessionId}`),
    enabled: !!sessionId,
  });

  const { data: players } = useQuery({
    queryKey: ["players", session?.teamId],
    queryFn: () => api.get<Player[]>(`/players?teamId=${session!.teamId}`),
    enabled: !!session?.teamId,
  });

  const { data: events } = useQuery({
    queryKey: ["stats", sessionId],
    queryFn: () => api.get<StatEvent[]>(`/stats?sessionId=${sessionId}`),
    enabled: !!sessionId,
    refetchInterval: false,
  });

  const logEvent = useMutation({
    mutationFn: (input: { actionType: string; result: string }) =>
      api.post<StatEvent>("/stats", {
        sessionId,
        playerId: selectedPlayerId,
        actionType: input.actionType,
        result: input.result,
        videoTimestampSec: camera.elapsedSeconds(),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stats", sessionId] }),
  });

  const deleteEvent = useMutation({
    mutationFn: (eventId: string) => api.delete(`/stats/${eventId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stats", sessionId] }),
  });

  const uploadVideo = useMutation({
    mutationFn: async ({ blob, durationSec }: { blob: Blob; durationSec: number }) => {
      const form = new FormData();
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      form.append("video", blob, `session-${sessionId}.${ext}`);
      form.append("durationSec", String(durationSec));
      return api.post<Session>(`/sessions/${sessionId}/video`, form);
    },
    onMutate: () => setUploadStatus("uploading"),
    onSuccess: () => {
      setUploadStatus("done");
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    },
    onError: () => setUploadStatus("error"),
  });

  const activePlayers = players?.filter((p) => p.active) ?? [];
  const recentEvents = [...(events ?? [])].reverse().slice(0, 8);

  useEffect(() => {
    if (activePlayers.length && !selectedPlayerId) {
      setSelectedPlayerId(activePlayers[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlayers.length]);

  const onStartCamera = async () => {
    if (videoRef.current) await camera.startPreview(videoRef.current);
  };

  const onStartRecording = () => camera.startRecording();

  const onStopRecording = async () => {
    const result = await camera.stopRecording();
    camera.stopPreview();
    if (result) uploadVideo.mutate(result);
  };

  const findPlayerLabel = (playerId: string) => {
    const p = activePlayers.find((pl) => pl.id === playerId) ?? players?.find((pl) => pl.id === playerId);
    return p ? `${p.jerseyNumber != null ? `#${p.jerseyNumber} ` : ""}${p.firstName} ${p.lastName}` : "—";
  };

  if (!session) return <p className="p-6">Loading session…</p>;

  return (
    <div className="p-4 max-w-6xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-court-dark">
            {session.type === "MATCH" ? `vs ${session.opponent ?? "Opponent"}` : session.type} — Live Tracking
          </h1>
          <p className="text-sm text-slate-500">{new Date(session.date).toLocaleString()}</p>
        </div>
        <Link to={`/sessions/${sessionId}`} className="tap-target border rounded-lg px-3 py-2 text-sm font-semibold">
          Finish & Review
        </Link>
      </div>

      {/* Camera */}
      <div className="bg-white border rounded-xl p-3 flex flex-col gap-2">
        <video ref={videoRef} muted playsInline className="w-full max-h-64 bg-black rounded-lg object-contain" />
        {camera.error && <p className="text-sm text-red-600">{camera.error}</p>}
        <div className="flex gap-2 flex-wrap items-center">
          {!camera.isPreviewing && (
            <button onClick={onStartCamera} className="tap-target border rounded-lg px-3 py-2 text-sm font-semibold">
              Enable Camera
            </button>
          )}
          {camera.isPreviewing && !camera.isRecording && (
            <button
              onClick={onStartRecording}
              className="tap-target bg-red-600 text-white rounded-lg px-3 py-2 text-sm font-semibold"
            >
              ● Start Recording
            </button>
          )}
          {camera.isRecording && (
            <button
              onClick={onStopRecording}
              className="tap-target bg-slate-800 text-white rounded-lg px-3 py-2 text-sm font-semibold"
            >
              ■ Stop & Save Video
            </button>
          )}
          {camera.isRecording && <span className="text-sm text-red-600 font-medium animate-pulse">Recording…</span>}
          {uploadStatus === "uploading" && <span className="text-sm text-slate-500">Uploading video…</span>}
          {uploadStatus === "done" && <span className="text-sm text-emerald-600">Video saved ✓</span>}
          {uploadStatus === "error" && <span className="text-sm text-red-600">Video upload failed</span>}
        </div>
        <p className="text-xs text-slate-400">
          Recording is optional — stats can be logged with or without video. Each tap is timestamped against the
          recording so you can jump straight to the play later.
        </p>
      </div>

      {/* Player selector */}
      <div className="flex flex-wrap gap-2">
        {activePlayers.map((player) => (
          <button
            key={player.id}
            onClick={() => setSelectedPlayerId(player.id)}
            className={`tap-target rounded-full px-4 py-2 border font-semibold ${
              selectedPlayerId === player.id ? "bg-court text-white border-court" : "bg-white"
            }`}
          >
            {player.jerseyNumber != null ? `#${player.jerseyNumber} ` : ""}
            {player.firstName}
          </button>
        ))}
        {activePlayers.length === 0 && (
          <p className="text-slate-500">
            No active players.{" "}
            <Link to="/roster" className="underline">
              Add your roster
            </Link>{" "}
            first.
          </p>
        )}
      </div>

      {/* Action grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ACTION_GROUPS.map((group) => (
          <div key={group.title} className="bg-white border rounded-xl p-3">
            <h3 className="font-semibold text-sm text-slate-500 mb-2">{group.title}</h3>
            <div className="flex flex-wrap gap-2">
              {group.buttons.map((btn) => (
                <button
                  key={btn.label}
                  disabled={!selectedPlayerId || logEvent.isPending}
                  onClick={() => logEvent.mutate(btn)}
                  className={`tap-target ${btn.className} text-white rounded-lg px-4 py-3 font-semibold flex-1 disabled:opacity-40`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Recent events feed */}
      <div className="bg-white border rounded-xl p-3">
        <h3 className="font-semibold text-sm text-slate-500 mb-2">Recent — tap to undo a mis-tap</h3>
        <div className="flex flex-col gap-1">
          {recentEvents.map((event) => (
            <button
              key={event.id}
              onClick={() => deleteEvent.mutate(event.id)}
              className="tap-target flex justify-between items-center text-sm border rounded-lg px-3 py-2 hover:bg-red-50"
            >
              <span>
                {findPlayerLabel(event.playerId)} — {event.actionType} / {event.result}
              </span>
              <span className="text-slate-400 text-xs">✕ remove</span>
            </button>
          ))}
          {recentEvents.length === 0 && <p className="text-slate-400 text-sm">No stats logged yet.</p>}
        </div>
      </div>

      <button onClick={() => navigate(`/sessions/${sessionId}`)} className="tap-target text-sm text-court underline">
        Done for now — go to session review
      </button>
    </div>
  );
}
