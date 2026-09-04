import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import type { Player, Session, TeamSkillBreakdown } from "../../lib/types";
import { SkillDashboard } from "../../components/SkillDashboard";

function sessionOptionLabel(session: Session): string {
  const what = session.name || (session.type === "MATCH" ? `vs ${session.opponent ?? "Opponent"}` : session.type);
  return `${what} — ${new Date(session.date).toLocaleDateString()}`;
}

export function PublicSkillsPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [position, setPosition] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [sessionId, setSessionId] = useState("");

  const { data: players } = useQuery({
    queryKey: ["public-players", shareToken],
    queryFn: () => api.get<Player[]>(`/public/${shareToken}/players`),
    enabled: !!shareToken,
  });

  const { data: sessions } = useQuery({
    queryKey: ["public-sessions", shareToken],
    queryFn: () => api.get<Session[]>(`/public/${shareToken}/sessions`),
    enabled: !!shareToken,
  });

  const positions = useMemo(
    () => [...new Set((players ?? []).map((p) => p.position).filter((p): p is string => !!p))].sort(),
    [players],
  );

  const params = new URLSearchParams();
  if (position) params.set("position", position);
  if (playerId) params.set("playerId", playerId);
  if (sessionId) params.set("sessionId", sessionId);

  const { data, isLoading } = useQuery({
    queryKey: ["public-skills", shareToken, position, playerId, sessionId],
    queryFn: () => api.get<TeamSkillBreakdown>(`/public/${shareToken}/skills?${params.toString()}`),
    enabled: !!shareToken,
  });

  if (isLoading || !data) return <p className="p-6">Loading…</p>;

  return (
    <div className="p-4 max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Skill Breakdown</h1>
          <p className="text-sm text-slate-500">Result distribution and top performers for each skill, all season</p>
        </div>
        <Link to={`/share/${shareToken}`} className="tap-target border rounded-lg px-3 py-2 text-sm font-semibold">
          ← All Sessions
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-slate-500">Position</span>
          <select
            className="tap-target border rounded-lg px-3 py-2"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          >
            <option value="">All positions</option>
            {positions.map((pos) => (
              <option key={pos} value={pos}>
                {pos}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-slate-500">Player</span>
          <select
            className="tap-target border rounded-lg px-3 py-2"
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
          >
            <option value="">All players</option>
            {(players ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.jerseyNumber != null ? `#${p.jerseyNumber} ` : ""}
                {p.firstName} {p.lastName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-slate-500">Session</span>
          <select
            className="tap-target border rounded-lg px-3 py-2"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
          >
            <option value="">All season</option>
            {[...(sessions ?? [])]
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {sessionOptionLabel(s)}
                </option>
              ))}
          </select>
        </label>
      </div>

      <SkillDashboard skills={data.skills} />
    </div>
  );
}
