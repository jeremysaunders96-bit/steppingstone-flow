import { NavLink } from "react-router-dom";
import { Home, Users, Linkedin, Mail, Briefcase, Calendar, AlertCircle, Mic, CheckSquare } from "lucide-react";
import { useAttentionCount } from "@/hooks/useAttentionCount";
import { useActiveDealsCount } from "@/hooks/useActiveDealsCount";
import { useUnmatchedCount } from "@/hooks/useUnmatchedCount";
import { useActionItemsCount } from "@/hooks/useActionItemsCount";
import { Button } from "@/components/ui/button";

export function Sidebar({
  onComposeClick,
  onCaptureMeetingClick,
}: {
  onComposeClick?: () => void;
  onCaptureMeetingClick?: () => void;
}) {
  const attention = useAttentionCount();
  const activeDeals = useActiveDealsCount();
  const unmatched = useUnmatchedCount();
  const actionItems = useActionItemsCount();
  const items = [
    { to: "/", label: "Home", icon: Home, end: true, key: "home" as const },
    { to: "/contacts", label: "Contacts", icon: Users, end: false, key: "contacts" as const },
    { to: "/meetings", label: "Meetings", icon: Calendar, end: false, key: "meetings" as const },
    { to: "/action-items", label: "Action Items", icon: CheckSquare, end: false, key: "action-items" as const },
    { to: "/deals", label: "Deals", icon: Briefcase, end: false, key: "deals" as const },
    ...(unmatched > 0 ? [{ to: "/unmatched", label: "Unmatched", icon: AlertCircle, end: false, key: "unmatched" as const }] : []),
    { to: "/linkedin", label: "LinkedIn Queue", icon: Linkedin, end: false, key: "linkedin" as const },
  ];
  return (
    <aside className="hidden md:flex md:flex-col w-[240px] shrink-0 bg-teal text-white min-h-screen">
      <div className="px-6 pt-8 pb-10">
        <div className="font-display text-2xl tracking-tight">Steppingstone</div>
        <div className="font-sans text-xs opacity-70 mt-1">Will Meadon</div>
      </div>
      {onCaptureMeetingClick && (
        <div className="px-3 pb-3">
          <Button
            onClick={onCaptureMeetingClick}
            style={{ backgroundColor: "#b3c2c9", color: "#2b5a6a" }}
            className="w-full font-medium hover:opacity-90 hover:bg-[#b3c2c9]"
          >
            <Mic className="h-4 w-4 mr-2" /> Capture Meeting
          </Button>
        </div>
      )}
      {onComposeClick && (
        <div className="px-3 pb-3">
          <Button
            onClick={onComposeClick}
            className="w-full bg-teal text-white border border-white/20 hover:bg-[hsl(195_42%_24%)] font-medium"
          >
            <Mail className="h-4 w-4 mr-2" /> Compose Email
          </Button>
        </div>
      )}
      <nav className="flex-1 px-3">
        {items.map((it, i) => (
          <div key={it.to}>
            {i > 0 && <div className="mx-3 h-px bg-teal-light/25" />}
            <NavLink
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 my-0.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-[hsl(195_42%_24%)] text-white"
                    : "text-white/85 hover:bg-[hsl(195_42%_24%)] hover:text-white"
                }`
              }
            >
              <it.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{it.label}</span>
              {it.key === "home" && attention > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-orange text-white text-[11px] font-semibold leading-none">
                  {attention}
                </span>
              )}
              {it.key === "deals" && activeDeals > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-orange text-white text-[11px] font-semibold leading-none">
                  {activeDeals}
                </span>
              )}
              {it.key === "action-items" && actionItems > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-orange text-white text-[11px] font-semibold leading-none">
                  {actionItems}
                </span>
              )}
              {it.key === "unmatched" && unmatched > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-orange text-white text-[11px] font-semibold leading-none">
                  {unmatched}
                </span>
              )}
            </NavLink>
          </div>
        ))}
      </nav>
      <div className="px-6 py-6 text-[11px] text-white/50">
        {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
      </div>
    </aside>
  );
}