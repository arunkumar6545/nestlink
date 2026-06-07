import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "@/components/shared/CommandPalette";
import { IncomingCallOverlay } from "@/components/shared/IncomingCallOverlay";
import { Toaster } from "sonner";

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar with global search */}
        <header className="flex h-14 shrink-0 items-center border-b px-6 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <CommandPalette />
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <Toaster richColors position="top-right" />
      {/* Global incoming call notification — registers Realtime subscription */}
      <IncomingCallOverlay />
    </div>
  );
}
