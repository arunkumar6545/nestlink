import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { getInitials } from "@/lib/utils";
import {
  LayoutDashboard, Building2, Plus, CreditCard,
  Megaphone, HeadphonesIcon, ScrollText, Users,
  Settings, LogOut, ShieldCheck, Zap,
  BarChart2, HeartPulse, Timer, Search,
  AlertTriangle, ClipboardList, Receipt, Wrench,
} from "lucide-react";

interface NavItem { label: string; href: string; icon: React.ElementType; badge?: string }
interface NavSection { label: string; items: NavItem[] }

const NAV: NavSection[] = [
  {
    label: "Platform",
    items: [
      { label: "Dashboard",          href: "/",          icon: LayoutDashboard },
      { label: "Platform Analytics", href: "/analytics", icon: BarChart2 },
    ],
  },
  {
    label: "Societies",
    items: [
      { label: "All Societies",       href: "/societies",     icon: Building2 },
      { label: "Onboard New Society", href: "/societies/new", icon: Plus },
      { label: "Society Health",      href: "/health",         icon: HeartPulse },
      { label: "Onboarding Tracker",  href: "/onboarding",     icon: ClipboardList },
      { label: "Trial Manager",       href: "/trials",          icon: Timer },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Announcements",     href: "/announcements", icon: Megaphone },
      { label: "Support Queue",     href: "/support",       icon: HeadphonesIcon },
      { label: "Platform Incidents",href: "/incidents",     icon: AlertTriangle },
      { label: "Maintenance Mode",  href: "/settings#maintenance", icon: Wrench },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Revenue & Billing",     href: "/billing",  icon: CreditCard },
      { label: "Subscription Invoices", href: "/invoices", icon: Receipt },
    ],
  },
  {
    label: "Users & Access",
    items: [
      { label: "Global User Search", href: "/users",  icon: Search },
      { label: "Nestlink Team",      href: "/team",   icon: Users },
    ],
  },
  {
    label: "Audit & Settings",
    items: [
      { label: "Audit Log",         href: "/audit",    icon: ScrollText },
      { label: "Platform Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function CompanySidebar() {
  const location = useLocation();
  const { profile, signOut } = useAuth();

  function isActive(href: string) {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  }

  return (
    <aside className="flex h-screen w-64 flex-col shrink-0 border-r border-violet-900/20 bg-[#13131f]">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-violet-900/20">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md shadow-violet-500/25">
          <ShieldCheck className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white tracking-tight">Nestlink</p>
          <p className="text-[10px] text-violet-400/70 font-medium uppercase tracking-widest">Company Portal</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {NAV.map((section) => (
          <div key={section.label} className="mb-1">
            <p className="px-3 pt-4 pb-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-600">
              {section.label}
            </p>
            {section.items.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-violet-600/20 text-violet-300 border border-violet-600/30"
                    : "text-slate-400 hover:bg-violet-900/20 hover:text-slate-200"
                )}
              >
                <item.icon className={cn("h-4 w-4 shrink-0", isActive(item.href) ? "text-violet-400" : "text-slate-500")} />
                {item.label}
                {item.badge && (
                  <span className="ml-auto text-[10px] font-bold bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-violet-900/20 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-bold text-white shrink-0">
            {profile?.name ? getInitials(profile.name) : <Zap className="h-3.5 w-3.5" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{profile?.name ?? "Loading..."}</p>
            <p className="text-[10px] text-violet-400 font-semibold uppercase tracking-wide">Super Admin</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-600 hover:bg-violet-900/20 hover:text-slate-400 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
