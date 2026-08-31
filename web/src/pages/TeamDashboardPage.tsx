import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../lib/api";
import { useCurrentTeam } from "../lib/team";
import type { Player, TeamWeekly } from "../lib/types";
import { MetricsTable } from "../components/MetricsTable";
import { ShareLinkCard } from "../components/ShareLinkCard";

export function TeamDashboardPage() {
  const { teamId } = useCurrentTeam();
  const [position, setPosition] = useState("");
  const [playerId, setPlayerId] = useState("");

  const { data: players } = useQuery({
    queryKey: ["players", teamId],
    queryFn: () => api.get<Player[]>(`/players?teamId=${teamId}`),
    enabled: !!teamId,
  });

  const positions = useMemo(
    () => [...new Set((players ?? []).map((p) => p.position).filter((p): p is string => !!p))].sort(),
    [players],
  );

  const params = new URLSearchParams();
  if (position) params.set("position", position);
  if (playerId) params.set("playerId", playerId);

  const { data, isLoading } = useQuery({
    queryKey: ["team-weekly", teamId, position, playerId],
    queryFn: () => api.get<TeamWeekly>(`/reports/team/${teamId}/weekly?${params.toString()}`),
    enabled: !!teamId,
  });

  if (!teamId) return <Navigate to="/" replace />;
  if (isLoading || !data) return <p className="p-6">Loading…</p>;

  const { team, weeks } = data;
  const chartData = weeks.map((w) => ({
    week: w.week.replace(/^\d{4}-/, ""),
    Points: w.team.points,
    Errors: w.team.totalErrors,
  }));

  return (
    <div className="p-4 max-w-4xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-court-dark">{team.name} — Team Dashboard</h1>
        <p className="text-sm text-slate-500">Weekly reporting across all logged practices and matches</p>
      </div>

      <ShareLinkCard teamId={teamId} />

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
        {(position || playerId) && (
          <button
            onClick={() => {
              setPosition("");
              setPlayerId("");
            }}
            className="tap-target text-sm text-court underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {weeks.length === 0 ? (
        <p className="text-slate-500">
          {position || playerId
            ? "No stats match this filter yet."
            : "No sessions logged yet — the weekly report builds itself as you track stats."}
        </p>
      ) : (
        <>
          <div className="bg-white border rounded-xl p-4">
            <h2 className="font-semibold text-court-dark mb-3">Points vs Errors by Week</h2>
            <ResponsiveContainer width="100%" height={260}>
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

          <div className="flex flex-col gap-4">
            {[...weeks].reverse().map((w) => (
              <div key={w.week} className="bg-white border rounded-xl p-4">
                <h3 className="font-semibold text-court-dark mb-2">Week {w.week}</h3>
                <MetricsTable
                  rows={[{ label: playerId ? "Player" : position ? `${position}s` : "Team", metrics: w.team }]}
                />
                {!playerId && w.topPerformers.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-sm font-semibold text-slate-500 mb-1">Top Performers</h4>
                    <ul className="text-sm flex flex-col gap-1">
                      {w.topPerformers.map((tp) => (
                        <li key={tp.player.id}>
                          <a href={`/players/${tp.player.id}`} className="underline">
                            {tp.player.jerseyNumber != null ? `#${tp.player.jerseyNumber} ` : ""}
                            {tp.player.firstName} {tp.player.lastName}
                          </a>{" "}
                          — {tp.metrics.points} pts
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
