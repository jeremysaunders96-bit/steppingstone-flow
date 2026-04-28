import { NavLink } from "react-router-dom";
import { Home, Users, Linkedin } from "lucide-react";

const items = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/contacts", label: "Contacts", icon: Users, end: false },
  { to: "/linkedin", label: "LinkedIn Queue", icon: Linkedin, end: false },
];

export function Sidebar() {
  return (
    <aside className="hidden md:flex md:flex-col w-[240px] shrink-0 bg-teal text-white min-h-screen">
      <div className="px-6 pt-8 pb-10">
        <div className="font-display text-2xl tracking-tight">Steppingstone</div>
        <div className="font-sans text-xs opacity-70 mt-1">Will Meadon</div>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-[hsl(195_42%_24%)] text-white"
                  : "text-white/85 hover:bg-[hsl(195_42%_24%)] hover:text-white"
              }`
            }
          >
            <it.icon className="h-4 w-4" />
            <span>{it.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="px-6 py-6 text-[11px] text-white/50">
        {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
      </div>
    </aside>
  );
}