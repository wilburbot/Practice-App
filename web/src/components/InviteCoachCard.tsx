import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function InviteCoachCard({ teamId }: { teamId: string }) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["team-invite", teamId],
    queryFn: () => api.get<{ inviteToken: string }>(`/teams/${teamId}/invite`),
    enabled: !!teamId,
  });

  const rotate = useMutation({
    mutationFn: () => api.post<{ inviteToken: string }>(`/teams/${teamId}/invite/rotate`),
    onSuccess: (result) => {
      queryClient.setQueryData(["team-invite", teamId], result);
      setCopied(false);
    },
  });

  const link = data ? `${window.location.origin}/join/${data.inviteToken}` : "";

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
      <h2 className="font-semibold text-court-dark mb-1">Invite an Assistant Coach</h2>
      <p className="text-sm text-slate-500 mb-3">
        Send this link to another coach. Once they sign up or log in and open it, they get full edit access —
        they can log stats live alongside you on the same session, manage the roster, and start sessions.
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
              if (confirm("This will invalidate the current invite link. Continue?")) {
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
