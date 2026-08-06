/**
 * Login 页(2026-08-05 M2)
 *
 * - 用户名密码 + 登录按钮
 * - 错误提示(分类):网络 / 凭据错 / 账号锁定 / 服务异常
 * - 提交成功后 → 跳 "/"(仪表盘)
 * - 已登录 → GuestOnly 守卫会重定向回 /
 *
 * 设计:居中卡片,最大宽度 380,深色背景渐变,品牌色顶条
 */

import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import { useSessionStore } from "@/store/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiClientError } from "@/api/client";

function classifyError(err: unknown): {
  title: string;
  description: string;
} {
  if (err instanceof ApiClientError) {
    if (err.code === "ADMIN_ACCOUNT_LOCKED" || err.httpStatus === 423) {
      return {
        title: "账号已锁定",
        description:
          "连续登录失败次数过多,账号已被临时锁定。请联系超级管理员或在 admin_users 表中将 status 改回 active。",
      };
    }
    if (
      err.code === "ADMIN_INVALID_CREDENTIALS" ||
      err.httpStatus === 401 ||
      err.httpStatus === 403
    ) {
      return {
        title: "凭据无效",
        description: "用户名或密码错误,请检查后重试。",
      };
    }
    if (err.code === "NETWORK_ERROR" || err.httpStatus === 0) {
      return {
        title: "后端不可达",
        description: "无法连接到 PrismaticaAPI,请检查网络或后端服务。",
      };
    }
    return {
      title: `登录失败(${err.httpStatus || "ERROR"})`,
      description: err.message || "请稍后再试。",
    };
  }
  if (err instanceof Error) {
    return { title: "登录失败", description: err.message };
  }
  return { title: "登录失败", description: "未知错误,请稍后再试。" };
}

export function LoginPage(): React.ReactElement {
  const navigate = useNavigate();
  const login = useSessionStore((s) => s.login);
  const loading = useSessionStore((s) => s.loading);
  const sessionError = useSessionStore((s) => s.error);
  const [username, setUsername] = React.useState("root");
  const [password, setPassword] = React.useState("");
  const [submitError, setSubmitError] = React.useState<{
    title: string;
    description: string;
  } | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setSubmitError({
        title: "请输入完整",
        description: "用户名与密码不能为空。",
      });
      return;
    }
    setSubmitError(null);
    try {
      await login(username.trim(), password);
      // 登录成功 → 跳到首页
      navigate("/", { replace: true });
    } catch (err) {
      setSubmitError(classifyError(err));
    }
  };

  const errorToShow = submitError ?? (sessionError ? { title: "登录失败", description: sessionError } : null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-secondary px-4">
      <Card className="w-full max-w-[380px] overflow-hidden border-0 shadow-xl">
        {/* 顶条品牌色 */}
        <div className="h-1.5 bg-primary" />
        <CardHeader className="space-y-2 pt-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl">Prismatica Admin</CardTitle>
          </div>
          <CardDescription>
            使用管理员账号登录管理后台。首次部署默认账号 <span className="font-mono">root</span>。
          </CardDescription>
        </CardHeader>

        <CardContent className="pb-6">
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                autoFocus
                placeholder="root"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            {errorToShow && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                <div>
                  <div className="font-medium">{errorToShow.title}</div>
                  <div className="text-destructive/90">
                    {errorToShow.description}
                  </div>
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !username.trim() || !password}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  登录中…
                </>
              ) : (
                "登录"
              )}
            </Button>

            <p className="pt-2 text-center text-xs text-muted-foreground">
              所有登录尝试均会写入审计日志。cookie 有效期由 ADMIN_COOKIE_MAX_AGE 控制。
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
