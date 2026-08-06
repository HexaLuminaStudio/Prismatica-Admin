/**
 * Layout(2026-08-05 M2):
 *  - 左侧导航:仪表盘 / 用户管理 / 凭证签发 / 审计日志
 *  - 顶栏:产品名 + 当前管理员 + 登出按钮
 *  - <Outlet /> 渲染子路由
 */

import * as React from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Ticket,
  Receipt,
  ScrollText,
  UserCog,
  LogOut,
  ChevronRight,
  KeyRound,
} from "lucide-react";
import { useSessionStore } from "@/store/session";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  ownerOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "仪表盘", icon: LayoutDashboard },
  { to: "/users", label: "用户管理", icon: Users },
  { to: "/codes", label: "凭证签发", icon: Ticket },
  { to: "/bills", label: "账单管理", icon: Receipt },
  { to: "/audit", label: "审计日志", icon: ScrollText },
  { to: "/admins", label: "账号管理", icon: UserCog, ownerOnly: true },
];

export function Layout(): React.ReactElement {
  const me = useSessionStore((s) => s.me);
  const logout = useSessionStore((s) => s.logout);
  const navigate = useNavigate();
  const [pwdOpen, setPwdOpen] = React.useState(false);

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* 侧栏 */}
      <aside className="hidden w-60 border-r bg-card md:flex md:flex-col">
        <div className="flex h-14 items-center border-b px-5 font-semibold tracking-tight">
          <span className="text-primary">Prismatica</span>
          <span className="ml-2 text-muted-foreground text-sm font-normal">
            Admin
          </span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.filter(
            (item) => !item.ownerOnly || me?.role === "owner"
          ).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/80 hover:bg-accent hover:text-accent-foreground"
                )
              }
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-3 text-xs text-muted-foreground">
          v0.1.0 · 内测
        </div>
      </aside>

      {/* 右侧主区 */}
      <div className="flex flex-1 flex-col">
        {/* 顶栏 */}
        <header className="flex h-14 items-center justify-between border-b bg-card px-6">
          <div className="flex items-center gap-2 text-sm">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              首页
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-foreground">管理后台</span>
          </div>
          <div className="flex items-center gap-3">
            {me ? (
              <>
                <div className="text-right text-xs leading-tight">
                  <div className="font-medium">{me.username}</div>
                  <div className="text-muted-foreground">
                    role: {me.role}
                    {me.lastLoginAt
                      ? ` · 上次登录 ${new Date(me.lastLoginAt).toLocaleString()}`
                      : ""}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPwdOpen(true)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <KeyRound className="mr-1 h-4 w-4" />
                  修改密码
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onLogout}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="mr-1 h-4 w-4" />
                  登出
                </Button>
              </>
            ) : (
              <span className="text-muted-foreground text-xs">未登录</span>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-background p-6 scrollbar-thin">
          <Outlet />
        </main>
      </div>

      {pwdOpen && (
        <ChangePasswordDialog onClose={() => setPwdOpen(false)} />
      )}
    </div>
  );
}
