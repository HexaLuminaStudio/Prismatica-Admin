/**
 * 管理员账号管理页(2026-08-18 UI 优化)
 *
 * - 列表(过滤 username/status/role,分页)
 * - 行操作:锁定 / 解锁 / 重置密码(返回一次性明文)/ 软删除(二次确认)
 * - 顶部「+ 新建账号」弹窗
 * - 仅 owner 可见(Layout 已过滤 + 客户端路由守卫)
 */
import * as React from "react";
import {
  UserCog,
  Search,
  RefreshCcw,
  Plus,
  Loader2,
  AlertTriangle,
  Lock,
  Unlock,
  KeyRound,
  Trash2,
  Copy,
  Check,
  X,
} from "lucide-react";
import {
  AdminAccountItem,
  AdminResetPasswordResponse,
  AdminRole,
  AdminStatus,
  createAdmin,
  deleteAdmin,
  listAdmins,
  resetAdminPassword,
  updateAdmin,
} from "@/api/admins";
import { ApiClientError } from "@/api/client";
import { useSessionStore } from "@/store/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatDate, copyToClipboard } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { roleLabel } from "@/lib/labels";

const STATUS_BADGE: Record<AdminStatus, "default" | "destructive" | "warning"> = {
  active: "default",
  locked: "destructive",
};

const ROLE_BADGE: Record<AdminRole, "default" | "secondary" | "warning"> = {
  owner: "warning",
  admin: "secondary",
};

const STATUS_OPTIONS: Array<"" | AdminStatus> = ["", "active", "locked"];
const ROLE_OPTIONS: ("" | AdminRole)[] = ["", "admin", "owner"];

