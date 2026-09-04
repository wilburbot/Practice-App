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

function avgAction(list: Week[], key: ActionKey, divisor: number) {
  const totalAttempts = list.reduce((s, w) => s + w.team[key].attempts, 0);
  const totalSuccess = list.reduce((s, w) => s + w.team[key].success, 0);
  const totalError = list.reduce((s, w) => s + w.team[key].error, 0);
  return {
    attempts: totalAttempts / divisor,
    success: totalSuccess / divisor,
    error: totalError / divisor,
    // Efficiency is a ratio, so it's identical whether every term is divided by 1 (sum) or n (avg).
    efficiency: totalAttempts > 0 ? (totalSuccess - totalError) / totalAttempts : null,
  };
}

// divisor=1 gives the combined total across `list`; divisor=list.length gives the per-week average.
function combineTeamMetrics(list: Week[], divisor: number): PlayerMetrics {
  const totalPoints = list.reduce((s, w) => s + w.team.points, 0);
  const totalErrors = list.reduce((s, w) => s + w.team.totalErrors, 0);
  const totalAttempts = list.reduce((s, w) => s + w.team.totalAttempts, 0);
  const passRatings = list.map((w) => w.team.avgPassRating).filter((v): v is number => v != null);

  return {
    ATTACK: avgAction(list, "ATTACK", divisor),
    SERVE: avgAction(list, "SERVE", divisor),
    RECEPTION: avgAction(list, "RECEPTION", divisor),
    DIG: avgAction(list, "DIG", divisor),
    BLOCK: avgAction(list, "BLOCK", divisor),
    SET: avgAction(list, "SET", divisor),
    points: totalPoints / divisor,
    totalErrors: totalErrors / divisor,
    totalAttempts: totalAttempts / divisor,
    avgPassRating: passRatings.length ? passRatings.reduce((a, b) => a + b, 0) / passRatings.length : null,
  };
}

// Only two modes: "All Weeks" or "Choose Weeks" -- a single week is just a one-box checklist pick.
type SlotMode = "all" | "custom";

interface SlotState {
  mode: SlotMode;
  customWeeks: string[];
}

interface Bucket {
  label: string;
  weeks: Week[];
  sum: PlayerMetrics;
  avg: PlayerMetrics;
}

function resolveSlot(sel: SlotState, allWeeks: Week[]): Bucket | null {
  const list = sel.mode === "all" ? allWeeks : allWeeks.filter((w) => sel.customWeeks.includes(w.week));
  if (list.length === 0) return null;

  const label =
    sel.mode === "all"
      ? `All Weeks (${allWeeks[0]!.week}–${allWeeks[allWeeks.length - 1]!.week})`
      : list.length === 1
        ? `Week ${list[0]!.week}`
        : `${list.length} Weeks (${list.map((w) => w.week).join(", ")})`;

  return { label, weeks: list, sum: combineTeamMetrics(list, 1), avg: combineTeamMetrics(list, list.length) };
}

function WeekChecklist({
  weeks,
  selected,
  onChange,
}: {
  weeks: Week[];
  selected: string[];
  onChange: (weeks: string[]) => void;
}) {
  return (
    <div className="border rounded-lg p-2 max-h-36 overflow-y-auto grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
      {[...weeks].reverse().map((w) => (
        <label key={w.week} className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={selected.includes(w.week)}
            onChange={(e) =>
              onChange(e.target.checked ? [...selected, w.week] : selected.filter((k) => k !== w.week))
            }
          />
          Week {w.week}
        </label>
      ))}
    </div>
  );
}

function SlotControl({
  weeks,
  slot,
  setSlot,
}: {
  weeks: Week[];
  slot: SlotState;
  setSlot: (next: SlotState) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <select
        className="tap-target border rounded-lg px-2 py-1.5 text-sm"
        value={slot.mode}
        onChange={(e) => setSlot({ ...slot, mode: e.target.value as SlotMode })}
      >
        <option value="all">All Weeks</option>
        <option value="custom">Choose Weeks…</option>
      </select>
      {slot.mode === "custom" && (
        <WeekChecklist
          weeks={weeks}
          selected={slot.customWeeks}
          onChange={(customWeeks) => setSlot({ ...slot, customWeeks })}
        />
      )}
    </div>
  );
}

