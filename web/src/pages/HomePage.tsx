import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useCurrentTeam } from "../lib/team";
import type { Team } from "../lib/types";

export function HomePage() {
  const { teamId, setTeamId } = useCurrentTeam();
  const queryClient = useQueryClient();
  const [newTeamName, setNewTeamName] = useState("");

  const { data: teams, isLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: () => api.get<Team[]>("/teams"),
  });

  const createTeam = useMutation({
    mutationFn: (name: string) => api.post<Team>("/teams", { name }),
    onSuccess: (team) => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setTeamId(team.id);
    },
  });

  const currentTeam = teams?.find((t) => t.id === teamId);

  const onCreateTeam = (e: FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    createTeam.mutate(newTeamName.trim());
    setNewTeamName("");
  };

  if (isLoading) return <p className="p-6">Loading…</p>;

  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-court-dark">Welcome back</h1>
        <p className="text-slate-500">Pick your active team, or add a new one.</p>
      </div>

      {teams && teams.length > 0 && (
        <div className="flex flex-col gap-2">
          {teams.map((team) => (
            <button
              key={team.id}
              onClick={() => setTeamId(team.id)}
              className={`tap-target text-left border rounded-xl px-4 py-3 flex justify-between items-center ${
                team.id === teamId ? "border-court ring-2 ring-court" : "border-slate-200"
              }`}
            >
              <span>
                <span className="font-semibold">{team.name}</span>
                {team.season && <span className="text-slate-500"> · {team.season}</span>}
              </span>
              <span className="text-sm text-slate-500">
                {team._count?.players ?? 0} players · {team._count?.sessions ?? 0} sessions
              </span>
            </button>
          ))}
        </div>
      )}

      <form onSubmit={onCreateTeam} className="flex gap-2">
        <input
          className="tap-target border rounded-lg px-3 py-2 flex-1"
          placeholder="New team name (e.g. Varsity Girls)"
          value={newTeamName}
          onChange={(e) => setNewTeamName(e.target.value)}
        />
        <button
          type="submit"
          disabled={createTeam.isPending}
          className="tap-target bg-court text-white rounded-lg px-4 font-semibold disabled:opacity-50"
        >
          Add team
        </button>
      </form>

      {currentTeam && (
        <div className="grid grid-cols-2 gap-3 mt-4">
          <Link to="/roster" className="tap-target bg-court-dark text-white rounded-xl p-5 text-center font-semibold">
            Manage Roster
          </Link>
          <Link to="/sessions" className="tap-target bg-court text-white rounded-xl p-5 text-center font-semibold">
            Start / View Sessions
          </Link>
          <Link
            to="/team"
            className="tap-target bg-emerald-700 text-white rounded-xl p-5 text-center font-semibold col-span-2"
          >
            Team Dashboard & Weekly Report
          </Link>
        </div>
      )}
    </div>
  );
}
