import { Outlet } from "react-router-dom";
import { SuperAdminSidebar } from "./SuperAdminSidebar";
import { Toaster } from "sonner";
import { ShieldCheck } from "lucide-react";

export function SuperAdminLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <SuperAdminSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-violet-900/30 bg-slate-950 px-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-violet-400" />
            <span className="text-xs font-semibold text-violet-400 uppercase tracking-widest">
              Platform Control
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-500">System operational</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-slate-950">
          <Outlet />
        </main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
}
