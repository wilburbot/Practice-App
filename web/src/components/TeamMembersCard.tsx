import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { TeamMembers } from "../lib/types";

export function TeamMembersCard({ teamId, isOwner }: { teamId: string; isOwner: boolean }) {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["team-members", teamId],
    queryFn: () => api.get<TeamMembers>(`/teams/${teamId}/members`),
    enabled: !!teamId,
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) => api.delete(`/teams/${teamId}/members/${memberId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team-members", teamId] }),
  });

  if (!data) return null;

  return (
    <div className="bg-white border rounded-xl p-4">
      <h2 className="font-semibold text-court-dark mb-3">Coaches</h2>
      <ul className="flex flex-col gap-2 text-sm">
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
    </div>
  );
}
