import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import type { Session } from "../lib/types";

export function SessionRecapCard({ session }: { session: Session }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const generate = useMutation({
    mutationFn: () => api.post<Session>(`/sessions/${session.id}/recap`),
    onSuccess: (updated) => {
      setError(null);
      queryClient.setQueryData(["session", session.id], updated);
      queryClient.invalidateQueries({ queryKey: ["session-report", session.id] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again."),
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-slate-900">AI Recap</h2>
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="tap-target text-sm text-court font-semibold disabled:opacity-50"
        >
          {generate.isPending ? "Writing…" : session.recapText ? "Regenerate" : "Generate Recap"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {session.recapText ? (
        <>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{session.recapText}</p>
          {session.recapGeneratedAt && (
            <p className="text-xs text-slate-400 mt-2">
              Generated {new Date(session.recapGeneratedAt).toLocaleString()}
            </p>
          )}
        </>
      ) : (
        !error && <p className="text-sm text-slate-400">No recap yet — generate a short AI summary of this session.</p>
      )}
    </div>
  );
}
