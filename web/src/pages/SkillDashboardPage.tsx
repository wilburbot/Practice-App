import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { useCurrentTeam } from "../lib/team";
import type { Player, TeamSkillBreakdown } from "../lib/types";
import { SkillDashboard } from "../components/SkillDashboard";

export function SkillDashboardPage() {
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
    queryKey: ["team-skills", teamId, position, playerId],
    queryFn: () => api.get<TeamSkillBreakdown>(`/reports/team/${teamId}/skills?${params.toString()}`),
    enabled: !!teamId,
  });

  if (!teamId) return <Navigate to="/" replace />;
  if (isLoading || !data) return <p className="p-6">Loading…</p>;

  return (
    <div className="p-4 max-w-5xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Skill Breakdown</h1>
        <p className="text-sm text-slate-500">Result distribution and top performers for each skill, all season</p>
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

      <SkillDashboard skills={data.skills} />
    </div>
  );
}
