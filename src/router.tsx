import * as React from "react";
import {
  Navigate,
  Outlet,
  RouterProvider,
  createBrowserRouter,
} from "react-router-dom";
import { Layout } from "@/components/Layout";
import { LoginPage } from "@/pages/Login";
import { DashboardPage } from "@/pages/Dashboard";
import { UsersPage } from "@/pages/Users";
import { CodesPage } from "@/pages/Codes";
import { BillsPage } from "@/pages/Bills";
import { AuditPage } from "@/pages/Audit";
import { AdminsPage } from "@/pages/Admins";
import { PricingPage } from "@/pages/Pricing";
import { NotFoundPage } from "@/pages/NotFound";
import { useSessionStore } from "@/store/session";

/** 已登录才能进的子路由 */
function ProtectedLayout(): React.ReactElement {
  const authorized = useSessionStore((s) => s.authorized);
  const loading = useSessionStore((s) => s.loading);
  if (!authorized) {
    return <Navigate to="/login" replace />;
  }
  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-sm text-muted-foreground">
        正在校验登录态…
      </div>
    );
  }
  return <Outlet />;
}

/** 仅 owner 可访问(2026-08-06 M3):非 owner 自动跳回 / */
function OwnerOnly({ children }: { children: React.ReactElement }): React.ReactElement {
  const me = useSessionStore((s) => s.me);
  if (!me || me.role !== "owner") {
    return <Navigate to="/" replace />;
  }
  return children;
}

/** 已登录就不该再看到 login → 直接跳 / */
function GuestOnly({ children }: { children: React.ReactElement }): React.ReactElement {
  const authorized = useSessionStore((s) => s.authorized);
  if (authorized) {
    return <Navigate to="/" replace />;
  }
  return children;
}

const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <GuestOnly>
        <LoginPage />
      </GuestOnly>
    ),
  },
  {
    element: <ProtectedLayout />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: "users", element: <UsersPage /> },
          { path: "codes", element: <CodesPage /> },
          { path: "bills", element: <BillsPage /> },
          { path: "pricing", element: <PricingPage /> },
          { path: "audit", element: <AuditPage /> },
          {
            path: "admins",
            element: (
              <OwnerOnly>
                <AdminsPage />
              </OwnerOnly>
            ),
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);

export function AppRouter(): React.ReactElement {
  return <RouterProvider router={router} />;
}
