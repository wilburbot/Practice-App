import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PlayerMetrics, TeamWeekly } from "../lib/types";

type Week = TeamWeekly["weeks"][number];
type ActionKey = "ATTACK" | "SERVE" | "RECEPTION" | "DIG" | "BLOCK" | "SET";

interface Row {
  label: string;
  value: (m: PlayerMetrics) => number | null;
  isPct?: boolean;
}

const ROWS: Row[] = [
  { label: "Kills", value: (m) => m.ATTACK.success },
  { label: "Attack Eff", value: (m) => m.ATTACK.efficiency, isPct: true },
  { label: "Aces", value: (m) => m.SERVE.success },
  { label: "Digs", value: (m) => m.DIG.success },
  { label: "Blocks", value: (m) => m.BLOCK.success },
  { label: "Assists", value: (m) => m.SET.success },
  { label: "Points", value: (m) => m.points },
  { label: "Errors", value: (m) => m.totalErrors },
];

const ALL_WEEKS_KEY = "__all_weeks__";

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

function avgAction(list: Week[], key: ActionKey) {
  const n = list.length || 1;
  const totalAttempts = list.reduce((s, w) => s + w.team[key].attempts, 0);
  const totalSuccess = list.reduce((s, w) => s + w.team[key].success, 0);
  const totalError = list.reduce((s, w) => s + w.team[key].error, 0);
  return {
    attempts: totalAttempts / n,
    success: totalSuccess / n,
    error: totalError / n,
    efficiency: totalAttempts > 0 ? (totalSuccess - totalError) / totalAttempts : null,
  };
}

// Per-week average across every week in `list` (not a sum) so it's on the same scale as a single
// week's bar -- comparing "Week 36" against the total of five weeks combined would be meaningless.
function averageTeamMetrics(list: Week[]): PlayerMetrics {
  const n = list.length || 1;
  const totalPoints = list.reduce((s, w) => s + w.team.points, 0);
  const totalErrors = list.reduce((s, w) => s + w.team.totalErrors, 0);
  const totalAttempts = list.reduce((s, w) => s + w.team.totalAttempts, 0);
  const passRatings = list.map((w) => w.team.avgPassRating).filter((v): v is number => v != null);

  return {
    ATTACK: avgAction(list, "ATTACK"),
    SERVE: avgAction(list, "SERVE"),
    RECEPTION: avgAction(list, "RECEPTION"),
    DIG: avgAction(list, "DIG"),
    BLOCK: avgAction(list, "BLOCK"),
    SET: avgAction(list, "SET"),
    points: totalPoints / n,
    totalErrors: totalErrors / n,
    totalAttempts: totalAttempts / n,
    avgPassRating: passRatings.length ? passRatings.reduce((a, b) => a + b, 0) / passRatings.length : null,
  };
}

interface Bucket {
  key: string;
  label: string;
  team: PlayerMetrics;
}

export function TeamWeekComparisonCard({ weeks, scopeLabel }: { weeks: Week[]; scopeLabel: string }) {
  const [weekAKey, setWeekAKey] = useState<string | null>(null);
  const [weekBKey, setWeekBKey] = useState<string | null | undefined>(undefined); // undefined = default

  if (weeks.length < 2) return null;

  const weekA: Bucket = (() => {
    const found = weekAKey && weeks.find((w) => w.week === weekAKey);
    const w = found || weeks[weeks.length - 1]!;
    return { key: w.week, label: `Week ${w.week}`, team: w.team };
  })();

  const weekB: Bucket | null =
    weekBKey === undefined
      ? (() => {
          const w = weeks[weeks.length - 2]!;
          return { key: w.week, label: `Week ${w.week}`, team: w.team };
        })()
      : weekBKey === null
        ? null
        : weekBKey === ALL_WEEKS_KEY
          ? { key: ALL_WEEKS_KEY, label: `All Weeks (${weeks[0]!.week}–${weeks[weeks.length - 1]!.week} avg)`, team: averageTeamMetrics(weeks) }
          : (() => {
              const w = weeks.find((wk) => wk.week === weekBKey);
              return w ? { key: w.week, label: `Week ${w.week}`, team: w.team } : null;
            })();

  const chartData = ROWS.filter((row) => !row.isPct).map((row) => ({
    stat: row.label,
    [weekA.label]: row.value(weekA.team) ?? 0,
    ...(weekB ? { [weekB.label]: row.value(weekB.team) ?? 0 } : {}),
  }));

  return (
    <div className="bg-white border rounded-xl p-4">
      <h2 className="font-semibold text-court-dark mb-1">Weekly Comparison</h2>
      <p className="text-sm text-slate-500 mb-3">Compare any two weeks, or a week against the season average, for {scopeLabel}.</p>

      <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
        <span className="font-semibold text-slate-500">Compare</span>
        <select
          className="tap-target border rounded-lg px-2 py-1.5"
          value={weekA.key}
          onChange={(e) => setWeekAKey(e.target.value)}
        >
          {[...weeks].reverse().map((w) => (
            <option key={w.week} value={w.week}>
              Week {w.week}
            </option>
          ))}
        </select>
        <span className="text-slate-400">vs</span>
        <select
          className="tap-target border rounded-lg px-2 py-1.5"
          value={weekB?.key ?? ""}
          onChange={(e) => setWeekBKey(e.target.value || null)}
        >
          <option value="">None</option>
          <option value={ALL_WEEKS_KEY}>All Weeks (avg)</option>
          {[...weeks].reverse().map((w) => (
            <option key={w.week} value={w.week}>
              Week {w.week}
            </option>
          ))}
        </select>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="stat" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey={weekA.label} fill="#ea580c" />
          {weekB && <Bar dataKey={weekB.label} fill="#e2e8f0" />}
        </BarChart>
      </ResponsiveContainer>

      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2 pr-3">Stat</th>
              <th className="py-2 px-2 text-right">{weekA.label}</th>
              {weekB && <th className="py-2 pl-2 text-right">vs {weekB.label}</th>}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const current = row.value(weekA.team);
              const previous = weekB ? row.value(weekB.team) : null;
              return (
                <tr key={row.label} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">{row.label}</td>
                  <td className="py-2 px-2 text-right">{fmt(current, row.isPct)}</td>
                  {weekB && (
                    <td className="py-2 pl-2 text-right">
                      <Delta current={current} previous={previous} isPct={row.isPct} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
