import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Users,
  Bell,
  AlertCircle,
  CreditCard,
  Calendar,
  Shield,
  Home,
  QrCode,
  UserCheck,
  User,
  Search,
  Building2,
  Loader2,
  UserCog,
  MessageSquare,
  UsersRound,
  Mail,
  ShoppingBag,
  FolderLock,
  Crown,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";

interface NavEntry {
  label: string;
  description?: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
  keywords?: string[];
}

const NAV_ENTRIES: NavEntry[] = [
  {
    label: "Admin Dashboard",
    description: "Overview, stats and charts",
    href: "/admin",
    icon: LayoutDashboard,
    roles: ["admin"],
    keywords: ["dashboard", "overview", "stats", "summary"],
  },
  {
    label: "Residents",
    description: "Manage resident accounts and approvals",
    href: "/admin/residents",
    icon: Users,
    roles: ["admin"],
    keywords: ["residents", "tenants", "owners", "approvals", "flats"],
  },
  {
    label: "Notices",
    description: "Post and manage society notices",
    href: "/admin/notices",
    icon: Bell,
    roles: ["admin"],
    keywords: ["notices", "announcements", "circulars", "alerts"],
  },
  {
    label: "Complaints (Admin)",
    description: "View and resolve resident complaints",
    href: "/admin/complaints",
    icon: AlertCircle,
    roles: ["admin"],
    keywords: ["complaints", "issues", "tickets", "problems"],
  },
  {
    label: "Invoices",
    description: "Billing, invoices and maintenance fees",
    href: "/admin/invoices",
    icon: CreditCard,
    roles: ["admin"],
    keywords: ["invoices", "billing", "maintenance", "payments", "dues"],
  },
  {
    label: "Amenities (Admin)",
    description: "Manage amenity bookings",
    href: "/admin/amenities",
    icon: Calendar,
    roles: ["admin"],
    keywords: ["amenities", "gym", "pool", "club", "hall", "bookings"],
  },
  {
    label: "Guards",
    description: "Manage security guards",
    href: "/admin/guards",
    icon: Shield,
    roles: ["admin"],
    keywords: ["guards", "security", "watchmen"],
  },
  {
    label: "Users & Roles",
    description: "Invite users, assign roles, manage members",
    href: "/admin/users",
    icon: UserCog,
    roles: ["admin"],
    keywords: ["users", "invite", "roles", "members", "assign role", "admin", "guard", "resident"],
  },
  {
    label: "Add New Society",
    description: "Create and manage a new society",
    href: "/admin/societies/new",
    icon: Building2,
    roles: ["admin"],
    keywords: ["society", "new society", "create society", "add society", "multi society"],
  },
  {
    label: "Groups",
    description: "Society groups, group chat and member management",
    href: "/admin/groups",
    icon: MessageSquare,
    roles: ["admin", "hoa_president", "hoa_secretary", "hoa_member"],
    keywords: ["groups", "chat", "group chat", "community", "club", "sports", "welfare"],
  },
  {
    label: "HOA Roles & Permissions",
    description: "Assign committee roles to elected HOA members",
    href: "/admin/hoa-roles",
    icon: Crown,
    roles: ["admin", "hoa_president"],
    keywords: ["hoa", "roles", "committee", "president", "secretary", "treasurer", "assign role", "elected"],
  },
  {
    label: "Marketplace",
    description: "Buy, sell & give away items in the society",
    href: "/marketplace",
    icon: ShoppingBag,
    roles: ["admin", "hoa_president", "hoa_secretary", "hoa_treasurer", "hoa_member"],
    keywords: ["marketplace", "buy", "sell", "listings", "items", "second hand", "free"],
  },
  {
    label: "Document Vault",
    description: "HOA documents, minutes, bylaws and reports",
    href: "/documents",
    icon: FolderLock,
    roles: ["admin", "hoa_president", "hoa_secretary", "hoa_treasurer", "hoa_member"],
    keywords: ["documents", "vault", "minutes", "bylaws", "legal", "reports", "files"],
  },
  {
    label: "Members Directory",
    description: "Search and connect with society members",
    href: "/members",
    icon: UsersRound,
    roles: ["admin"],
    keywords: ["members", "directory", "search people", "find member", "residents list"],
  },
  {
    label: "Messages",
    description: "Direct messages with members",
    href: "/messages",
    icon: Mail,
    roles: ["admin"],
    keywords: ["messages", "dm", "direct message", "chat", "inbox"],
  },

  {
    label: "Home",
    description: "Resident home dashboard",
    href: "/resident",
    icon: Home,
    roles: ["resident"],
    keywords: ["home", "dashboard", "overview"],
  },
  {
    label: "My Visitors",
    description: "Manage visitor passes and OTPs",
    href: "/resident/visitors",
    icon: QrCode,
    roles: ["resident"],
    keywords: ["visitors", "guests", "pass", "otp", "qr", "entry"],
  },
  {
    label: "My Complaints",
    description: "Raise and track complaints",
    href: "/resident/complaints",
    icon: AlertCircle,
    roles: ["resident"],
    keywords: ["complaints", "issues", "raise", "ticket"],
  },
  {
    label: "Notices",
    description: "Read society notices",
    href: "/resident/notices",
    icon: Bell,
    roles: ["resident"],
    keywords: ["notices", "announcements", "circulars"],
  },
  {
    label: "Payments",
    description: "Pay maintenance and view history",
    href: "/resident/payments",
    icon: CreditCard,
    roles: ["resident"],
    keywords: ["payments", "pay", "maintenance", "dues", "bill", "invoice"],
  },
  {
    label: "Amenities",
    description: "Book club house, gym, pool and more",
    href: "/resident/amenities",
    icon: Calendar,
    roles: ["resident"],
    keywords: ["amenities", "book", "gym", "pool", "club", "hall", "sports"],
  },
  {
    label: "Staff Directory",
    description: "Contact society staff",
    href: "/resident/staff",
    icon: UserCheck,
    roles: ["resident"],
    keywords: ["staff", "staff directory", "electrician", "plumber", "housekeeping", "contact"],
  },
  {
    label: "Groups",
    description: "Join groups, chat with community members",
    href: "/resident/groups",
    icon: MessageSquare,
    roles: ["resident"],
    keywords: ["groups", "chat", "community", "club", "group chat", "sports", "parents", "welfare"],
  },
  {
    label: "Marketplace",
    description: "Buy, sell & give away items in the society",
    href: "/marketplace",
    icon: ShoppingBag,
    roles: ["resident"],
    keywords: ["marketplace", "buy", "sell", "listings", "second hand", "free", "items"],
  },
  {
    label: "Document Vault",
    description: "Official society documents shared by the HOA",
    href: "/documents",
    icon: FolderLock,
    roles: ["resident"],
    keywords: ["documents", "vault", "bylaws", "notices", "files", "society docs"],
  },
  {
    label: "Members Directory",
    description: "Find and connect with society members",
    href: "/members",
    icon: UsersRound,
    roles: ["resident"],
    keywords: ["members", "directory", "find people", "neighbour", "neighbour search"],
  },
  {
    label: "Messages",
    description: "Direct messages with members",
    href: "/messages",
    icon: Mail,
    roles: ["resident"],
    keywords: ["messages", "dm", "direct message", "chat", "inbox"],
  },
  {
    label: "My Profile",
    description: "Update your profile and flat info",
    href: "/resident/profile",
    icon: User,
    roles: ["resident"],
    keywords: ["profile", "account", "settings", "flat", "personal"],
  },

  {
    label: "Guard Scanner",
    description: "Scan QR codes to verify visitors",
    href: "/guard",
    icon: QrCode,
    roles: ["guard"],
    keywords: ["scan", "qr", "verify", "visitor", "entry"],
  },
];

