import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../../lib/api";
import type { Player, Session, TeamWeekly } from "../../lib/types";
import { MetricsTable } from "../../components/MetricsTable";

export function PublicTeamPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [position, setPosition] = useState("");
  const [playerId, setPlayerId] = useState("");

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

  const { data: weekly } = useQuery({
    queryKey: ["public-weekly", shareToken, position, playerId],
    queryFn: () => api.get<TeamWeekly>(`/public/${shareToken}/weekly?${params.toString()}`),
    enabled: !!shareToken,
  });

  const weeks = weekly?.weeks ?? [];
  const chartData = weeks.map((w) => ({
    week: w.week.replace(/^\d{4}-/, ""),
    Points: w.team.points,
    Errors: w.team.totalErrors,
  }));

  return (
    <div className="p-4 max-w-4xl mx-auto flex flex-col gap-6">
      <div className="bg-white border rounded-xl p-4 flex flex-wrap gap-3 items-center">
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
      </div>

      {weeks.length > 0 && (
        <div className="bg-white border rounded-xl p-4">
          <h2 className="font-semibold text-court-dark mb-3">Points vs Errors by Week</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Points" fill="#059669" />
              <Bar dataKey="Errors" fill="#dc2626" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {[...weeks].reverse().map((w) => (
        <div key={w.week} className="bg-white border rounded-xl p-4">
          <h3 className="font-semibold text-court-dark mb-2">Week {w.week}</h3>
          <MetricsTable rows={[{ label: playerId ? "Player" : position ? `${position}s` : "Team", metrics: w.team }]} />
        </div>
      ))}

      <div className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold text-court-dark mb-3">Sessions</h2>
        <div className="flex flex-col gap-2">
          {sessions?.map((session) => (
            <Link
              key={session.id}
              to={`/share/${shareToken}/sessions/${session.id}`}
              className="tap-target border rounded-lg px-4 py-3 flex items-center justify-between"
            >
              <div>
                <span className="font-semibold">
                  {session.type === "MATCH" ? `vs ${session.opponent ?? "Opponent"}` : session.type}
                </span>
                <span className="block text-sm text-slate-500">
                  {new Date(session.date).toLocaleString()} · {session._count?.statEvents ?? 0} stats logged
                  {session.videoUrl && " · video available"}
                </span>
              </div>
              <span className="text-court text-sm font-semibold">View →</span>
            </Link>
          ))}
          {sessions?.length === 0 && <p className="text-slate-500">No sessions logged yet.</p>}
        </div>
      </div>
    </div>
  );
}
