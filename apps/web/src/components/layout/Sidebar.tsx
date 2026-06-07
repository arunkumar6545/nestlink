import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SocietySwitcher } from "@/components/shared/SocietySwitcher";
import { getInitials } from "@nestlink/core";
import {
  LayoutDashboard, Users, Bell, AlertCircle, CreditCard, Calendar,
  UserCheck, Shield, LogOut, Home, QrCode, User, UserCog,
  MessageSquare, Mail, UsersRound, ShoppingBag, FolderLock,
  Crown,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
}

interface NavSection {
  key: string;
  label: string;
  items: NavItem[];
}

// All available roles
const HOA_ROLES = ["admin", "hoa_president", "hoa_secretary", "hoa_treasurer", "hoa_member"];
const COMMUNITY_ROLES = [...HOA_ROLES, "resident"];

// ─── Navigation sections ──────────────────────────────────────────

const NAV_SECTIONS: NavSection[] = [
  // ── OVERVIEW ─────────────────────────────────────────────────
  {
    key: "overview",
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
        roles: HOA_ROLES,
      },
      {
        label: "Home",
        href: "/resident",
        icon: Home,
        roles: ["resident"],
      },
    ],
  },

  // ── MANAGEMENT (admin / HOA roles) ───────────────────────────
  {
    key: "management",
    label: "Management",
    items: [
      { label: "Residents",     href: "/admin/residents",  icon: Users,         roles: ["admin", "hoa_president", "hoa_secretary"] },
      { label: "Notices",       href: "/admin/notices",    icon: Bell,          roles: ["admin", "hoa_president", "hoa_secretary"] },
      { label: "Complaints",    href: "/admin/complaints", icon: AlertCircle,   roles: ["admin", "hoa_president", "hoa_secretary", "hoa_member"] },
      { label: "Invoices",      href: "/admin/invoices",   icon: CreditCard,    roles: ["admin", "hoa_president", "hoa_treasurer"] },
      { label: "Amenities",     href: "/admin/amenities",  icon: Calendar,      roles: ["admin", "hoa_president"] },
      { label: "Guards",        href: "/admin/guards",     icon: Shield,        roles: ["admin", "hoa_president"] },
      { label: "Groups",        href: "/admin/groups",     icon: MessageSquare, roles: ["admin", "hoa_president", "hoa_secretary", "hoa_member"] },
      { label: "Users & Roles", href: "/admin/users",      icon: UserCog,       roles: ["admin"] },
      { label: "HOA Roles",     href: "/admin/hoa-roles",  icon: Crown,         roles: ["admin", "hoa_president"] },
    ],
  },

  // ── MY HOME (resident only) ───────────────────────────────────
  {
    key: "my-home",
    label: "My Home",
    items: [
      { label: "Visitors",   href: "/resident/visitors",   icon: QrCode,    roles: ["resident"] },
      { label: "Complaints", href: "/resident/complaints", icon: AlertCircle, roles: ["resident"] },
      { label: "Notices",    href: "/resident/notices",    icon: Bell,       roles: ["resident"] },
      { label: "Payments",   href: "/resident/payments",   icon: CreditCard, roles: ["resident"] },
      { label: "Amenities",  href: "/resident/amenities",  icon: Calendar,   roles: ["resident"] },
      { label: "Staff",      href: "/resident/staff",      icon: UserCheck,  roles: ["resident"] },
      { label: "Groups",     href: "/resident/groups",     icon: MessageSquare, roles: ["resident"] },
    ],
  },

  // ── COMMUNITY ─────────────────────────────────────────────────
  {
    key: "community",
    label: "Community",
    items: [
      { label: "Members",     href: "/members",     icon: UsersRound,  roles: COMMUNITY_ROLES },
      { label: "Messages",    href: "/messages",    icon: Mail,        roles: COMMUNITY_ROLES },
      { label: "Marketplace", href: "/marketplace", icon: ShoppingBag, roles: COMMUNITY_ROLES },
    ],
  },

  // ── DOCUMENTS ────────────────────────────────────────────────
  {
    key: "documents",
    label: "Documents",
    items: [
      { label: "Document Vault", href: "/documents", icon: FolderLock, roles: [...HOA_ROLES, "resident"] },
    ],
  },

  // ── ACCOUNT ──────────────────────────────────────────────────
  {
    key: "account",
    label: "Account",
    items: [
      { label: "Profile", href: "/resident/profile", icon: User, roles: ["resident"] },
    ],
  },

  // ── SECURITY ─────────────────────────────────────────────────
  {
    key: "security",
    label: "Security",
    items: [
      { label: "Gate Scanner", href: "/guard", icon: QrCode, roles: ["guard"] },
    ],
  },
];

// ─── Sidebar Component ────────────────────────────────────────────

export function Sidebar() {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const role = profile?.role ?? "";

  const ROLE_LABELS: Record<string, string> = {
    admin:         "Society Admin",
    hoa_president: "HOA President",
    hoa_secretary: "HOA Secretary",
    hoa_treasurer: "HOA Treasurer",
    hoa_member:    "HOA Member",
    resident:      "Resident",
    guard:         "Security Guard",
    staff:         "Staff",
    super_admin:   "Super Admin",
  };

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border shrink-0">
      {/* Society Switcher */}
      <div className="px-3 pt-4 pb-3 border-b border-sidebar-border">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 px-2 mb-2">
          Nestlink
        </p>
        <SocietySwitcher />
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {NAV_SECTIONS.map((section) => {
          const sectionItems = section.items.filter((item) => item.roles.includes(role));
          if (sectionItems.length === 0) return null;

          return (
            <div key={section.key} className="mb-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 px-3 pt-4 pb-1.5">
                {section.label}
              </p>
              {sectionItems.map((item) => {
                const isActive =
                  location.pathname === item.href ||
                  (item.href.length > 1 &&
                    !["admin", "/resident", "/guard"].includes(item.href) &&
                    location.pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary text-white text-xs">
              {profile?.name ? getInitials(profile.name) : "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {profile?.name ?? "Loading..."}
            </p>
            <p className="text-xs text-sidebar-foreground/60">
              {ROLE_LABELS[role] ?? role}
            </p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
