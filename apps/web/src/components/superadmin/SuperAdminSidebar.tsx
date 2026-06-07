import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@nestlink/core";
import {
  LayoutDashboard,
  Building2,
  Users,
  BarChart3,
  Settings,
  LogOut,
  ShieldCheck,
  FileText,
  Zap,
} from "lucide-react";

const navItems = [
  {
    group: "Platform",
    items: [
      { label: "Dashboard", href: "/superadmin", icon: LayoutDashboard, exact: true },
      { label: "Societies", href: "/superadmin/societies", icon: Building2 },
      { label: "All Users", href: "/superadmin/users", icon: Users },
      { label: "Analytics", href: "/superadmin/analytics", icon: BarChart3 },
    ],
  },
  {
    group: "Operations",
    items: [
      { label: "Onboard Society", href: "/superadmin/onboard", icon: Zap },
      { label: "Audit Log", href: "/superadmin/audit", icon: FileText },
    ],
  },
  {
    group: "System",
    items: [
      { label: "Settings", href: "/superadmin/settings", icon: Settings },
    ],
  },
];

export function SuperAdminSidebar() {
  const location = useLocation();
  const { profile, signOut } = useAuth();

  function isActive(href: string, exact = false) {
    return exact
      ? location.pathname === href
      : location.pathname === href || location.pathname.startsWith(href + "/");
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r" style={{
      background: "linear-gradient(180deg, #1e1b4b 0%, #312e81 100%)",
      borderColor: "rgba(139,92,246,0.2)",
    }}>
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: "rgba(139,92,246,0.2)" }}>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500 shrink-0">
          <ShieldCheck className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">Nestlink</p>
          <p className="text-xs font-semibold text-violet-300 tracking-wide uppercase">
            Super Admin
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {navItems.map(({ group, items }) => (
          <div key={group}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-violet-400/70">
              {group}
            </p>
            <div className="space-y-0.5">
              {items.map(({ label, href, icon: Icon, exact }) => {
                const active = isActive(href, exact);
                return (
                  <Link
                    key={href}
                    to={href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                      active
                        ? "bg-violet-500 text-white shadow-lg shadow-violet-900/40"
                        : "text-violet-200/70 hover:bg-violet-500/20 hover:text-violet-100"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t p-4 space-y-3" style={{ borderColor: "rgba(139,92,246,0.2)" }}>
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-violet-500 text-white text-xs font-bold">
              {profile?.name ? getInitials(profile.name) : "SA"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {profile?.name ?? "Super Admin"}
            </p>
            <div className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <p className="text-xs text-violet-300">Super Admin</p>
            </div>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-violet-300/70 hover:bg-violet-500/20 hover:text-violet-200 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
