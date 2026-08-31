import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";

export function AskTeamCard({ teamId }: { teamId: string }) {
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ask = useMutation({
    mutationFn: () => api.post<{ answer: string }>(`/teams/${teamId}/ask`, { question }),
    onError: (err) => setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again."),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!question.trim()) return;
    ask.mutate();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <h2 className="font-semibold text-slate-900 mb-1">Ask About Your Stats</h2>
      <p className="text-sm text-slate-500 mb-3">
        Ask a question in plain English, e.g. "How is our serve receive trending?" or "Who's been our most
        consistent attacker this month?"
      </p>
      <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
        <input
          className="tap-target border rounded-lg px-3 py-2 flex-1 min-w-[200px] text-sm"
          placeholder="Ask a question…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button
          type="submit"
          disabled={ask.isPending}
          className="tap-target bg-court text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {ask.isPending ? "Thinking…" : "Ask"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      {ask.data && <p className="text-sm text-slate-700 mt-3 whitespace-pre-wrap">{ask.data.answer}</p>}
    </div>
  );
}
