import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { NavBar } from "./components/NavBar";
import { PublicLayout } from "./components/PublicLayout";
import { AuthPage } from "./pages/AuthPage";
import { JoinTeamPage } from "./pages/JoinTeamPage";
import { HomePage } from "./pages/HomePage";
import { RosterPage } from "./pages/RosterPage";
import { SessionsPage } from "./pages/SessionsPage";
import { LiveTrackingPage } from "./pages/LiveTrackingPage";
import { SessionReviewPage } from "./pages/SessionReviewPage";
import { PlayerProgressPage } from "./pages/PlayerProgressPage";
import { TeamDashboardPage } from "./pages/TeamDashboardPage";
import { PublicTeamPage } from "./pages/public/PublicTeamPage";
import { PublicSessionPage } from "./pages/public/PublicSessionPage";
import { PublicPlayerPage } from "./pages/public/PublicPlayerPage";

function AppLayout() {
  return (
    <div className="min-h-full flex flex-col">
      <NavBar />
      <main className="flex-1 bg-slate-50">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/roster" element={<RosterPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/sessions/:sessionId/live" element={<LiveTrackingPage />} />
          <Route path="/sessions/:sessionId" element={<SessionReviewPage />} />
          <Route path="/players/:playerId" element={<PlayerProgressPage />} />
          <Route path="/team" element={<TeamDashboardPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/join/:inviteToken" element={<JoinTeamPage />} />
      <Route path="/share/:shareToken" element={<PublicLayout />}>
        <Route index element={<PublicTeamPage />} />
        <Route path="sessions/:sessionId" element={<PublicSessionPage />} />
        <Route path="players/:playerId" element={<PublicPlayerPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/*" element={<AppLayout />} />
      </Route>
    </Routes>
  );
}
