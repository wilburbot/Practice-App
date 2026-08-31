import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useCurrentTeam } from "../lib/team";
import { setPendingInvite } from "../lib/pendingInvite";
import type { Team } from "../lib/types";

export function JoinTeamPage() {
  const { inviteToken } = useParams<{ inviteToken: string }>();
  const { isAuthenticated } = useAuth();
  const { setTeamId } = useCurrentTeam();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const join = useMutation({
    mutationFn: () => api.post<Team>("/teams/join", { inviteToken }),
    onSuccess: (team) => {
      setTeamId(team.id);
      navigate("/", { replace: true });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again."),
  });

  useEffect(() => {
    if (!isAuthenticated && inviteToken) {
      setPendingInvite(inviteToken);
    }
  }, [isAuthenticated, inviteToken]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-full flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2">You've been invited to coach</h1>
          <p className="text-slate-500 mb-6">Log in or create an account to accept and get edit access to this team.</p>
          <Link to="/login" className="tap-target block bg-court text-white rounded-lg py-2 font-semibold">
            Log In / Sign Up
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-center">
        <h1 className="text-xl font-bold text-slate-900 mb-2">Join as a Coach</h1>
        <p className="text-slate-500 mb-6">
          Accepting gives you full edit access — you'll be able to log stats live, manage the roster, and start
          sessions alongside the other coaches.
        </p>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        <button
          onClick={() => join.mutate()}
          disabled={join.isPending}
          className="tap-target w-full bg-court text-white rounded-lg py-2 font-semibold disabled:opacity-50"
        >
          {join.isPending ? "Joining…" : "Accept & Join Team"}
        </button>
      </div>
    </div>
  );
}
