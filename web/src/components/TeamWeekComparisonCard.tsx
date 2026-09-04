import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PlayerMetrics, TeamWeekly } from "../lib/types";

type Week = TeamWeekly["weeks"][number];

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

export function TeamWeekComparisonCard({ weeks, scopeLabel }: { weeks: Week[]; scopeLabel: string }) {
  const [weekAKey, setWeekAKey] = useState<string | null>(null);
  const [weekBKey, setWeekBKey] = useState<string | null | undefined>(undefined); // undefined = default

  if (weeks.length < 2) return null;

  const weekA = (weekAKey && weeks.find((w) => w.week === weekAKey)) || weeks[weeks.length - 1]!;
  const weekB =
    weekBKey === undefined
      ? weeks[weeks.length - 2]!
      : weekBKey === null
        ? null
        : weeks.find((w) => w.week === weekBKey) ?? null;

  const chartData = ROWS.filter((row) => !row.isPct).map((row) => ({
    stat: row.label,
    [`Week ${weekA.week}`]: row.value(weekA.team) ?? 0,
    ...(weekB ? { [`Week ${weekB.week}`]: row.value(weekB.team) ?? 0 } : {}),
  }));

  return (
    <div className="bg-white border rounded-xl p-4">
      <h2 className="font-semibold text-court-dark mb-1">Weekly Comparison</h2>
      <p className="text-sm text-slate-500 mb-3">Compare any two weeks for {scopeLabel}.</p>

      <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
        <span className="font-semibold text-slate-500">Compare</span>
        <select
          className="tap-target border rounded-lg px-2 py-1.5"
          value={weekA.week}
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
          value={weekB?.week ?? ""}
          onChange={(e) => setWeekBKey(e.target.value || null)}
        >
          <option value="">None</option>
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
          <Bar dataKey={`Week ${weekA.week}`} fill="#ea580c" />
          {weekB && <Bar dataKey={`Week ${weekB.week}`} fill="#e2e8f0" />}
        </BarChart>
      </ResponsiveContainer>

      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2 pr-3">Stat</th>
              <th className="py-2 px-2 text-right">Week {weekA.week}</th>
              {weekB && <th className="py-2 pl-2 text-right">vs Week {weekB.week}</th>}
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
