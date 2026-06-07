import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy } from "react";
import { Toaster } from "sonner";
import { AppLayout } from "./components/layout/AppLayout";
import { SuperAdminLayout } from "./components/superadmin/SuperAdminLayout";
import { useAuth } from "./hooks/useAuth";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import { ConnectivityBanner } from "./components/shared/ConnectivityBanner";
import Login from "./pages/auth/Login";

// ─── Admin pages ─────────────────────────────────────────────────
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const ResidentsPage = lazy(() => import("./pages/admin/residents/ResidentsPage"));
const NoticesPage = lazy(() => import("./pages/admin/notices/NoticesPage"));
const ComplaintsPage = lazy(() => import("./pages/admin/complaints/ComplaintsPage"));
const InvoicesPage = lazy(() => import("./pages/admin/invoices/InvoicesPage"));
const AmenitiesAdminPage = lazy(() => import("./pages/admin/amenities/AmenitiesPage"));
const GuardsPage = lazy(() => import("./pages/admin/guards/GuardsPage"));
const CreateSocietyPage = lazy(() => import("./pages/admin/societies/CreateSocietyPage"));
const UsersPage = lazy(() => import("./pages/admin/users/UsersPage"));

// ─── Resident pages ──────────────────────────────────────────────
const ResidentHome = lazy(() => import("./pages/resident/ResidentHome"));
const VisitorsPage = lazy(() => import("./pages/resident/visitors/VisitorsPage"));
const PaymentsPage = lazy(() => import("./pages/resident/payments/PaymentsPage"));
const ResidentComplaintsPage = lazy(() => import("./pages/resident/complaints/ResidentComplaintsPage"));
const ResidentNoticesPage = lazy(() => import("./pages/resident/notices/ResidentNoticesPage"));
const ResidentAmenitiesPage = lazy(() => import("./pages/resident/amenities/ResidentAmenitiesPage"));
const StaffPage = lazy(() => import("./pages/resident/staff/StaffPage"));

// ─── Guard pages ─────────────────────────────────────────────────
const GuardPage = lazy(() => import("./pages/guard/GuardPage"));

// ─── Groups pages (shared by admin + resident) ───────────────────
const GroupsPage = lazy(() => import("./pages/groups/GroupsPage"));
const GroupChatPage = lazy(() => import("./pages/groups/GroupChatPage"));
const GroupManagePage = lazy(() => import("./pages/groups/GroupManagePage"));

// ─── Members + DM + Call ─────────────────────────────────────────
const MemberDirectoryPage = lazy(() => import("./pages/members/MemberDirectoryPage"));
const MemberProfilePage   = lazy(() => import("./pages/members/MemberProfilePage"));
const MessagesPage        = lazy(() => import("./pages/messages/MessagesPage"));
const DirectChatPage      = lazy(() => import("./pages/messages/DirectChatPage"));
const CallPage            = lazy(() => import("./pages/call/CallPage"));

// ─── HOA Roles + Marketplace + Documents ────────────────────────
const HOARolesPage       = lazy(() => import("./pages/admin/roles/HOARolesPage"));
const MarketplacePage    = lazy(() => import("./pages/marketplace/MarketplacePage"));
const DocumentVaultPage  = lazy(() => import("./pages/documents/DocumentVaultPage"));

// ─── Super admin pages ───────────────────────────────────────────
const SuperAdminDashboard = lazy(() => import("./pages/superadmin/SuperAdminDashboard"));
const SASocietiesPage = lazy(() => import("./pages/superadmin/SocietiesPage"));
const OnboardSocietyPage = lazy(() => import("./pages/superadmin/OnboardSocietyPage"));
const GlobalUsersPage = lazy(() => import("./pages/superadmin/GlobalUsersPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 2, retry: 1 },
  },
});

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