// A single stat's centered tile when there's no B to compare against (just "All Weeks" for A).
function StatTile({ row, bucket }: { row: Row; bucket: Bucket }) {
  const isMulti = bucket.weeks.length > 1;
  return (
    <div className="text-center">
      <p className="text-xs font-semibold text-slate-500">{row.label}</p>
      <p className="text-lg font-bold text-court-dark">{fmt(row.value(isMulti ? bucket.sum : bucket.avg), row.isPct)}</p>
      {isMulti && <p className="text-xs text-slate-400">avg {fmt(row.value(bucket.avg), row.isPct)}</p>}
    </div>
  );
}

export function TeamWeekComparisonCard({ weeks, scopeLabel }: { weeks: Week[]; scopeLabel: string }) {
  const latest = weeks[weeks.length - 1]?.week ?? null;
  const previous = weeks.length > 1 ? weeks[weeks.length - 2]!.week : null;

  const [slotA, setSlotA] = useState<SlotState>({ mode: "custom", customWeeks: latest ? [latest] : [] });
  const [slotB, setSlotB] = useState<SlotState>({ mode: "custom", customWeeks: previous ? [previous] : [] });

  if (weeks.length < 2) return null;

  const bucketA = resolveSlot(slotA, weeks);
  // B only exists when A is a specific week/weeks selection, never alongside "All Weeks" in A.
  const bucketB = slotA.mode === "custom" ? resolveSlot(slotB, weeks) : null;

  const chartData = bucketA
    ? ROWS.filter((row) => !row.isPct).map((row) => ({
        stat: row.label,
        [bucketA.label]: row.value(bucketA.avg) ?? 0,
        ...(bucketB ? { [bucketB.label]: row.value(bucketB.avg) ?? 0 } : {}),
      }))
    : [];

  return (
    <div className="bg-white border rounded-xl p-4">
      <h2 className="font-semibold text-court-dark mb-1">Weekly Comparison</h2>
      <p className="text-sm text-slate-500 mb-3">
        {slotA.mode === "all"
          ? `Season-wide breakdown for ${scopeLabel}.`
          : `Comparing chosen weeks against B, for ${scopeLabel}.`}
      </p>

      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex-1">
          <span className="text-xs font-semibold text-slate-500 block mb-1">A</span>
          <SlotControl weeks={weeks} slot={slotA} setSlot={setSlotA} />
        </div>
        {slotA.mode === "custom" && (
          <div className="flex-1">
            <span className="text-xs font-semibold text-slate-500 block mb-1">vs B</span>
            <SlotControl weeks={weeks} slot={slotB} setSlot={setSlotB} />
          </div>
        )}
      </div>

      {!bucketA && <p className="text-sm text-slate-400">Pick at least one week for A.</p>}

      {bucketA && (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="stat" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey={bucketA.label} fill="#ea580c" />
              {bucketB && <Bar dataKey={bucketB.label} fill="#e2e8f0" />}
            </BarChart>
          </ResponsiveContainer>

          {bucketB ? (
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-2 pr-3">Stat</th>
                    <th className="py-2 px-2 text-right">{bucketA.label}</th>
                    <th className="py-2 pl-2 text-right">vs {bucketB.label}</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => {
                    const currentAvg = row.value(bucketA.avg);
                    const previousAvg = row.value(bucketB.avg);
                    return (
                      <tr key={row.label} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-medium">{row.label}</td>
                        <td className="py-2 px-2 text-right">{fmt(currentAvg, row.isPct)}</td>
                        <td className="py-2 pl-2 text-right">
                          <Delta current={currentAvg} previous={previousAvg} isPct={row.isPct} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 flex justify-center">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 max-w-2xl">
                {ROWS.map((row) => (
                  <StatTile key={row.label} row={row} bucket={bucketA} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
