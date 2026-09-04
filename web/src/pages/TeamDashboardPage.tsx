import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useCurrentTeam } from "../lib/team";
import type { Player, PlayerProgress, TeamWeekly } from "../lib/types";
import { MetricsTable } from "../components/MetricsTable";
import { ShareLinkCard } from "../components/ShareLinkCard";
import { InviteCoachCard } from "../components/InviteCoachCard";
import { TeamMembersCard } from "../components/TeamMembersCard";
import { AskTeamCard } from "../components/AskTeamCard";
import { HighlightReelCard } from "../components/HighlightReelCard";
import { TeamWeekComparisonCard } from "../components/TeamWeekComparisonCard";

function sessionLabel(name: string | null, type: string, opponent: string | null): string {
  return name || (type === "MATCH" ? `vs ${opponent ?? "Opponent"}` : type);
}

export function TeamDashboardPage() {
  const { teamId } = useCurrentTeam();
  const { user } = useAuth();
  const [position, setPosition] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

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

  const { data: playerProgress } = useQuery({
    queryKey: ["player-progress", playerId],
    queryFn: () => api.get<PlayerProgress>(`/reports/player/${playerId}/progress`),
    enabled: !!playerId,
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

      <TeamMembersCard teamId={teamId} isOwner={team.ownerId === user?.id} />

      {team.ownerId === user?.id && <InviteCoachCard teamId={teamId} />}

      <AskTeamCard teamId={teamId} />

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

      {playerId && playerProgress && <HighlightReelCard clips={playerProgress.clips} />}

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

          <TeamWeekComparisonCard
            weeks={weeks}
            scopeLabel={playerId ? "this player" : position ? `${position}s` : "the team"}
          />

          <div className="flex flex-col gap-4">
            {[...weeks].reverse().map((w) => {
              const isOpen = expandedWeek === w.week;
              return (
                <div key={w.week} className="bg-white border rounded-xl p-4">
                  <button
                    onClick={() => setExpandedWeek(isOpen ? null : w.week)}
                    className="tap-target w-full flex items-center justify-between text-left"
                  >
                    <h3 className="font-semibold text-court-dark">
                      Week {w.week} <span className="text-sm font-normal text-slate-400">({w.sessions.length} session{w.sessions.length === 1 ? "" : "s"})</span>
                    </h3>
                    <span className="text-sm text-court">{isOpen ? "Hide details ▲" : "Full details ▼"}</span>
                  </button>
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

                  {isOpen && (
                    <div className="mt-4 pt-4 border-t flex flex-col gap-4">
                      {!playerId && w.players.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-slate-500 mb-1">Every Player This Week</h4>
                          <MetricsTable
                            rows={w.players.map((p) => ({
                              label: `${p.player.jerseyNumber != null ? `#${p.player.jerseyNumber} ` : ""}${p.player.firstName} ${p.player.lastName}`,
                              metrics: p.metrics,
                              href: `/players/${p.player.id}`,
                            }))}
                          />
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-semibold text-slate-500 mb-1">Sessions</h4>
                        <ul className="text-sm flex flex-col gap-1">
                          {w.sessions.map((s) => (
                            <li key={s.sessionId}>
                              <a href={`/sessions/${s.sessionId}`} className="underline">
                                {sessionLabel(s.name, s.type, s.opponent)}
                              </a>{" "}
                              <span className="text-slate-400">— {new Date(s.date).toLocaleDateString()}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
