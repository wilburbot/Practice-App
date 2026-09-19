import { useState } from "react";
import type { ActionResult, CourtPoint, CourtTendencies } from "../lib/types";

const RESULT_COLOR: Record<ActionResult, string> = {
  SUCCESS: "#059669",
  ERROR: "#dc2626",
  ATTEMPT: "#64748b",
  BLOCKED: "#9333ea",
};

function CourtDiagram({ points }: { points: CourtPoint[] }) {
  return (
    <div className="relative w-full rounded" style={{ aspectRatio: "2 / 1", backgroundColor: "#c99a5b" }}>
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-800" />
      <div className="absolute left-0 right-0 border-t border-dashed border-white/70" style={{ top: "33%" }} />
      <div className="absolute inset-0 border-2 border-white/80 rounded-sm" />
      {points.map((p, i) => (
        <div
          key={i}
          className="absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2 ring-1 ring-white/70"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, backgroundColor: RESULT_COLOR[p.result] }}
        />
      ))}
    </div>
  );
}

export function CourtTendencyChart({ tendencies }: { tendencies: CourtTendencies }) {
  const [tab, setTab] = useState<"attack" | "serve">("attack");
  const points = tendencies[tab];

  if (tendencies.attack.length === 0 && tendencies.serve.length === 0) return null;

  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-court-dark">Court Tendencies</h2>
        <div className="flex gap-1">
          <button
            onClick={() => setTab("attack")}
            className={`tap-target text-xs px-3 py-1.5 rounded-full border font-semibold ${
              tab === "attack" ? "bg-court text-white border-court" : "bg-white"
            }`}
          >
            Attack ({tendencies.attack.length})
          </button>
          <button
            onClick={() => setTab("serve")}
            className={`tap-target text-xs px-3 py-1.5 rounded-full border font-semibold ${
              tab === "serve" ? "bg-court text-white border-court" : "bg-white"
            }`}
          >
            Serve ({tendencies.serve.length})
          </button>
        </div>
      </div>
      {points.length > 0 ? (
        <>
          <CourtDiagram points={points} />
          <div className="flex gap-4 mt-2 text-xs text-slate-500">
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-600 mr-1" />
              {tab === "attack" ? "Kill" : "Ace"}
            </span>
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-red-600 mr-1" />
              Error
            </span>
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-slate-500 mr-1" />
              In Play
            </span>
            {tab === "attack" && (
              <span>
                <span className="inline-block w-2 h-2 rounded-full bg-purple-600 mr-1" />
                Blocked
              </span>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-400">
          No {tab === "attack" ? "attacks" : "serves"} with a tagged location yet — tag one from the Recent Events
          list on Live Tracking to start building this chart.
        </p>
      )}
    </div>
  );
}
