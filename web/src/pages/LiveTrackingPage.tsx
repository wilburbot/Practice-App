import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { uploadVideoChunked } from "../lib/uploadVideo";
import type { Player, ServingTeam, Session, StatEvent } from "../lib/types";
import { ACTION_GROUPS, type ActionButton } from "../lib/actions";
import { useCamera } from "../hooks/useCamera";
import { CourtTargetPicker } from "../components/CourtTargetPicker";

export function LiveTrackingPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const camera = useCamera();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  // Kept around so a failed upload can be retried without re-recording.
  const pendingUploadRef = useRef<{ blob: Blob; durationSec: number } | null>(null);
  const [currentSet, setCurrentSet] = useState(1);
  const [servingTeam, setServingTeam] = useState<ServingTeam>("OWN");
  const [pickerEventId, setPickerEventId] = useState<string | null>(null);
  // Clip id this device started recording, captured up front since /recording/stop clears
  // session.activeVideoClipId server-side before the upload FormData is built.
  const [localClipId, setLocalClipId] = useState<string | null>(null);

  const { data: session } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => api.get<Session>(`/sessions/${sessionId}`),
    enabled: !!sessionId,
    // Polls so every coach's device picks up activeVideoStartedAt as soon as whoever is holding
    // the camera starts/stops recording, keeping everyone's stat taps synced to the same video clock.
    refetchInterval: 3000,
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
    // Polls while this screen is open so a second coach tracking the same session on another
    // device shows up here within a few seconds, without needing a full realtime/websocket setup.
    refetchInterval: 3000,
  });

  // Shared clock: every coach's device computes the video timestamp from the session's
  // server-recorded start time, not local camera state — so taps stay in sync with the one
  // video even when logged from a device that isn't the one actually recording.
  const videoTimestampSec = session?.activeVideoStartedAt
    ? (Date.now() - new Date(session.activeVideoStartedAt).getTime()) / 1000
    : null;

  const logEvent = useMutation({
    mutationFn: (input: ActionButton) =>
      api.post<StatEvent>("/stats", {
        sessionId,
        playerId: selectedPlayerId,
        actionType: input.actionType,
        result: input.result,
        passRating: input.passRating ?? null,
        servingTeam: session?.type === "MATCH" ? servingTeam : null,
        setNumber: session?.type === "MATCH" ? currentSet : null,
        videoTimestampSec,
        videoClipId: session?.activeVideoClipId ?? null,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stats", sessionId] }),
  });

  const deleteEvent = useMutation({
    mutationFn: (eventId: string) => api.delete(`/stats/${eventId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stats", sessionId] }),
  });

  const setTarget = useMutation({
    mutationFn: ({ eventId, x, y }: { eventId: string; x: number; y: number }) =>
      api.patch(`/stats/${eventId}/target`, { targetX: x, targetY: y }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stats", sessionId] });
      setPickerEventId(null);
    },
  });

  const uploadVideo = useMutation({
    mutationFn: async ({ blob, durationSec }: { blob: Blob; durationSec: number }) => {
      if (!localClipId) throw new Error("No active recording clip to attach this video to");
      pendingUploadRef.current = { blob, durationSec };
      setUploadProgress(0);
      return uploadVideoChunked({
        sessionId: sessionId!,
        blob,
        durationSec,
        clipId: localClipId,
        onProgress: setUploadProgress,
      });
    },
    onMutate: () => setUploadStatus("uploading"),
    onSuccess: () => {
      setUploadStatus("done");
      setLocalClipId(null);
      pendingUploadRef.current = null;
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    },
    onError: () => setUploadStatus("error"),
  });

  const onRetryUpload = () => {
    if (pendingUploadRef.current) uploadVideo.mutate(pendingUploadRef.current);
  };

  const markRecordingStarted = useMutation({
    mutationFn: () => api.post<Session>(`/sessions/${sessionId}/recording/start`),
    onSuccess: (updated) => {
      queryClient.setQueryData(["session", sessionId], updated);
      setLocalClipId(updated.activeVideoClipId);
    },
  });

  const markRecordingStopped = useMutation({
    mutationFn: () => api.post<Session>(`/sessions/${sessionId}/recording/stop`),
    onSuccess: (updated) => queryClient.setQueryData(["session", sessionId], updated),
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

  const onStartRecording = () => {
    camera.startRecording();
    markRecordingStarted.mutate();
  };

  const onStopRecording = async () => {
    const result = await camera.stopRecording();
    camera.stopPreview();
    markRecordingStopped.mutate();
    if (result) uploadVideo.mutate(result);
  };

  // True when a DIFFERENT device has the camera going — hide this device's camera controls so
  // two coaches can't both hit "Start Recording" and clobber each other's video reference point.
  const recordingElsewhere = !!session?.activeVideoClipId && !camera.isRecording;

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
        {recordingElsewhere ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-slate-600">
              🔴 Another device is recording this session
              {session.activeVideoStartedAt &&
                ` (started ${new Date(session.activeVideoStartedAt).toLocaleTimeString()})`}
              . Your stat taps sync automatically to that video. Only one device can hold the camera at a time.
            </p>
            <button
              onClick={() => markRecordingStopped.mutate()}
              disabled={markRecordingStopped.isPending}
              className="tap-target self-start border rounded-lg px-3 py-2 text-sm font-semibold text-slate-600"
            >
              {markRecordingStopped.isPending ? "Releasing…" : "Recording already stopped? Tap here to free up the camera"}
            </button>
          </div>
        ) : (
          <>
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
              {uploadStatus === "uploading" && (
                <span className="text-sm text-slate-500">Uploading video… {Math.round(uploadProgress * 100)}%</span>
              )}
              {uploadStatus === "done" && <span className="text-sm text-emerald-600">Video saved ✓</span>}
              {uploadStatus === "error" && (
                <span className="text-sm text-red-600 flex items-center gap-2">
                  Video upload failed
                  <button onClick={onRetryUpload} className="tap-target underline">
                    Retry
                  </button>
                </span>
              )}
            </div>
            {uploadStatus === "uploading" && (
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-court transition-[width]"
                  style={{ width: `${Math.round(uploadProgress * 100)}%` }}
                />
              </div>
            )}
            <p className="text-xs text-slate-400">
              Recording is optional — stats can be logged with or without video. Each tap is timestamped against
              the recording so you can jump straight to the play later. If other coaches are tracking this same
              session on their own devices, their taps sync to this video too.
            </p>
          </>
        )}
      </div>

      {/* Set + serving toggle (matches only) */}
      {session.type === "MATCH" && (
        <div className="bg-white border rounded-xl p-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-500">Set</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setCurrentSet(n)}
                className={`tap-target rounded-full w-10 h-10 font-semibold border ${
                  currentSet === n ? "bg-court text-white border-court" : "bg-white"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-500">Serving</span>
            <button
              onClick={() => setServingTeam("OWN")}
              className={`tap-target rounded-lg px-3 py-2 text-sm font-semibold border ${
                servingTeam === "OWN" ? "bg-court text-white border-court" : "bg-white"
              }`}
            >
              We're Serving
            </button>
            <button
              onClick={() => setServingTeam("OPPONENT")}
              className={`tap-target rounded-lg px-3 py-2 text-sm font-semibold border ${
                servingTeam === "OPPONENT" ? "bg-court text-white border-court" : "bg-white"
              }`}
            >
              They're Serving
            </button>
          </div>
          <p className="text-xs text-slate-400 w-full">
            Flip this every time the serve changes hands — it's what powers point-scoring % and side-out %.
          </p>
        </div>
      )}

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
        <h3 className="font-semibold text-sm text-slate-500 mb-2">
          Recent — tap an attack/serve to tag where it landed, or ✕ to undo
        </h3>
        <div className="flex flex-col gap-1">
          {recentEvents.map((event) => {
            const canTagLocation = event.actionType === "ATTACK" || event.actionType === "SERVE";
            return (
              <div key={event.id}>
                <div className="flex items-center justify-between text-sm border rounded-lg px-1 py-1">
                  <button
                    onClick={() => canTagLocation && setPickerEventId(pickerEventId === event.id ? null : event.id)}
                    disabled={!canTagLocation}
                    className="tap-target flex-1 text-left px-2 py-1 rounded-lg disabled:cursor-default hover:enabled:bg-slate-50"
                  >
                    {findPlayerLabel(event.playerId)} — {event.actionType} / {event.result}
                    {event.passRating != null && ` (pass ${event.passRating})`}
                    {event.targetX != null && " 📍"}
                  </button>
                  <button
                    onClick={() => deleteEvent.mutate(event.id)}
                    className="tap-target text-slate-400 text-xs px-2 py-1 hover:text-red-600"
                  >
                    ✕ undo
                  </button>
                </div>
                {pickerEventId === event.id && (
                  <CourtTargetPicker
                    onPick={(x, y) => setTarget.mutate({ eventId: event.id, x, y })}
                    onCancel={() => setPickerEventId(null)}
                  />
                )}
              </div>
            );
          })}
          {recentEvents.length === 0 && <p className="text-slate-400 text-sm">No stats logged yet.</p>}
        </div>
      </div>

      <button onClick={() => navigate(`/sessions/${sessionId}`)} className="tap-target text-sm text-court underline">
        Done for now — go to session review
      </button>
    </div>
  );
}
