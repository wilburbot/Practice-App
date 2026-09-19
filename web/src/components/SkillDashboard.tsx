import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ActionType, SkillBreakdownEntry } from "../lib/types";

const SKILL_LABELS: Record<
  ActionType,
  { title: string; success: string; error: string; attempt: string; blocked: string }
> = {
  ATTACK: { title: "Attack", success: "Kills", error: "Errors", attempt: "In Play", blocked: "Blocked" },
  SERVE: { title: "Serve", success: "Aces", error: "Errors", attempt: "In Play", blocked: "Blocked" },
  RECEPTION: { title: "Reception", success: "Good Passes", error: "Errors", attempt: "In Play", blocked: "Blocked" },
  DIG: { title: "Dig", success: "Digs", error: "Errors", attempt: "In Play", blocked: "Blocked" },
  BLOCK: { title: "Block", success: "Block Kills", error: "Errors", attempt: "In Play", blocked: "Blocked" },
  SET: { title: "Set", success: "Assists", error: "Errors", attempt: "In Play", blocked: "Blocked" },
};

const RESULT_COLORS = { SUCCESS: "#059669", ERROR: "#dc2626", ATTEMPT: "#cbd5e1", BLOCKED: "#9333ea" };

function fmtPct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function SkillCard({ skill }: { skill: SkillBreakdownEntry }) {
  const labels = SKILL_LABELS[skill.actionType];

  const pieData = (
    [
      { key: "SUCCESS", name: labels.success, value: skill.resultBreakdown.SUCCESS },
      { key: "ERROR", name: labels.error, value: skill.resultBreakdown.ERROR },
      { key: "BLOCKED", name: labels.blocked, value: skill.resultBreakdown.BLOCKED },
      { key: "ATTEMPT", name: labels.attempt, value: skill.resultBreakdown.ATTEMPT },
    ] as const
  ).filter((d) => d.value > 0);

  const barData = skill.byPlayer.slice(0, 8).map((p) => ({
    name: `${p.player.jerseyNumber != null ? `#${p.player.jerseyNumber} ` : ""}${p.player.firstName}`,
    [labels.success]: p.success,
  }));
  // Tall enough for every bar to get its own row so Recharts never has to drop alternating labels
  // to avoid overlap.
  const barChartHeight = Math.max(180, barData.length * 32);

  const trendData = (skill.trend ?? []).map((t) => ({
    week: t.week.replace(/^\d{4}-/, ""),
    [labels.success]: t.success,
    [labels.error]: t.error,
  }));

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold text-slate-900">{labels.title}</h3>
        <span className="text-xs text-slate-400">{skill.attempts} logged</span>
      </div>

      {skill.attempts === 0 ? (
        <p className="text-sm text-slate-400">No {labels.title.toLowerCase()} stats logged yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                  {pieData.map((d) => (
                    <Cell key={d.key} fill={RESULT_COLORS[d.key]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 justify-center text-xs text-slate-500 -mt-2">
              {pieData.map((d) => (
                <span key={d.key}>
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1"
                    style={{ backgroundColor: RESULT_COLORS[d.key] }}
                  />
                  {d.name} ({d.value})
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1">Top by {labels.success}</p>
            <ResponsiveContainer width="100%" height={barChartHeight}>
              <BarChart data={barData} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} interval={0} />
                <Tooltip />
                <Bar dataKey={labels.success} fill="#ea580c" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {trendData.length > 0 && (
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-slate-500 mb-1">Weekly Trend</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} width={30} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey={labels.success} stroke={RESULT_COLORS.SUCCESS} strokeWidth={2} />
                  <Line type="monotone" dataKey={labels.error} stroke={RESULT_COLORS.ERROR} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="sm:col-span-2 overflow-x-auto">
            <p className="text-xs font-semibold text-slate-500 mb-1">By Player</p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-1.5 pr-2">#</th>
                  <th className="py-1.5 pr-3">Name</th>
                  <th className="py-1.5 px-2 text-right">Att</th>
                  <th className="py-1.5 px-2 text-right">{labels.success}</th>
                  <th className="py-1.5 px-2 text-right">{labels.error}</th>
                  <th className="py-1.5 px-2 text-right">Eff%</th>
                  {skill.actionType === "RECEPTION" && <th className="py-1.5 pl-2 text-right">Avg Rtg</th>}
                </tr>
              </thead>
              <tbody>
                {skill.byPlayer.map((p) => {
                  const efficiency = p.attempts > 0 ? (p.success - p.error) / p.attempts : null;
                  return (
                    <tr key={p.player.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-2 text-slate-500">{p.player.jerseyNumber ?? "—"}</td>
                      <td className="py-1.5 pr-3 font-medium">
                        {p.player.firstName} {p.player.lastName}
                      </td>
                      <td className="py-1.5 px-2 text-right">{p.attempts}</td>
                      <td className="py-1.5 px-2 text-right">{p.success}</td>
                      <td className="py-1.5 px-2 text-right">{p.error}</td>
                      <td className="py-1.5 px-2 text-right">{fmtPct(efficiency)}</td>
                      {skill.actionType === "RECEPTION" && (
                        <td className="py-1.5 pl-2 text-right">
                          {p.avgPassRating === null ? "—" : p.avgPassRating.toFixed(1)}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function SkillDashboard({ skills }: { skills: SkillBreakdownEntry[] }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {skills.map((skill) => (
        <SkillCard key={skill.actionType} skill={skill} />
      ))}
    </div>
  );
}