interface DbResult {
  type: "complaint" | "notice" | "resident" | "invoice";
  id: string;
  label: string;
  description?: string;
  href: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const navigate = useNavigate();
  const { profile } = useAuth();

  const role = profile?.role ?? "";
  const societyId = profile?.society_id ?? "";

  const filteredNav = NAV_ENTRIES.filter((entry) => {
    if (!entry.roles.includes(role)) return false;
    if (!debouncedQuery) return true;
    const q = debouncedQuery.toLowerCase();
    return (
      entry.label.toLowerCase().includes(q) ||
      (entry.description ?? "").toLowerCase().includes(q) ||
      (entry.keywords ?? []).some((k) => k.includes(q))
    );
  });

  const { data: dbResults, isFetching } = useQuery<DbResult[]>({
    queryKey: ["command-search", debouncedQuery, societyId, role],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2 || !societyId) return [];
      const results: DbResult[] = [];

      if (role === "admin") {
        const [{ data: complaints }, { data: residents }, { data: notices }] = await Promise.all([
          supabase
            .from("complaints")
            .select("id, title, status, category")
            .ilike("title", `%${debouncedQuery}%`)
            .limit(4),
          supabase
            .from("profiles")
            .select("id, name, role")
            .ilike("name", `%${debouncedQuery}%`)
            .eq("role", "resident")
            .limit(4),
          supabase
            .from("notices")
            .select("id, title")
            .ilike("title", `%${debouncedQuery}%`)
            .limit(3),
        ]);

        (complaints ?? []).forEach((c) =>
          results.push({
            type: "complaint",
            id: c.id,
            label: c.title,
            description: `${c.category} • ${c.status}`,
            href: "/admin/complaints",
          })
        );
        (residents ?? []).forEach((r) =>
          results.push({
            type: "resident",
            id: r.id,
            label: r.name,
            description: "Resident",
            href: "/admin/residents",
          })
        );
        (notices ?? []).forEach((n) =>
          results.push({
            type: "notice",
            id: n.id,
            label: n.title,
            description: "Notice",
            href: "/admin/notices",
          })
        );
      }

      if (role === "resident") {
        const [{ data: complaints }, { data: notices }, { data: invoices }] = await Promise.all([
          supabase
            .from("complaints")
            .select("id, title, status")
            .ilike("title", `%${debouncedQuery}%`)
            .limit(4),
          supabase
            .from("notices")
            .select("id, title")
            .ilike("title", `%${debouncedQuery}%`)
            .limit(3),
          supabase
            .from("invoices")
            .select("id, title, amount, status")
            .ilike("title", `%${debouncedQuery}%`)
            .limit(3),
        ]);

        (complaints ?? []).forEach((c) =>
          results.push({
            type: "complaint",
            id: c.id,
            label: c.title,
            description: `Complaint • ${c.status}`,
            href: "/resident/complaints",
          })
        );
        (notices ?? []).forEach((n) =>
          results.push({
            type: "notice",
            id: n.id,
            label: n.title,
            description: "Notice",
            href: "/resident/notices",
          })
        );
        (invoices ?? []).forEach((i) =>
          results.push({
            type: "invoice",
            id: i.id,
            label: i.title ?? `Invoice #${i.id.slice(-6)}`,
            description: `₹${i.amount} • ${i.status}`,
            href: "/resident/payments",
          })
        );
      }

      return results;
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 5_000,
  });

  const handleSelect = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      navigate(href);
    },
    [navigate]
  );

  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, []);

  const iconFor: Record<DbResult["type"], React.ElementType> = {
    complaint: AlertCircle,
    notice: Bell,
    resident: Users,
    invoice: CreditCard,
  };

  return (
    <>
      {/* Search trigger button in header */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 h-9 px-3 rounded-lg border border-input bg-background text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors w-64"
        aria-label="Open search (⌘K)"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Search anything...</span>
        <kbd className="hidden sm:flex items-center gap-0.5 text-xs text-muted-foreground/60 font-mono border border-border rounded px-1">
          <span>⌘</span><span>K</span>
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search pages, features, residents, complaints..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {/* Navigation results */}
            {filteredNav.length > 0 && (
              <CommandGroup heading="Navigation">
                {filteredNav.map((entry) => (
                  <CommandItem
                    key={entry.href}
                    value={entry.href}
                    onSelect={() => handleSelect(entry.href)}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted shrink-0">
                      <entry.icon className="h-4 w-4 text-foreground/60" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{entry.label}</p>
                      {entry.description && (
                        <p className="text-xs text-muted-foreground truncate">{entry.description}</p>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* DB search results */}
            {debouncedQuery.length >= 2 && (
              <>
                {filteredNav.length > 0 && dbResults && dbResults.length > 0 && (
                  <CommandSeparator />
                )}
                {isFetching && (
                  <div className="flex items-center justify-center py-4 text-muted-foreground text-sm gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching...
                  </div>
                )}
                {!isFetching && dbResults && dbResults.length > 0 && (
                  <CommandGroup heading="Results">
                    {dbResults.map((result) => {
                      const Icon = iconFor[result.type];
                      return (
                        <CommandItem
                          key={`${result.type}-${result.id}`}
                          value={`${result.type}-${result.id}`}
                          onSelect={() => handleSelect(result.href)}
                          className="flex items-center gap-3 cursor-pointer"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 shrink-0">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{result.label}</p>
                            {result.description && (
                              <p className="text-xs text-muted-foreground">{result.description}</p>
                            )}
                          </div>
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
              </>
            )}

            {/* Empty state */}
            {!isFetching && filteredNav.length === 0 && (!dbResults || dbResults.length === 0) && (
              <CommandEmpty>
                <div className="flex flex-col items-center gap-2 py-6">
                  <Search className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No results for "{query}"</p>
                  <p className="text-xs text-muted-foreground/60">Try searching for a page name or keyword</p>
                </div>
              </CommandEmpty>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