export function AdminsPage(): React.ReactElement {
  const me = useSessionStore((s) => s.me);
  const logout = useSessionStore((s) => s.logout);
  const [items, setItems] = React.useState<AdminAccountItem[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState<"" | AdminStatus>("");
  const [filterRole, setFilterRole] = React.useState<"" | AdminRole>("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [resetResult, setResetResult] =
    React.useState<AdminResetPasswordResponse | null>(null);
  const [deleteTarget, setDeleteTarget] =
    React.useState<AdminAccountItem | null>(null);

  // 客户端二次防御:非 owner 直接退回
  React.useEffect(() => {
    if (me && me.role !== "owner") {
      void logout();
    }
  }, [me, logout]);

  const load = React.useCallback(
    async (opts: { reset?: boolean; cursor?: string } = {}) => {
      setLoading(true);
      setError(null);
      try {
        const resp = await listAdmins({
          limit: 50,
          q: q || undefined,
          status: filterStatus || undefined,
          role: filterRole || undefined,
          ...(opts.cursor ? { cursor: opts.cursor } : {}),
        });
        setItems((prev) => (opts.reset ? resp.items : [...prev, ...resp.items]));
        setNextCursor(resp.nextCursor);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "加载失败";
        setError(msg);
        if (e instanceof ApiClientError && e.httpStatus === 403) {
          void logout();
        }
      } finally {
        setLoading(false);
      }
    },
    [q, filterStatus, filterRole, logout]
  );

  React.useEffect(() => {
    void load({ reset: true });
  }, [load]);

  const onToggleStatus = async (a: AdminAccountItem) => {
    const next: AdminStatus = a.status === "active" ? "locked" : "active";
    if (
      !confirm(
        next === "locked"
          ? `确定锁定账号 ${a.username}?该账号会立刻被强制下线`
          : `确定解锁账号 ${a.username}?`
      )
    )
      return;
    try {
      await updateAdmin(a.userId, { status: next });
      setError(`已${next === "locked" ? "锁定" : "解锁"} ${a.username}`);
      void load({ reset: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    }
  };

  const onReset = async (a: AdminAccountItem) => {
    if (
      !confirm(
        `确定重置 ${a.username} 的密码?\n该账号旧 session 会立即失效,新密码仅显示一次。`
      )
    )
      return;
    try {
      const r = await resetAdminPassword(a.userId);
      setResetResult(r);
      void load({ reset: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "重置失败");
    }
  };

  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <UserCog className="h-5 w-5 text-muted-foreground" />
            账号管理
          </h1>
          <p className="page-subtitle">仅 owner 可见 · 管理 admin_users(username / role / status)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus />
            新建账号
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void load({ reset: true })} disabled={loading} aria-label="刷新列表">
            <RefreshCcw className={cn(loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>筛选</CardTitle>
          <CardDescription>按 username 模糊搜索 + status / role 精确筛选</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">搜索</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="username / userId"
                  className="pl-9"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void load({ reset: true });
                  }}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">status</Label>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map((s) => (
                  <Button
                    key={s || "all-s"}
                    size="sm"
                    variant={filterStatus === s ? "default" : "outline"}
                    onClick={() => setFilterStatus(s as typeof filterStatus)}
                    className="h-7"
                  >
                    {s || "全部"}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">role</Label>
              <div className="flex flex-wrap gap-1.5">
                {ROLE_OPTIONS.map((r) => (
                  <Button
                    key={r || "all-r"}
                    size="sm"
                    variant={filterRole === r ? "default" : "outline"}
                    onClick={() => setFilterRole(r as typeof filterRole)}
                    className="h-7"
                  >
                    {r || "全部"}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end border-t pt-3">
            <Button size="sm" onClick={() => void load({ reset: true })} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : null}
              应用筛选
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2.5 pl-4 text-left font-medium">username</th>
                  <th className="py-2.5 text-left font-medium">role</th>
                  <th className="py-2.5 text-left font-medium">status</th>
                  <th className="py-2.5 text-left font-medium">上次登录</th>
                  <th className="py-2.5 text-right font-medium">失败次数</th>
                  <th className="py-2.5 text-left font-medium">创建时间</th>
                  <th className="py-2.5 pr-4 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <EmptyState
                        icon={UserCog}
                        title="暂无账号"
                        description="通过「新建账号」可创建新的管理员账号"
                      />
                    </td>
                  </tr>
                )}
                {items.map((a) => (
                  <tr key={a.userId} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                    <td className="py-2 pl-4 font-medium text-foreground">
                      <div>{a.username}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {a.userId.slice(0, 12)}…
                      </div>
                    </td>
                    <td className="py-2">
                      <Badge variant={ROLE_BADGE[a.role]}>{roleLabel(a.role)}</Badge>
                    </td>
                    <td className="py-2">
                      <Badge variant={STATUS_BADGE[a.status]}>
                        {a.status === "active" ? "正常" : "已锁定"}
                      </Badge>
                    </td>
                    <td className="py-2 text-xs whitespace-nowrap text-muted-foreground">
                      {formatDate(a.lastLoginAt)}
                    </td>
                    <td className="py-2 text-right tabular text-xs text-muted-foreground">
                      {a.failedAttempts}
                    </td>
                    <td className="py-2 text-xs whitespace-nowrap text-muted-foreground">
                      {formatDate(a.createdAt)}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" disabled={loading} onClick={() => void onToggleStatus(a)}>
                          {a.status === "active" ? <Lock /> : <Unlock />}
                          {a.status === "active" ? "锁定" : "解锁"}
                        </Button>
                        <Button size="sm" variant="ghost" disabled={loading} onClick={() => void onReset(a)}>
                          <KeyRound />
                          重置密码
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={loading || me?.userId === a.userId}
                          onClick={() => setDeleteTarget(a)}
                          className="text-muted-foreground hover:text-destructive"
                          title={me?.userId === a.userId ? "不能删除自己" : "软删除"}
                          aria-label="软删除"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {nextCursor && (
            <div className="flex justify-center border-t p-3">
              <Button variant="outline" size="sm" disabled={loading} onClick={() => void load({ cursor: nextCursor })}>
                {loading ? <Loader2 className="animate-spin" /> : null}
                加载更多
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {createOpen && (
        <CreateDialog
          onClose={() => setCreateOpen(false)}
          onDone={async (msg) => {
            setError(msg);
            setCreateOpen(false);
            await load({ reset: true });
          }}
        />
      )}

      {resetResult && (
        <ResetResultDialog data={resetResult} onClose={() => setResetResult(null)} />
      )}

      {deleteTarget && (
        <DeleteDialog
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDone={async (msg) => {
            setError(msg);
            setDeleteTarget(null);
            await load({ reset: true });
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 弹窗:新建账号
// ---------------------------------------------------------------------------

function CreateDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (msg: string) => Promise<void> | void;
}): React.ReactElement {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<AdminRole>("admin");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (username.length < 3) {
      setErr("username 长度必须 ≥ 3");
      return;
    }
    if (password.length < 8) {
      setErr("password 长度必须 ≥ 8");
      return;
    }
    setBusy(true);
    try {
      const r = await createAdmin({ username, password, role });
      await onDone(`已创建账号 ${r.username} (role=${r.role})`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "创建失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="新建管理员账号" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="new-username">username</Label>
          <Input id="new-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="3~64 字符" disabled={busy} autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">初始 password</Label>
          <Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="≥ 8 字符" disabled={busy} />
        </div>
        <div className="space-y-1.5">
          <Label>role</Label>
          <div className="flex gap-2">
            {(["admin", "owner"] as AdminRole[]).map((r) => (
              <Button
                key={r}
                type="button"
                size="sm"
                variant={role === r ? "default" : "outline"}
                onClick={() => setRole(r)}
                disabled={busy}
              >
                {role === r ? <Check /> : null}
                {roleLabel(r)}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">owner 可管理本页所有账号;admin 仅可访问自身相关接口</p>
        </div>
        {err && <div className="text-sm text-destructive">{err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>取消</Button>
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            创建
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// 弹窗:重置密码结果(一次性明文)
// ---------------------------------------------------------------------------

function ResetResultDialog({
  data,
  onClose,
}: {
  data: AdminResetPasswordResponse;
  onClose: () => void;
}): React.ReactElement {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    const ok = await copyToClipboard(data.newPassword);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } else {
      window.alert("复制失败,请手动选中并复制");
    }
  };

  return (
    <Modal title="重置密码成功" onClose={onClose}>
      <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
        ⚠️ 明文密码仅在此窗口显示一次,请立即复制并通过安全渠道交付给账号持有人。
      </div>
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">
          userId: <span className="font-mono">{data.userId}</span>
        </div>
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
          <span className="flex-1 font-mono text-sm tabular text-foreground">{data.newPassword}</span>
          <Button type="button" size="icon-sm" variant="ghost" onClick={() => void copy()} aria-label="复制">
            {copied ? <Check className="text-emerald-500" /> : <Copy />}
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          该账号所有现有 session 已立即失效,下次登录需用新密码。
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button onClick={onClose}>已复制,关闭</Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// 弹窗:软删除(二次确认)
// ---------------------------------------------------------------------------

function DeleteDialog({
  target,
  onClose,
  onDone,
}: {
  target: AdminAccountItem;
  onClose: () => void;
  onDone: (msg: string) => Promise<void> | void;
}): React.ReactElement {
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const matched = confirm.trim() === target.username;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matched) {
      setErr("username 不匹配,请重新输入");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await deleteAdmin(target.userId, confirm.trim());
      await onDone(`已软删除账号 ${target.username}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "删除失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`软删除 ${target.username}`} onClose={onClose}>
      <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
        ⚠️ 操作不可撤销(只软删除)。系统会拒绝删除最后一个 active owner,也不能删除自己。
        <br />
        username 一旦软删将<strong>永久占用</strong>,无法被同名账号再次使用。
      </div>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="confirm-username">
            请输入目标 username <span className="font-mono">{target.username}</span> 以继续
          </Label>
          <Input id="confirm-username" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={busy} autoFocus />
        </div>
        {err && <div className="text-sm text-destructive">{err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>取消</Button>
          <Button type="submit" variant="destructive" disabled={busy || !matched}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            确认软删除
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// 通用 Modal(与 Codes / Users 保持一致风格)
// ---------------------------------------------------------------------------

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">{title}</div>
          <Button type="button" size="icon-sm" variant="ghost" onClick={onClose} aria-label="关闭">
            <X />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}