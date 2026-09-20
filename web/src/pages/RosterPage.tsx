import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { useCurrentTeam } from "../lib/team";
import type { Player } from "../lib/types";
import { PlayerAvatar } from "../components/PlayerAvatar";

const POSITIONS = ["Outside Hitter", "Opposite", "Middle Blocker", "Setter", "Libero", "DS"];

export function RosterPage() {
  const { teamId } = useCurrentTeam();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [position, setPosition] = useState(POSITIONS[0]);

  const { data: players, isLoading } = useQuery({
    queryKey: ["players", teamId],
    queryFn: () => api.get<Player[]>(`/players?teamId=${teamId}`),
    enabled: !!teamId,
  });

  const addPlayer = useMutation({
    mutationFn: () =>
      api.post<Player>("/players", {
        teamId,
        firstName,
        lastName,
        jerseyNumber: jerseyNumber ? Number(jerseyNumber) : null,
        position,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players", teamId] });
      setFirstName("");
      setLastName("");
      setJerseyNumber("");
    },
  });

  const toggleActive = useMutation({
    mutationFn: (player: Player) => api.patch<Player>(`/players/${player.id}`, { active: !player.active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["players", teamId] }),
  });

  const removePlayer = useMutation({
    mutationFn: (playerId: string) => api.delete(`/players/${playerId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["players", teamId] }),
  });

  if (!teamId) return <Navigate to="/" replace />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    addPlayer.mutate();
  };

  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-court-dark">Roster</h1>

      <form onSubmit={onSubmit} className="bg-white border rounded-xl p-4 grid grid-cols-2 gap-3">
        <input
          className="tap-target border rounded-lg px-3 py-2"
          placeholder="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <input
          className="tap-target border rounded-lg px-3 py-2"
          placeholder="Last name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
        <input
          className="tap-target border rounded-lg px-3 py-2"
          placeholder="Jersey #"
          type="number"
          value={jerseyNumber}
          onChange={(e) => setJerseyNumber(e.target.value)}
        />
        <select
          className="tap-target border rounded-lg px-3 py-2"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
        >
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={addPlayer.isPending}
          className="tap-target col-span-2 bg-court text-white rounded-lg py-2 font-semibold disabled:opacity-50"
        >
          Add Player
        </button>
      </form>

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <div className="flex flex-col gap-2">
          {players?.map((player) => (
            <div
              key={player.id}
              className={`border rounded-xl px-4 py-3 flex items-center justify-between gap-3 ${
                player.active ? "bg-white" : "bg-slate-100 opacity-60"
              }`}
            >
              <Link to={`/players/${player.id}`} className="flex-1 flex items-center gap-3">
                <PlayerAvatar player={player} size={40} />
                <span>
                  <span className="font-semibold block">
                    {player.jerseyNumber != null && `#${player.jerseyNumber} `}
                    {player.firstName} {player.lastName}
                  </span>
                  <span className="block text-sm text-slate-500">{player.position}</span>
                </span>
              </Link>
              <button
                onClick={() => toggleActive.mutate(player)}
                className="tap-target text-sm px-3 py-2 rounded-lg border"
              >
                {player.active ? "Deactivate" : "Activate"}
              </button>
              <button
                onClick={() => {
                  if (confirm(`Remove ${player.firstName} ${player.lastName} and all their stats?`)) {
                    removePlayer.mutate(player.id);
                  }
                }}
                className="tap-target text-sm px-3 py-2 rounded-lg border border-red-300 text-red-600"
              >
                Remove
              </button>
            </div>
          ))}
          {players?.length === 0 && <p className="text-slate-500">No players yet — add your first one above.</p>}
        </div>
      )}
    </div>
  );
}
