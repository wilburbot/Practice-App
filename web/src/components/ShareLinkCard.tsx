import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function ShareLinkCard({ teamId }: { teamId: string }) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["team-share", teamId],
    queryFn: () => api.get<{ shareToken: string }>(`/teams/${teamId}/share`),
    enabled: !!teamId,
  });

  const rotate = useMutation({
    mutationFn: () => api.post<{ shareToken: string }>(`/teams/${teamId}/share/rotate`),
    onSuccess: (result) => {
      queryClient.setQueryData(["team-share", teamId], result);
      setCopied(false);
    },
  });

  const link = data ? `${window.location.origin}/share/${data.shareToken}` : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — the link is still selectable/visible in the input below.
    }
  };

  return (
    <div className="bg-white border rounded-xl p-4">
      <h2 className="font-semibold text-court-dark mb-1">Share With Players &amp; Parents</h2>
      <p className="text-sm text-slate-500 mb-3">
        Send this link so they can view the dashboard, sessions, and video. No login needed. Anyone with the
        link can view it, so share it only with your team.
      </p>
      {isLoading ? (
        <p className="text-sm text-slate-400">Loading link…</p>
      ) : (
        <div className="flex flex-wrap gap-2 items-center">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="tap-target border rounded-lg px-3 py-2 flex-1 min-w-[200px] text-sm bg-slate-50"
          />
          <button onClick={copyLink} className="tap-target bg-court text-white rounded-lg px-3 py-2 text-sm font-semibold">
            {copied ? "Copied ✓" : "Copy Link"}
          </button>
          <button
            onClick={() => {
              if (confirm("This will invalidate the current link — anyone using it will lose access. Continue?")) {
                rotate.mutate();
              }
            }}
            className="tap-target border rounded-lg px-3 py-2 text-sm"
          >
            Generate New Link
          </button>
        </div>
      )}
    </div>
  );
}
