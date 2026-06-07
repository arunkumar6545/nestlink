import { Outlet } from "react-router-dom";
import { CompanySidebar } from "./CompanySidebar";
import { Toaster } from "sonner";

export function CompanyLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0f0f17]">
      <CompanySidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
