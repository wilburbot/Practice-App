import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PlayerMetrics } from "../lib/types";

interface Row {
  label: string;
  value: (m: PlayerMetrics) => number | null;
  seasonValue: (overall: PlayerMetrics, weekCount: number) => number | null;
  isPct?: boolean;
}

const ROWS: Row[] = [
  { label: "Kills", value: (m) => m.ATTACK.success, seasonValue: (o, n) => o.ATTACK.success / n },
  { label: "Attack Eff", value: (m) => m.ATTACK.efficiency, seasonValue: (o) => o.ATTACK.efficiency, isPct: true },
  { label: "Aces", value: (m) => m.SERVE.success, seasonValue: (o, n) => o.SERVE.success / n },
  { label: "Passer Rating", value: (m) => m.avgPassRating, seasonValue: (o) => o.avgPassRating },
  { label: "Digs", value: (m) => m.DIG.success, seasonValue: (o, n) => o.DIG.success / n },
  { label: "Blocks", value: (m) => m.BLOCK.success, seasonValue: (o, n) => o.BLOCK.success / n },
  { label: "Assists", value: (m) => m.SET.success, seasonValue: (o, n) => o.SET.success / n },
  { label: "Points", value: (m) => m.points, seasonValue: (o, n) => o.points / n },
];

function fmt(value: number | null, isPct?: boolean): string {
  if (value === null) return "—";
  if (isPct) return `${Math.round(value * 100)}%`;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function Delta({ current, previous, isPct }: { current: number | null; previous: number | null; isPct?: boolean }) {
  if (current === null || previous === null) return <span className="text-slate-300">—</span>;
  const diff = current - previous;
  const rounded = isPct ? Math.round(diff * 100) : Math.round(diff * 10) / 10;
  if (rounded === 0) return <span className="text-slate-400">–</span>;
  const positive = rounded > 0;
  const label = isPct ? `${positive ? "+" : ""}${rounded}%` : `${positive ? "+" : ""}${rounded}`;
  return (
    <span className={positive ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>
      {positive ? "▲" : "▼"} {label}
    </span>
  );
}

export function WeeklyComparisonCard({
  weeks,
  overall,
}: {
  weeks: { week: string; metrics: PlayerMetrics }[];
  overall: PlayerMetrics;
}) {
  if (weeks.length === 0) return null;

  const thisWeek = weeks[weeks.length - 1]!;
  const lastWeek = weeks.length > 1 ? weeks[weeks.length - 2]! : null;

  // Volume stats only — Attack Eff (%) and Passer Rating (0-3) are on different scales and would be
  // unreadable squashed next to counts like Points, so they stay table-only below.
  const chartData = ROWS.filter((row) => !row.isPct && row.label !== "Passer Rating").map((row) => ({
    stat: row.label,
    "This Week": row.value(thisWeek.metrics) ?? 0,
    ...(lastWeek ? { "Last Week": row.value(lastWeek.metrics) ?? 0 } : {}),
    "Season Avg": Math.round((row.seasonValue(overall, weeks.length) ?? 0) * 10) / 10,
  }));

  return (
    <div className="bg-white border rounded-xl p-4">
      <h2 className="font-semibold text-court-dark mb-1">Progress Comparison</h2>
      <p className="text-sm text-slate-500 mb-3">
        Week {thisWeek.week}
        {lastWeek ? ` vs week ${lastWeek.week}, and vs this season's average` : " — track a second week to see week-over-week change"}
      </p>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="stat" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="This Week" fill="#1e3a8a" />
          {lastWeek && <Bar dataKey="Last Week" fill="#94a3b8" />}
          <Bar dataKey="Season Avg" fill="#059669" />
        </BarChart>
      </ResponsiveContainer>

      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2 pr-3">Stat</th>
              <th className="py-2 px-2 text-right">This Week</th>
              {lastWeek && <th className="py-2 px-2 text-right">vs Last Week</th>}
              <th className="py-2 pl-2 text-right">Season Avg</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const current = row.value(thisWeek.metrics);
              const previous = lastWeek ? row.value(lastWeek.metrics) : null;
              const seasonAvg = row.seasonValue(overall, weeks.length);
              return (
                <tr key={row.label} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">{row.label}</td>
                  <td className="py-2 px-2 text-right">{fmt(current, row.isPct)}</td>
                  {lastWeek && (
                    <td className="py-2 px-2 text-right">
                      <Delta current={current} previous={previous} isPct={row.isPct} />
                    </td>
                  )}
                  <td className="py-2 pl-2 text-right text-slate-500">{fmt(seasonAvg, row.isPct)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
