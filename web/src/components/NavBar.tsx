import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth";

const links = [
  { to: "/", label: "Home" },
  { to: "/roster", label: "Roster" },
  { to: "/sessions", label: "Sessions" },
  { to: "/team", label: "Team Dashboard" },
  { to: "/team/skills", label: "Skills" },
];

export function NavBar() {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-5 flex-wrap">
        <span className="font-bold text-lg tracking-tight text-slate-900">🏐 VB Coach</span>
        <nav className="flex gap-4">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                `tap-target text-sm font-medium ${isActive ? "text-court font-semibold" : "text-slate-500 hover:text-slate-900"}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span>{user?.name}</span>
        <button onClick={logout} className="tap-target hover:text-slate-900">
          Log out
        </button>
      </div>
    </header>
  );
}
