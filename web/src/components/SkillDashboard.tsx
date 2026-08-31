import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ActionType, SkillBreakdownEntry } from "../lib/types";

const SKILL_LABELS: Record<ActionType, { title: string; success: string; error: string; attempt: string }> = {
  ATTACK: { title: "Attack", success: "Kills", error: "Errors", attempt: "In Play" },
  SERVE: { title: "Serve", success: "Aces", error: "Errors", attempt: "In Play" },
  RECEPTION: { title: "Reception", success: "Good Passes", error: "Errors", attempt: "In Play" },
  DIG: { title: "Dig", success: "Digs", error: "Errors", attempt: "In Play" },
  BLOCK: { title: "Block", success: "Block Kills", error: "Errors", attempt: "In Play" },
  SET: { title: "Set", success: "Assists", error: "Errors", attempt: "In Play" },
};

const RESULT_COLORS = { SUCCESS: "#ea580c", ERROR: "#dc2626", ATTEMPT: "#cbd5e1" };

function SkillCard({ skill }: { skill: SkillBreakdownEntry }) {
  const labels = SKILL_LABELS[skill.actionType];

  const pieData = (
    [
      { key: "SUCCESS", name: labels.success, value: skill.resultBreakdown.SUCCESS },
      { key: "ERROR", name: labels.error, value: skill.resultBreakdown.ERROR },
      { key: "ATTEMPT", name: labels.attempt, value: skill.resultBreakdown.ATTEMPT },
    ] as const
  ).filter((d) => d.value > 0);

  const barData = skill.byPlayer.slice(0, 8).map((p) => ({
    name: `${p.player.jerseyNumber != null ? `#${p.player.jerseyNumber} ` : ""}${p.player.firstName}`,
    [labels.success]: p.success,
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
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={barData} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey={labels.success} fill="#ea580c" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
