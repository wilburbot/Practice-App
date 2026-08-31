import { useRef } from "react";

/** A tap-to-mark diagram of the opponent's court, used to tag where an attack/serve landed. */
export function CourtTargetPicker({
  onPick,
  onCancel,
}: {
  onPick: (x: number, y: number) => void;
  onCancel: () => void;
}) {
  const courtRef = useRef<HTMLDivElement>(null);

  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = courtRef.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    onPick(x, y);
  };

  return (
    <div className="border rounded-lg p-3 bg-slate-50 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500">Tap where it landed</p>
        <button onClick={onCancel} className="tap-target text-xs text-slate-400 underline">
          Cancel
        </button>
      </div>
      <div
        ref={courtRef}
        onClick={handleTap}
        className="relative w-full rounded cursor-crosshair select-none"
        style={{ aspectRatio: "2 / 1", backgroundColor: "#c99a5b" }}
      >
        {/* Net */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-800" />
        {/* Attack (3m) line */}
        <div className="absolute left-0 right-0 border-t border-dashed border-white/70" style={{ top: "33%" }} />
        {/* Sidelines */}
        <div className="absolute inset-0 border-2 border-white/80 rounded-sm" />
      </div>
    </div>
  );
}
