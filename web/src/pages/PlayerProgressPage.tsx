import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../lib/api";
import type { PlayerProgress } from "../lib/types";
import { MetricsTable } from "../components/MetricsTable";
import { ProgressComparisonCard } from "../components/ProgressComparisonCard";
import { CourtTendencyChart } from "../components/CourtTendencyChart";
import { HighlightReelCard } from "../components/HighlightReelCard";

export function PlayerProgressPage() {
  const { playerId } = useParams<{ playerId: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["player-progress", playerId],
    queryFn: () => api.get<PlayerProgress>(`/reports/player/${playerId}/progress`),
    enabled: !!playerId,
  });

  if (isLoading || !data) return <p className="p-6">Loading…</p>;

  const { player, overall, weeks, sessions, tendencies, clips } = data;

  const chartData = weeks.map((w) => ({
    week: w.week.replace(/^\d{4}-/, ""),
    Kills: w.metrics.ATTACK.success,
    Digs: w.metrics.DIG.success,
    Blocks: w.metrics.BLOCK.success,
    Assists: w.metrics.SET.success,
    Aces: w.metrics.SERVE.success,
    Points: w.metrics.points,
    "Attack Eff %": w.metrics.ATTACK.efficiency != null ? Math.round(w.metrics.ATTACK.efficiency * 100) : null,
  }));

  return (
    <div className="p-4 max-w-4xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-court-dark">
          {player.jerseyNumber != null ? `#${player.jerseyNumber} ` : ""}
          {player.firstName} {player.lastName}
        </h1>
        <p className="text-sm text-slate-500">{player.position}</p>
      </div>

      <div className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold text-court-dark mb-3">Career Totals</h2>
        <MetricsTable rows={[{ label: "All-time", metrics: overall }]} />
      </div>

      <HighlightReelCard clips={clips} />

      <ProgressComparisonCard weeks={weeks} sessions={sessions} overall={overall} />

      <CourtTendencyChart tendencies={tendencies} />

      {weeks.length > 0 ? (
        <>
          <div className="bg-white border rounded-xl p-4">
            <h2 className="font-semibold text-court-dark mb-3">Weekly Progression — Volume</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Kills" stroke="#059669" strokeWidth={2} />
                <Line type="monotone" dataKey="Digs" stroke="#2563eb" strokeWidth={2} />
                <Line type="monotone" dataKey="Blocks" stroke="#7c3aed" strokeWidth={2} />
                <Line type="monotone" dataKey="Assists" stroke="#d97706" strokeWidth={2} />
                <Line type="monotone" dataKey="Aces" stroke="#db2777" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border rounded-xl p-4">
            <h2 className="font-semibold text-court-dark mb-3">Attack Efficiency Trend</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis unit="%" />
                <Tooltip />
                <Line type="monotone" dataKey="Attack Eff %" stroke="#ea580c" strokeWidth={2} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <p className="text-slate-500">No sessions logged yet — progress charts will appear here once stats are tracked.</p>
      )}
    </div>
  );
}