function AuthGuard({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
}) {
  const { user, profile, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <Navigate to="/login" replace />;

  const role = profile.role;

  // Redirect to the correct portal if hitting wrong role's path
  if (!allowedRoles.includes(role)) {
    if (role === "super_admin") return <Navigate to="/superadmin" replace />;
    if (["admin","hoa_president","hoa_secretary","hoa_treasurer","hoa_member"].includes(role)) return <Navigate to="/admin" replace />;
    if (role === "guard") return <Navigate to="/guard" replace />;
    return <Navigate to="/resident" replace />;
  }

  return <>{children}</>;
}

const HOA_ROLES = ["admin", "hoa_president", "hoa_secretary", "hoa_treasurer", "hoa_member"];

function RoleRedirect() {
  const { user, profile, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user || !profile) return <Navigate to="/login" replace />;
  if (profile.role === "super_admin") return <Navigate to="/superadmin" replace />;
  if (HOA_ROLES.includes(profile.role)) return <Navigate to="/admin" replace />;
  if (profile.role === "guard") return <Navigate to="/guard" replace />;
  return <Navigate to="/resident" replace />;
}

function AppWithAuth() {
  useAuth();
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* ── Super Admin portal (dark purple theme) ────────── */}
          <Route
            element={
              <AuthGuard allowedRoles={["super_admin"]}>
                <SuperAdminLayout />
              </AuthGuard>
            }
          >
            <Route path="/superadmin" element={<SuperAdminDashboard />} />
            <Route path="/superadmin/societies" element={<SASocietiesPage />} />
            <Route path="/superadmin/onboard" element={<OnboardSocietyPage />} />
            <Route path="/superadmin/users" element={<GlobalUsersPage />} />
          </Route>

          {/* ── Admin + HOA portal ─────────────────────────────── */}
          <Route
            element={
              <AuthGuard allowedRoles={["admin","hoa_president","hoa_secretary","hoa_treasurer","hoa_member"]}>
                <AppLayout />
              </AuthGuard>
            }
          >
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/residents" element={<ResidentsPage />} />
            <Route path="/admin/notices" element={<NoticesPage />} />
            <Route path="/admin/complaints" element={<ComplaintsPage />} />
            <Route path="/admin/invoices" element={<InvoicesPage />} />
            <Route path="/admin/amenities" element={<AmenitiesAdminPage />} />
            <Route path="/admin/guards" element={<GuardsPage />} />
            <Route path="/admin/societies/new" element={<CreateSocietyPage />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/hoa-roles" element={<HOARolesPage />} />
            <Route path="/admin/groups" element={<GroupsPage />} />
            <Route path="/admin/groups/:groupId" element={<GroupChatPage />} />
            <Route path="/admin/groups/:groupId/manage" element={<GroupManagePage />} />
            {/* Shared community routes */}
            <Route path="/members" element={<MemberDirectoryPage />} />
            <Route path="/members/:userId" element={<MemberProfilePage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/:conversationId" element={<DirectChatPage />} />
            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route path="/documents" element={<DocumentVaultPage />} />
          </Route>

          {/* ── Resident portal ───────────────────────────────── */}
          <Route
            element={
              <AuthGuard allowedRoles={["resident"]}>
                <AppLayout />
              </AuthGuard>
            }
          >
            <Route path="/resident" element={<ResidentHome />} />
            <Route path="/resident/visitors" element={<VisitorsPage />} />
            <Route path="/resident/payments" element={<PaymentsPage />} />
            <Route path="/resident/complaints" element={<ResidentComplaintsPage />} />
            <Route path="/resident/notices" element={<ResidentNoticesPage />} />
            <Route path="/resident/amenities" element={<ResidentAmenitiesPage />} />
            <Route path="/resident/staff" element={<StaffPage />} />
            <Route path="/resident/groups" element={<GroupsPage />} />
            <Route path="/resident/groups/:groupId" element={<GroupChatPage />} />
            <Route path="/resident/groups/:groupId/manage" element={<GroupManagePage />} />
            {/* Shared community routes */}
            <Route path="/members" element={<MemberDirectoryPage />} />
            <Route path="/members/:userId" element={<MemberProfilePage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/:conversationId" element={<DirectChatPage />} />
            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route path="/documents" element={<DocumentVaultPage />} />
          </Route>

          {/* ── Guard portal ──────────────────────────────────── */}
          <Route
            path="/guard"
            element={
              <AuthGuard allowedRoles={["guard"]}>
                <GuardPage />
              </AuthGuard>
            }
          />

          {/* ── Video / voice call (full screen, no layout) ──── */}
          <Route path="/call/:callId" element={<CallPage />} />

          {/* Smart redirect from root based on role */}
          <Route path="/" element={<RoleRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppWithAuth />
        <ConnectivityBanner />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
