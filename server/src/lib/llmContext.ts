import { prisma } from "../db.js";
import { buildSkillBreakdown, buildTeamWeekly } from "./reportQueries.js";

function fmtPct(value: number | null): string {
  return value == null ? "n/a" : `${Math.round(value * 100)}%`;
}

/** Compact plain-text summary of a team's whole season, sized to stay cheap as LLM context. */
export async function summarizeTeamForLLM(teamId: string): Promise<string> {
  const [team, players, { skills }, { weeks }] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId } }),
    prisma.player.findMany({ where: { teamId, active: true } }),
    buildSkillBreakdown(teamId),
    buildTeamWeekly(teamId),
  ]);

  const lines: string[] = [];
  lines.push(`Team: ${team?.name ?? "Unknown"}${team?.season ? ` (${team.season})` : ""}`);
  lines.push(
    `Roster: ${players
      .map((p) => `#${p.jerseyNumber ?? "-"} ${p.firstName} ${p.lastName} (${p.position ?? "unlisted position"})`)
      .join(", ")}`,
  );

  lines.push("");
  lines.push("Season totals by skill:");
  for (const skill of skills) {
    const r = skill.resultBreakdown;
    lines.push(
      `- ${skill.actionType}: ${r.SUCCESS} success, ${r.ERROR} errors${r.BLOCKED ? `, ${r.BLOCKED} blocked` : ""}, ${r.ATTEMPT} in-play (${skill.attempts} total)`,
    );
    const top = skill.byPlayer
      .slice(0, 5)
      .map((p) => `${p.player.firstName} ${p.player.lastName} (${p.success})`)
      .join(", ");
    if (top) lines.push(`  Top performers: ${top}`);
  }

  lines.push("");
  lines.push("Weekly team trend (most recent weeks):");
  for (const w of weeks.slice(-8)) {
    lines.push(
      `- Week ${w.week}: ${w.team.points} points, ${w.team.totalErrors} errors, attack efficiency ${fmtPct(
        w.team.ATTACK.efficiency,
      )}`,
    );
  }
  if (weeks.length === 0) lines.push("(no sessions logged yet)");

  return lines.join("\n");
}
