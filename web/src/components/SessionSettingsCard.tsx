import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Session } from "../lib/types";

function toDateInputValue(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function SessionSettingsCard({ session }: { session: Session }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(session.name ?? "");
  const [date, setDate] = useState(toDateInputValue(session.date));
  const [opponent, setOpponent] = useState(session.opponent ?? "");
  const [notes, setNotes] = useState(session.notes ?? "");

  const save = useMutation({
    mutationFn: () =>
      api.patch<Session>(`/sessions/${session.id}`, {
        name: name.trim() || null,
        date: new Date(date).toISOString(),
        opponent: opponent.trim() || null,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-report", session.id] });
      queryClient.invalidateQueries({ queryKey: ["session", session.id] });
      queryClient.invalidateQueries({ queryKey: ["sessions", session.teamId] });
      setOpen(false);
    },
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/sessions/${session.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions", session.teamId] });
      navigate("/sessions", { replace: true });
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  const onDelete = () => {
    if (window.confirm("Delete this session? Its stats and video are removed permanently.")) {
      remove.mutate();
    }
  };

  if (!open) {
    return (
      <div className="flex justify-end">
        <button onClick={() => setOpen(true)} className="tap-target text-sm text-court underline">
          Edit session details
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-court-dark">Session Details</h2>
        <button onClick={() => setOpen(false)} className="tap-target text-sm text-slate-400 hover:text-slate-900">
          Close
        </button>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-slate-500">Name</span>
          <input
            className="tap-target border rounded-lg px-3 py-2"
            placeholder={session.type === "MATCH" ? `vs ${session.opponent ?? "Opponent"}` : session.type}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-slate-500">Date</span>
          <input
            className="tap-target border rounded-lg px-3 py-2"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
        {session.type === "MATCH" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-slate-500">Opponent</span>
            <input
              className="tap-target border rounded-lg px-3 py-2"
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-slate-500">Notes</span>
          <textarea
            className="border rounded-lg px-3 py-2"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onDelete}
            disabled={remove.isPending}
            className="tap-target text-sm text-red-600 hover:underline disabled:opacity-50"
          >
            Delete session
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="tap-target bg-court text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
