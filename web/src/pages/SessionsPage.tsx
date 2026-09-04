import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { useCurrentTeam } from "../lib/team";
import type { Session, SessionType } from "../lib/types";

function sessionLabel(session: Session): string {
  if (session.name) return session.name;
  return session.type === "MATCH" ? `vs ${session.opponent ?? "Opponent"}` : session.type;
}

export function SessionsPage() {
  const { teamId } = useCurrentTeam();
  const queryClient = useQueryClient();
  const [type, setType] = useState<SessionType>("PRACTICE");
  const [opponent, setOpponent] = useState("");
  const [name, setName] = useState("");
  const [date, setDate] = useState("");

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions", teamId],
    queryFn: () => api.get<Session[]>(`/sessions?teamId=${teamId}`),
    enabled: !!teamId,
  });

  const createSession = useMutation({
    mutationFn: () =>
      api.post<Session>("/sessions", {
        teamId,
        type,
        name: name.trim() || null,
        date: date ? new Date(date).toISOString() : undefined,
        opponent: type === "MATCH" ? opponent || null : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions", teamId] });
      setOpponent("");
      setName("");
      setDate("");
    },
  });

  const deleteSession = useMutation({
    mutationFn: (sessionId: string) => api.delete(`/sessions/${sessionId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions", teamId] }),
  });

  if (!teamId) return <Navigate to="/" replace />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    createSession.mutate();
  };

  const onDelete = (session: Session) => {
    if (window.confirm(`Delete "${sessionLabel(session)}"? This removes its stats and video permanently.`)) {
      deleteSession.mutate(session.id);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-court-dark">Sessions</h1>

      <form onSubmit={onSubmit} className="bg-white border rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <select
          className="tap-target border rounded-lg px-3 py-2"
          value={type}
          onChange={(e) => setType(e.target.value as SessionType)}
        >
          <option value="PRACTICE">Practice</option>
          <option value="MATCH">Match</option>
          <option value="SCRIMMAGE">Scrimmage</option>
        </select>
        <input
          className="tap-target border rounded-lg px-3 py-2 flex-1 min-w-[140px]"
          placeholder="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="tap-target border rounded-lg px-3 py-2"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        {type === "MATCH" && (
          <input
            className="tap-target border rounded-lg px-3 py-2 flex-1 min-w-[160px]"
            placeholder="Opponent"
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
          />
        )}
        <button
          type="submit"
          disabled={createSession.isPending}
          className="tap-target bg-court text-white rounded-lg px-4 py-2 font-semibold disabled:opacity-50"
        >
          Start New Session
        </button>
      </form>

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sessions?.map((session) => (
            <div key={session.id} className="bg-white border rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <span className="font-semibold">{sessionLabel(session)}</span>
                {session.name && (
                  <span className="ml-2 text-xs text-slate-400">
                    {session.type === "MATCH" ? `vs ${session.opponent ?? "Opponent"}` : session.type}
                  </span>
                )}
                <span className="block text-sm text-slate-500">
                  {new Date(session.date).toLocaleString()} · {session._count?.statEvents ?? 0} stats logged
                  {!!session._count?.videos && " · video attached"}
                </span>
              </div>
              <div className="flex gap-2">
                <Link
                  to={`/sessions/${session.id}/live`}
                  className="tap-target bg-court text-white rounded-lg px-3 py-2 text-sm font-semibold"
                >
                  Track Live
                </Link>
                <Link
                  to={`/sessions/${session.id}`}
                  className="tap-target border rounded-lg px-3 py-2 text-sm font-semibold"
                >
                  Review
                </Link>
                <button
                  onClick={() => onDelete(session)}
                  className="tap-target text-slate-400 text-sm px-2 hover:text-red-600"
                  aria-label="Delete session"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          {sessions?.length === 0 && <p className="text-slate-500">No sessions yet — start one above.</p>}
        </div>
      )}
    </div>
  );
}
