import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth";

const links = [
  { to: "/", label: "Home" },
  { to: "/roster", label: "Roster" },
  { to: "/sessions", label: "Sessions" },
  { to: "/team", label: "Team Dashboard" },
];

export function NavBar() {
  const { user, logout } = useAuth();

  return (
    <header className="bg-court-dark text-white px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="font-bold text-lg tracking-tight">🏐 VB Coach</span>
        <nav className="flex gap-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                `tap-target px-3 py-2 rounded-lg text-sm font-medium ${
                  isActive ? "bg-court text-white" : "text-slate-300 hover:bg-white/10"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3 text-sm text-slate-300">
        <span>{user?.name}</span>
        <button onClick={logout} className="tap-target px-3 py-2 rounded-lg hover:bg-white/10">
          Log out
        </button>
      </div>
    </header>
  );
}
