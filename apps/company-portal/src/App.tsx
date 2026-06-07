import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { CompanyLayout } from "@/components/layout/CompanyLayout";

// ─── Pages ───────────────────────────────────────────────────────
const LoginPage         = lazy(() => import("./pages/auth/LoginPage"));
const DashboardPage     = lazy(() => import("./pages/dashboard/DashboardPage"));
const SocietiesPage     = lazy(() => import("./pages/societies/SocietiesPage"));
const OnboardPage       = lazy(() => import("./pages/societies/OnboardPage"));
const SocietyDetailPage = lazy(() => import("./pages/societies/SocietyDetailPage"));
const BillingPage       = lazy(() => import("./pages/billing/BillingPage"));
const AnnouncementsPage = lazy(() => import("./pages/announcements/AnnouncementsPage"));
const SupportPage       = lazy(() => import("./pages/support/SupportPage"));
const AuditLogPage      = lazy(() => import("./pages/audit/AuditLogPage"));
const TeamPage          = lazy(() => import("./pages/team/TeamPage"));
const SettingsPage      = lazy(() => import("./pages/settings/SettingsPage"));

// ─── Auth guard ───────────────────────────────────────────────────

function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user || !profile) return <Navigate to="/login" replace />;
  if (profile.role !== "super_admin") return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AuthInit({ children }: { children: React.ReactNode }) {
  useAuth(); // initialises auth state
  return <>{children}</>;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f17]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        <p className="text-slate-500 text-sm">Loading Nestlink Portal…</p>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <AuthInit>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected — super_admin only */}
            <Route
              element={
                <SuperAdminGuard>
                  <CompanyLayout />
                </SuperAdminGuard>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="/societies"      element={<SocietiesPage />} />
              <Route path="/societies/new"  element={<OnboardPage />} />
              <Route path="/societies/:id"  element={<SocietyDetailPage />} />
              <Route path="/billing"        element={<BillingPage />} />
              <Route path="/announcements"  element={<AnnouncementsPage />} />
              <Route path="/support"        element={<SupportPage />} />
              <Route path="/audit"          element={<AuditLogPage />} />
              <Route path="/team"           element={<TeamPage />} />
              <Route path="/settings"       element={<SettingsPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthInit>
    </BrowserRouter>
  );
}
