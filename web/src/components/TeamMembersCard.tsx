import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import type { TeamMembers } from "../lib/types";

export function TeamMembersCard({ teamId, isOwner }: { teamId: string; isOwner: boolean }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["team-members", teamId],
    queryFn: () => api.get<TeamMembers>(`/teams/${teamId}/members`),
    enabled: !!teamId,
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) => api.delete(`/teams/${teamId}/members/${memberId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team-members", teamId] }),
  });

  const addMember = useMutation({
    mutationFn: () => api.post(`/teams/${teamId}/members`, { email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", teamId] });
      setEmail("");
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again."),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    addMember.mutate();
  };

  if (!data) return null;

  return (
    <div className="bg-white border rounded-xl p-4">
      <h2 className="font-semibold text-court-dark mb-3">Coaches</h2>
      <ul className="flex flex-col gap-2 text-sm mb-3">
        {data.owner && (
          <li className="flex items-center justify-between">
            <span>
              {data.owner.name} <span className="text-slate-400">({data.owner.email})</span>
            </span>
            <span className="text-xs text-slate-400 font-semibold">HEAD COACH</span>
          </li>
        )}
        {data.members.map((member) => (
          <li key={member.id} className="flex items-center justify-between">
            <span>
              {member.user.name} <span className="text-slate-400">({member.user.email})</span>
            </span>
            {isOwner && (
              <button
                onClick={() => {
                  if (confirm(`Remove ${member.user.name}'s edit access to this team?`)) {
                    removeMember.mutate(member.id);
                  }
                }}
                className="tap-target text-xs text-red-600 underline"
              >
                Remove
              </button>
            )}
          </li>
        ))}
        {data.members.length === 0 && <li className="text-slate-400">No assistant coaches yet.</li>}
      </ul>

      {isOwner && (
        <form onSubmit={onSubmit} className="flex flex-wrap gap-2 items-center border-t pt-3">
          <input
            className="tap-target border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
            type="email"
            placeholder="Add a coach by their account email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            type="submit"
            disabled={addMember.isPending}
            className="tap-target bg-court text-white rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Add
          </button>
          {error && <p className="text-sm text-red-600 w-full">{error}</p>}
          <p className="text-xs text-slate-400 w-full">
            Only works if they already have a Pacman account. Otherwise send them the invite link below.
          </p>
        </form>
      )}
    </div>
  );
}
