import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";

export function CoachingInsightsCard({ teamId }: { teamId: string }) {
  const [error, setError] = useState<string | null>(null);

  const generate = useMutation({
    mutationFn: () => api.post<{ insights: string }>(`/reports/team/${teamId}/coaching-insights`),
    onSuccess: () => setError(null),
    onError: (err) => setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again."),
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-slate-900">Coaching Insights</h2>
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="tap-target text-sm text-court font-semibold disabled:opacity-50"
        >
          {generate.isPending ? "Thinking…" : generate.data ? "Regenerate" : "Generate"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {generate.data ? (
        <p className="text-sm text-slate-700 whitespace-pre-wrap">{generate.data.insights}</p>
      ) : (
        !error && (
          <p className="text-sm text-slate-400">
            Get AI-suggested coaching priorities based on this season's skill trends.
          </p>
        )
      )}
    </div>
  );
}
