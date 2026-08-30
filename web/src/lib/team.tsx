import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface TeamContextValue {
  teamId: string | null;
  setTeamId: (id: string | null) => void;
}

const TeamContext = createContext<TeamContextValue | null>(null);
const TEAM_KEY = "vbcoach.currentTeamId";

export function TeamProvider({ children }: { children: ReactNode }) {
  const [teamId, setTeamIdState] = useState<string | null>(() => localStorage.getItem(TEAM_KEY));

  useEffect(() => {
    if (teamId) localStorage.setItem(TEAM_KEY, teamId);
    else localStorage.removeItem(TEAM_KEY);
  }, [teamId]);

  return (
    <TeamContext.Provider value={{ teamId, setTeamId: setTeamIdState }}>{children}</TeamContext.Provider>
  );
}

export function useCurrentTeam(): TeamContextValue {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error("useCurrentTeam must be used within TeamProvider");
  return ctx;
}
