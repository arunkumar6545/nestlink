import { useState } from "react";
import { Check, ChevronDown, Building2, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSocieties } from "@/hooks/useSocieties";
import type { Society } from "@/store/society";

function PlanBadge({ plan }: { plan: Society["plan"] }) {
  const color =
    plan === "enterprise"
      ? "bg-violet-500/20 text-violet-300"
      : plan === "pro"
      ? "bg-sky-500/20 text-sky-300"
      : "bg-slate-500/20 text-slate-400";
  return (
    <span className={cn("text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded", color)}>
      {plan}
    </span>
  );
}

export function SocietySwitcher() {
  const { societies, activeSociety, activeSocietyId, setActiveSociety, isLoading } =
    useSocieties();
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-2 py-2 text-sidebar-foreground/50">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">Loading societies…</span>
      </div>
    );
  }

  if (!activeSociety && societies.length === 0) {
    return (
      <div className="flex items-center gap-2 px-2 py-2 rounded-lg border border-dashed border-sidebar-border text-sidebar-foreground/40 text-xs">
        <Building2 className="h-4 w-4 shrink-0" />
        No society linked
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors",
          "hover:bg-sidebar-accent text-sidebar-foreground",
          open && "bg-sidebar-accent"
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {/* Society avatar */}
        {activeSociety?.logo_url ? (
          <img
            src={activeSociety.logo_url}
            alt={activeSociety.name}
            className="h-8 w-8 rounded-md object-cover shrink-0"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary shrink-0">
            <Building2 className="h-4 w-4 text-white" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-sidebar-foreground truncate leading-tight">
            {activeSociety?.name ?? "Select society"}
          </p>
          <p className="text-xs text-sidebar-foreground/50 truncate leading-tight">
            {activeSociety?.city ?? ""}
          </p>
        </div>

        <ChevronDown
          className={cn(
            "h-4 w-4 text-sidebar-foreground/40 shrink-0 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
            <div className="px-3 pt-3 pb-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Your societies
              </p>
            </div>
            <ul role="listbox" className="max-h-64 overflow-y-auto p-1">
              {societies.map((s) => (
                <li
                  key={s.id}
                  role="option"
                  aria-selected={s.id === activeSocietyId}
                  onClick={() => {
                    setActiveSociety(s.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors",
                    s.id === activeSocietyId
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-accent text-foreground"
                  )}
                >
                  {s.logo_url ? (
                    <img
                      src={s.logo_url}
                      alt={s.name}
                      className="h-8 w-8 rounded-md object-cover shrink-0"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted shrink-0">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <PlanBadge plan={s.plan} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{s.address}</p>
                  </div>
                  {s.id === activeSocietyId && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </li>
              ))}
            </ul>

            {/* Create new society — admins only */}
            <div className="border-t p-1">
              <button
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                onClick={() => {
                  setOpen(false);
                  window.location.href = "/admin/societies/new";
                }}
              >
                <Plus className="h-4 w-4" />
                Add new society
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
