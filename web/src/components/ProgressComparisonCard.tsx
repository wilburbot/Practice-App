import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PlayerMetrics, SessionProgressPoint } from "../lib/types";

interface Row {
  label: string;
  value: (m: PlayerMetrics) => number | null;
  seasonValue: (overall: PlayerMetrics, bucketCount: number) => number | null;
  isPct?: boolean;
}

function ratio(success: number, attempts: number): number | null {
  return attempts > 0 ? success / attempts : null;
}

const ROWS: Row[] = [
  { label: "Kills", value: (m) => m.ATTACK.success, seasonValue: (o, n) => o.ATTACK.success / n },
  { label: "Total Att", value: (m) => m.ATTACK.attempts, seasonValue: (o, n) => o.ATTACK.attempts / n },
  { label: "Attack Eff", value: (m) => m.ATTACK.efficiency, seasonValue: (o) => o.ATTACK.efficiency, isPct: true },
  { label: "Aces", value: (m) => m.SERVE.success, seasonValue: (o, n) => o.SERVE.success / n },
  { label: "Rec. Avg", value: (m) => m.avgPassRating, seasonValue: (o) => o.avgPassRating },
  {
    label: "Good Rec %",
    value: (m) => m.goodReceivePct,
    seasonValue: (o) => o.goodReceivePct,
    isPct: true,
  },
  {
    label: "Rec Err %",
    value: (m) => ratio(m.RECEPTION.error, m.RECEPTION.attempts),
    seasonValue: (o) => ratio(o.RECEPTION.error, o.RECEPTION.attempts),
    isPct: true,
  },
  { label: "Total Rec.", value: (m) => m.RECEPTION.attempts, seasonValue: (o, n) => o.RECEPTION.attempts / n },
  { label: "Digs", value: (m) => m.DIG.success, seasonValue: (o, n) => o.DIG.success / n },
  { label: "Blocks", value: (m) => m.BLOCK.success, seasonValue: (o, n) => o.BLOCK.success / n },
  { label: "Assists", value: (m) => m.SET.success, seasonValue: (o, n) => o.SET.success / n },
  { label: "+/-", value: (m) => m.points - m.totalErrors, seasonValue: (o, n) => (o.points - o.totalErrors) / n },
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

interface Bucket {
  key: string;
  label: string;
  metrics: PlayerMetrics;
}

type Mode = "session" | "weekly" | "overall";

function sessionLabel(s: SessionProgressPoint): string {
  const what =
    s.name || (s.type === "MATCH" ? `vs ${s.opponent ?? "Opponent"}` : s.type === "SCRIMMAGE" ? "Scrimmage" : "Practice");
  return `${what} — ${new Date(s.date).toLocaleDateString()}`;
}

export function ProgressComparisonCard({
  weeks,
  sessions,
  overall,
}: {
  weeks: { week: string; metrics: PlayerMetrics }[];
  sessions: SessionProgressPoint[];
  overall: PlayerMetrics;
}) {
  const [mode, setMode] = useState<Mode>("weekly");
  const [keyA, setKeyA] = useState<string | null>(null);
  const [keyB, setKeyB] = useState<string | null | undefined>(undefined); // undefined = use default

  // Stale picks from a different granularity shouldn't carry over when switching tabs.
  useEffect(() => {
    setKeyA(null);
    setKeyB(undefined);
  }, [mode]);

  if (weeks.length === 0 && sessions.length === 0) return null;

  const buckets: Bucket[] =
    mode === "weekly"
      ? weeks.map((w) => ({ key: w.week, label: `Week ${w.week}`, metrics: w.metrics }))
      : mode === "session"
        ? sessions.map((s) => ({ key: s.sessionId, label: sessionLabel(s), metrics: s.metrics }))
        : [];

  const unit = mode === "weekly" ? "week" : "session";
  const avgLabel = mode === "weekly" ? "Per-Week Avg" : "Per-Session Avg";

  const modeTabs: { id: Mode; label: string }[] = [
    { id: "session", label: "By Session" },
    { id: "weekly", label: "By Week" },
    { id: "overall", label: "Overall" },
  ];

  const ModeSwitcher = (
    <div className="flex gap-1 mb-3">
      {modeTabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setMode(tab.id)}
          className={`tap-target text-xs px-3 py-1.5 rounded-full border font-semibold ${
            mode === tab.id ? "bg-court text-white border-court" : "bg-white"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  if (mode === "overall") {
    const chartData = ROWS.filter((row) => !row.isPct && row.label !== "Rec. Avg").map((row) => ({
      stat: row.label,
      "Career Total": row.value(overall) ?? 0,
    }));

    return (
      <div className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold text-court-dark mb-1">Progress Comparison</h2>
        <p className="text-sm text-slate-500 mb-3">Career totals across every logged session.</p>
        {ModeSwitcher}
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="stat" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="Career Total" fill="#ea580c" />
          </BarChart>
        </ResponsiveContainer>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 pr-3">Stat</th>
                <th className="py-2 pl-2 text-right">Career Total</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">{row.label}</td>
                  <td className="py-2 pl-2 text-right">{fmt(row.value(overall), row.isPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (buckets.length === 0) {
    return (
      <div className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold text-court-dark mb-1">Progress Comparison</h2>
        {ModeSwitcher}
        <p className="text-sm text-slate-400">No {unit}s logged yet.</p>
      </div>
    );
  }

  // Defaults: most recent bucket vs the one before it — same behavior as before pickers existed.
  const bucketA = (keyA && buckets.find((b) => b.key === keyA)) || buckets[buckets.length - 1]!;
  const bucketB =
    keyB === undefined
      ? buckets.length > 1
        ? buckets[buckets.length - 2]!
        : null
      : keyB === null
        ? null
        : buckets.find((b) => b.key === keyB) ?? null;

  // Volume stats only — Attack Eff (%) and Rec. Avg (0-3) are on different scales and would be
  // unreadable squashed next to counts like Points, so they stay table-only below.
  const chartData = ROWS.filter((row) => !row.isPct && row.label !== "Rec. Avg").map((row) => ({
    stat: row.label,
    [bucketA.label]: row.value(bucketA.metrics) ?? 0,
    ...(bucketB ? { [bucketB.label]: row.value(bucketB.metrics) ?? 0 } : {}),
    [avgLabel]: Math.round((row.seasonValue(overall, buckets.length) ?? 0) * 10) / 10,
  }));

  return (
    <div className="bg-white border rounded-xl p-4">
      <h2 className="font-semibold text-court-dark mb-1">Progress Comparison</h2>
      <p className="text-sm text-slate-500 mb-3">
        Pick any two {unit}s to compare, plus the {avgLabel.toLowerCase()}.
      </p>
      {ModeSwitcher}

      {buckets.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
          <span className="font-semibold text-slate-500">Compare</span>
          <select
            className="tap-target border rounded-lg px-2 py-1.5"
            value={bucketA.key}
            onChange={(e) => setKeyA(e.target.value)}
          >
            {[...buckets].reverse().map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </select>
          <span className="text-slate-400">vs</span>
          <select
            className="tap-target border rounded-lg px-2 py-1.5"
            value={bucketB?.key ?? ""}
            onChange={(e) => setKeyB(e.target.value || null)}
          >
            <option value="">None ({avgLabel.toLowerCase()} only)</option>
            {[...buckets].reverse().map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="stat" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey={bucketA.label} fill="#ea580c" />
          {bucketB && <Bar dataKey={bucketB.label} fill="#e2e8f0" />}
          <Bar dataKey={avgLabel} fill="#475569" />
        </BarChart>
      </ResponsiveContainer>

      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2 pr-3">Stat</th>
              <th className="py-2 px-2 text-right">{bucketA.label}</th>
              {bucketB && <th className="py-2 px-2 text-right">vs {bucketB.label}</th>}
              <th className="py-2 pl-2 text-right">{avgLabel}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const current = row.value(bucketA.metrics);
              const previous = bucketB ? row.value(bucketB.metrics) : null;
              const seasonAvg = row.seasonValue(overall, buckets.length);
              return (
                <tr key={row.label} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">{row.label}</td>
                  <td className="py-2 px-2 text-right">{fmt(current, row.isPct)}</td>
                  {bucketB && (
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
