/**
 * Layout(2026-08-18 重构):
 *  - 左侧导航:品牌区 + 菜单分组 + 角色徽章 + 版本号
 *  - 顶栏:面包屑 + 管理员胶囊(头像 + 操作)
 *  - <Outlet /> 渲染子路由
 *  - Toast 容器挂载根
 */
import * as React from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Receipt,
  ScrollText,
  UserCog,
  LogOut,
  ChevronRight,
  KeyRound,
  BadgeDollarSign,
  Sparkles,
} from "lucide-react";
import { useSessionStore } from "@/store/session";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { ToastContainer } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  ownerOnly?: boolean;
  /** 简短说明,用于 tooltip / 辅助 */
  description?: string;
}

const NAV: NavItem[] = [
  { to: "/", label: "仪表盘", icon: LayoutDashboard, description: "KPI 与最近活动" },
  { to: "/users", label: "用户管理", icon: Users, description: "账号 / 余额 / 设备" },
  { to: "/bills", label: "账单管理", icon: Receipt, description: "订单流水与结算" },
  { to: "/pricing", label: "定价中心", icon: BadgeDollarSign, description: "价格版本与发布" },
  { to: "/audit", label: "审计日志", icon: ScrollText, description: "管理员操作记录" },
  { to: "/admins", label: "账号管理", icon: UserCog, ownerOnly: true, description: "owner only" },
];

function getInitials(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "?";
  if (/[\u4e00-\u9fa5]/.test(trimmed)) {
    return trimmed.slice(-2);
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function RoleBadge({ role }: { role?: string }): React.ReactElement {
  if (role === "owner") {
    return (
      <Badge variant="subtle" className="gap-1">
        <Sparkles className="h-3 w-3" />
        超级管理员
      </Badge>
    );
  }
  return <Badge variant="muted">管理员</Badge>;
}

export function Layout(): React.ReactElement {
  const me = useSessionStore((s) => s.me);
  const logout = useSessionStore((s) => s.logout);
  const navigate = useNavigate();
  const [pwdOpen, setPwdOpen] = React.useState(false);

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const visibleNav = NAV.filter(
    (item) => !item.ownerOnly || me?.role === "owner"
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* ===== 侧栏 ===== */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
        {/* 品牌区 */}
        <Link to="/" className="flex h-16 items-center gap-2.5 border-b px-5 transition-colors hover:bg-muted/40">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">Prismatica</div>
            <div className="text-[11px] text-muted-foreground">运营管理后台</div>
          </div>
        </Link>

        {/* 菜单 */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3 scrollbar-thin">
          <div className="px-2 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            主导航
          </div>
          {visibleNav.map(({ to, label, icon: Icon, description }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "group flex items-start gap-3 rounded-md px-3 py-2 text-sm transition-all",
                  isActive
                    ? "bg-primary/10 text-primary font-medium shadow-[inset_2px_0_0_0_hsl(var(--primary))]"
                    : "text-foreground/80 hover:bg-muted hover:text-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div>{label}</div>
                    {description && (
                      <div className="mt-0.5 text-[11px] font-normal text-muted-foreground">
                        {description}
                      </div>
                    )}
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* 版本号 */}
        <div className="border-t p-3">
          <div className="rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
            <div className="font-medium text-foreground">v0.1.0 · 内测</div>
            <div className="mt-0.5">© Prismatica 运营管理</div>
          </div>
        </div>
      </aside>

      {/* ===== 右侧主区 ===== */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 顶栏 */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-card/60 px-4 backdrop-blur md:px-6">
          {/* 面包屑(简单版:首页 + 当前页标题通过路由判断) */}
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <Link
              to="/"
              className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              首页
            </Link>
            <ChevronRight className="hidden h-3.5 w-3.5 text-muted-foreground sm:inline" />
            <span className="truncate font-medium text-foreground">管理后台</span>
          </div>

          {me ? (
            <div className="flex items-center gap-2">
              {/* 管理员胶囊 */}
              <div className="flex items-center gap-2.5 rounded-full border bg-background py-1 pl-1 pr-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                  {getInitials(me.username)}
                </span>
                <div className="hidden text-right leading-tight md:block">
                  <div className="flex items-center justify-end gap-1.5 text-[13px] font-medium text-foreground">
                    {me.username}
                    <RoleBadge role={me.role} />
                  </div>
                  {me.lastLoginAt ? (
                    <div className="text-[11px] text-muted-foreground">
                      上次登录 {new Date(me.lastLoginAt).toLocaleString("zh-CN", { hour12: false })}
                    </div>
                  ) : null}
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setPwdOpen(true)}
                aria-label="修改密码"
                title="修改密码"
                className="text-muted-foreground hover:text-foreground"
              >
                <KeyRound />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onLogout}
                aria-label="登出"
                title="登出"
                className="text-muted-foreground hover:text-destructive"
              >
                <LogOut />
              </Button>
            </div>
          ) : (
            <span className="text-muted-foreground text-xs">未登录</span>
          )}
        </header>

        {/* 主内容 */}
        <main className="flex-1 overflow-auto bg-background scrollbar-thin">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-6">
            <Outlet />
          </div>
        </main>
      </div>

      {pwdOpen && <ChangePasswordDialog onClose={() => setPwdOpen(false)} />}

      <ToastContainer />
    </div>
  );
}