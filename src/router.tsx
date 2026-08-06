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
import { AuditPage } from "@/pages/Audit";
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
          { path: "audit", element: <AuditPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);

export function AppRouter(): React.ReactElement {
  return <RouterProvider router={router} />;
}