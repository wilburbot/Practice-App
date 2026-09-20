import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Player } from "../lib/types";
import { PlayerAvatar } from "./PlayerAvatar";

const POSITIONS = ["Outside Hitter", "Opposite", "Middle Blocker", "Setter", "Libero", "DS"];

export function PlayerDetailsCard({ player }: { player: Player }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(player.firstName);
  const [lastName, setLastName] = useState(player.lastName);
  const [jerseyNumber, setJerseyNumber] = useState(player.jerseyNumber != null ? String(player.jerseyNumber) : "");
  const [position, setPosition] = useState(player.position ?? "");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["player-progress", player.id] });
    queryClient.invalidateQueries({ queryKey: ["players", player.teamId] });
  };

  const savePlayer = useMutation({
    mutationFn: () =>
      api.patch<Player>(`/players/${player.id}`, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        jerseyNumber: jerseyNumber ? Number(jerseyNumber) : null,
        position: position || null,
      }),
    onSuccess: () => {
      invalidate();
      setEditing(false);
    },
  });

  const uploadPhoto = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("photo", file);
      return api.post<Player>(`/players/${player.id}/photo`, form);
    },
    onSuccess: invalidate,
  });

  const removePhoto = useMutation({
    mutationFn: () => api.delete<Player>(`/players/${player.id}/photo`),
    onSuccess: invalidate,
  });

  const onPhotoSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadPhoto.mutate(file);
    e.target.value = "";
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    savePlayer.mutate();
  };

  const cancelEdit = () => {
    setFirstName(player.firstName);
    setLastName(player.lastName);
    setJerseyNumber(player.jerseyNumber != null ? String(player.jerseyNumber) : "");
    setPosition(player.position ?? "");
    setEditing(false);
  };

  return (
    <div className="bg-white border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative">
          <PlayerAvatar player={player} size={64} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadPhoto.isPending}
            title="Take or upload a photo"
            className="tap-target absolute -bottom-1 -right-1 bg-court text-white rounded-full w-7 h-7 flex items-center justify-center text-sm border-2 border-white"
          >
            {uploadPhoto.isPending ? "…" : "📷"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPhotoSelected}
          />
        </div>

        {!editing ? (
          <>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-court-dark">
                {player.jerseyNumber != null ? `#${player.jerseyNumber} ` : ""}
                {player.firstName} {player.lastName}
              </h1>
              <p className="text-sm text-slate-500">{player.position ?? "No position set"}</p>
              {player.photoUrl && (
                <button
                  onClick={() => removePhoto.mutate()}
                  disabled={removePhoto.isPending}
                  className="tap-target text-xs text-red-600 underline mt-1"
                >
                  Remove photo
                </button>
              )}
            </div>
            <button
              onClick={() => setEditing(true)}
              className="tap-target border rounded-lg px-3 py-2 text-sm font-semibold"
            >
              Edit Details
            </button>
          </>
        ) : (
          <form onSubmit={onSubmit} className="flex-1 grid grid-cols-2 gap-2">
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
              <option value="">No position</option>
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {savePlayer.isError && (
              <p className="col-span-2 text-sm text-red-600">Couldn't save — please try again.</p>
            )}
            <div className="col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={savePlayer.isPending}
                className="tap-target flex-1 bg-court text-white rounded-lg py-2 font-semibold disabled:opacity-50"
              >
                {savePlayer.isPending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="tap-target flex-1 border rounded-lg py-2 font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
