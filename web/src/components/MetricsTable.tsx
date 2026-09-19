import type { PlayerMetrics } from "../lib/types";

function fmtPct(value: number | null): string {
  if (value === null) return "—";
  return `${(value * 100).toFixed(0)}%`;
}

function fmtRating(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(1);
}

function ratio(success: number, attempts: number): number | null {
  return attempts > 0 ? success / attempts : null;
}

export function MetricsTable({
  rows,
}: {
  rows: { label: string; metrics: PlayerMetrics; href?: string }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-slate-500 border-b">
            <th className="py-2 pr-3">Player</th>
            <th className="py-2 px-2 text-right">Kills</th>
            <th className="py-2 px-2 text-right">Att Err</th>
            <th className="py-2 px-2 text-right">Att</th>
            <th className="py-2 px-2 text-right">Att Eff</th>
            <th className="py-2 px-2 text-right">Aces</th>
            <th className="py-2 px-2 text-right">Srv Err</th>
            <th className="py-2 px-2 text-right">Serves</th>
            <th className="py-2 px-2 text-right">Pass Rtg</th>
            <th className="py-2 px-2 text-right">Good Rec%</th>
            <th className="py-2 px-2 text-right">Rec Total</th>
            <th className="py-2 px-2 text-right">Rec Err%</th>
            <th className="py-2 px-2 text-right">Digs</th>
            <th className="py-2 px-2 text-right">Blocks</th>
            <th className="py-2 px-2 text-right">Assists</th>
            <th className="py-2 px-2 text-right">+/-</th>
            <th className="py-2 pl-2 text-right font-semibold">Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b last:border-0">
              <td className="py-2 pr-3 font-medium">
                {row.href ? (
                  <a href={row.href} className="underline">
                    {row.label}
                  </a>
                ) : (
                  row.label
                )}
              </td>
              <td className="py-2 px-2 text-right">{row.metrics.ATTACK.success}</td>
              <td className="py-2 px-2 text-right">{row.metrics.ATTACK.error}</td>
              <td className="py-2 px-2 text-right">{row.metrics.ATTACK.attempts}</td>
              <td className="py-2 px-2 text-right">{fmtPct(row.metrics.ATTACK.efficiency)}</td>
              <td className="py-2 px-2 text-right">{row.metrics.SERVE.success}</td>
              <td className="py-2 px-2 text-right">{row.metrics.SERVE.error}</td>
              <td className="py-2 px-2 text-right">{row.metrics.SERVE.attempts}</td>
              <td className="py-2 px-2 text-right">{fmtRating(row.metrics.avgPassRating)}</td>
              <td className="py-2 px-2 text-right">{fmtPct(row.metrics.goodReceivePct)}</td>
              <td className="py-2 px-2 text-right">{row.metrics.RECEPTION.attempts}</td>
              <td className="py-2 px-2 text-right">
                {fmtPct(ratio(row.metrics.RECEPTION.error, row.metrics.RECEPTION.attempts))}
              </td>
              <td className="py-2 px-2 text-right">{row.metrics.DIG.success}</td>
              <td className="py-2 px-2 text-right">{row.metrics.BLOCK.success}</td>
              <td className="py-2 px-2 text-right">{row.metrics.SET.success}</td>
              <td className="py-2 px-2 text-right">{row.metrics.points - row.metrics.totalErrors}</td>
              <td className="py-2 pl-2 text-right font-semibold">{row.metrics.points}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={17} className="py-4 text-center text-slate-400">
                No stats logged yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
