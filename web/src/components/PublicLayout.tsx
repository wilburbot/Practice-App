import { Outlet, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { PublicTeam } from "../lib/types";
import { BrandMark } from "./BrandMark";

export function PublicLayout() {
  const { shareToken } = useParams<{ shareToken: string }>();

  const { data: team, isError } = useQuery({
    queryKey: ["public-team", shareToken],
    queryFn: () => api.get<PublicTeam>(`/public/${shareToken}`),
    enabled: !!shareToken,
    retry: false,
  });

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="h-1 bg-court" />
        <div className="px-4 py-3 flex items-center gap-2">
          <BrandMark size={24} />
          <span className="font-bold text-lg tracking-tight text-slate-900">{team?.name ?? "Pacman"}</span>
          <span className="ml-1 text-sm text-slate-500">Player &amp; parent view (read-only)</span>
        </div>
      </header>
      <main className="flex-1 bg-court-light">
        {isError ? (
          <div className="p-6 max-w-md mx-auto text-center">
            <p className="text-lg font-semibold text-court-dark">This link isn't working</p>
            <p className="text-slate-500 mt-2">
              It may have been reset by the coach. Ask them to send the current link.
            </p>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
