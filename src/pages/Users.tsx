/**
 * Users 管理页(2026-08-07 运营管理增强)
 *
 * 功能:
 *  - 列表:多维筛选(status / tier / 时间范围 / 关键词)
 *  - 分页:cursor
 *  - 行操作:勾选 → 批量改状态 / 重置密码 / 软删除
 *  - 行展开 → 抽屉式详情(独立 UserDetailDrawer)
 *  - CSV 导出(带当前筛选)
 *  - 顶部「新建用户」按钮 → 邮箱 + 初始密码 + tier/status
 */

import * as React from "react";
import {
  Users as UsersIcon,
  Search,
  RefreshCcw,
  Loader2,
  AlertTriangle,
  Download,
  FilterX,
  Plus,
  Trash2,
  KeyRound,
  Pause,
  Play,
  CheckSquare,
  Square,
} from "lucide-react";
import { useUsersStore, EMPTY_FILTERS } from "@/store/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate, cn, downloadCsv } from "@/lib/utils";
import { userTierLabel, userStatusLabel } from "@/lib/labels";
import { UserDetailDrawer } from "@/components/UserDetailDrawer";
import { classifyError } from "@/lib/errorMessages";
import { toast } from "@/components/Toast";

const STATUS_OPTIONS = [
  { value: "", label: "全部状态" },
  { value: "active", label: "正常" },
  { value: "suspended", label: "已停用" },
  { value: "expired", label: "已过期" },
  { value: "banned", label: "已封禁" },
  { value: "deleted", label: "已删除" },
] as const;

const TIER_OPTIONS = [
  { value: "", label: "全部等级" },
  { value: "free", label: "免费" },
  { value: "pro", label: "Pro" },
  { value: "team", label: "Team" },
  { value: "beta", label: "内测" },
  { value: "beta_pro", label: "内测 Pro" },
  { value: "paid", label: "付费" },
] as const;

function tierVariant(t: string): "default" | "secondary" | "outline" {
  if (t === "paid" || t === "beta_pro" || t === "pro" || t === "team") return "default";
  if (t === "beta" || t === "trial") return "outline";
  return "secondary";
}

function statusVariant(
  s: string
): "default" | "destructive" | "outline" {
  if (s === "active") return "default";
  if (s === "deleted" || s === "banned") return "destructive";
  return "outline";
}

export function UsersPage(): React.ReactElement {
  const items = useUsersStore((s) => s.items);
  const nextCursor = useUsersStore((s) => s.nextCursor);
  const filters = useUsersStore((s) => s.filters);
  const setFilters = useUsersStore((s) => s.setFilters);
  const resetFilters = useUsersStore((s) => s.resetFilters);
  const loadList = useUsersStore((s) => s.loadList);
  const loadMore = useUsersStore((s) => s.loadMore);
  const listLoading = useUsersStore((s) => s.listLoading);
  const listError = useUsersStore((s) => s.listError);
  const batch = useUsersStore((s) => s.batch);

  const [drawerUserId, setDrawerUserId] = React.useState<string | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const [batchBusy, setBatchBusy] = React.useState<"" | "status" | "reset" | "delete">("");

  React.useEffect(() => {
    void loadList({ reset: true }).catch(() => {
      // 错误已在 store 内记录,这里不再 toast
    });
  }, [loadList]);

  const filtersActive =
    filters.status !== "" ||
    filters.tier !== "" ||
    filters.registeredAfter !== "" ||
    filters.registeredBefore !== "" ||
    filters.keyword.trim() !== "";

  const allSelected = items.length > 0 && items.every((it) => selected[it.userId]);
  const someSelected = items.some((it) => selected[it.userId]);
  const selectedIds = items.filter((it) => selected[it.userId]).map((it) => it.userId);

  const toggleAll = () => {
    if (allSelected) setSelected({});
    else setSelected(Object.fromEntries(items.map((it) => [it.userId, true])));
  };

  const toggleOne = (id: string) => {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  };

  const onExport = async () => {
    setExporting(true);
    try {
      const q = new URLSearchParams();
      if (filters.status) q.set("status", filters.status);
      if (filters.tier) q.set("tier", filters.tier);
      if (filters.registeredAfter)
        q.set("registeredAfter", filters.registeredAfter);
      if (filters.registeredBefore)
        q.set("registeredBefore", filters.registeredBefore);
      if (filters.keyword.trim()) q.set("q", filters.keyword.trim());
      const qs = q.toString();
      await downloadCsv(
        `/v1/admin/export/users.csv${qs ? `?${qs}` : ""}`,
        `users-${new Date().toISOString().slice(0, 10)}.csv`
      );
      toast({ kind: "success", title: "导出已开始" });
    } catch (e) {
      const msg = classifyError(e);
      toast({ kind: "error", title: "导出失败", description: msg.description });
    } finally {
      setExporting(false);
    }
  };

  const onBatch = async (
    action: "update_status" | "reset_password" | "delete",
    status?: string
  ) => {
    if (selectedIds.length === 0) return;
    const confirmMsg =
      action === "delete"
        ? `确定软删除所选 ${selectedIds.length} 个用户?该操作不可撤销(用户将被标记为已删除并强制下线)。`
        : action === "reset_password"
          ? `确定重置所选 ${selectedIds.length} 个用户的密码?所有会话会被撤销。`
          : `确定将所选 ${selectedIds.length} 个用户状态改为「${status}」?`;
    if (!window.confirm(confirmMsg)) return;
    setBatchBusy(action === "update_status" ? "status" : action === "reset_password" ? "reset" : "delete");
    try {
      const r = await batch({ action, userIds: selectedIds, status });
      setSelected({});
      toast({
        kind: r.failedCount === 0 ? "success" : "error",
        title: `批量操作完成:成功 ${r.successCount},失败 ${r.failedCount}`,
      });
    } catch (e) {
      const msg = classifyError(e);
      toast({ kind: "error", title: msg.title, description: msg.description });
    } finally {
      setBatchBusy("");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4" />
              用户管理
            </CardTitle>
            <CardDescription>
              创建 / 搜索 / 筛选 / 改状态 / 赠送 / 重置密码 / 软删除 · 批量操作
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void onExport()}
              disabled={exporting || listLoading}
            >
              {exporting ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1 h-4 w-4" />
              )}
              导出 CSV
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              新建用户
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void loadList({ reset: true })}
              disabled={listLoading}
            >
              <RefreshCcw
                className={cn("h-4 w-4", listLoading && "animate-spin")}
              />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 筛选条 */}
          <div className="grid grid-cols-1 gap-3 rounded-md border bg-muted/20 p-3 md:grid-cols-5">
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="keyword" className="text-xs">
                关键词(邮箱 / displayName / userId)
              </Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="keyword"
                  value={filters.keyword}
                  onChange={(e) => setFilters({ keyword: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void loadList({ reset: true });
                  }}
                  placeholder="支持模糊搜索"
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="status" className="text-xs">
                状态
              </Label>
              <select
                id="status"
                value={filters.status}
                onChange={(e) =>
                  setFilters({
                    status: e.target.value as typeof filters.status,
                  })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="tier" className="text-xs">
                等级
              </Label>
              <select
                id="tier"
                value={filters.tier}
                onChange={(e) =>
                  setFilters({ tier: e.target.value as typeof filters.tier })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {TIER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                size="sm"
                onClick={() => void loadList({ reset: true })}
                disabled={listLoading}
              >
                应用筛选
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  resetFilters();
                  void loadList({ reset: true });
                }}
                disabled={!filtersActive}
              >
                <FilterX className="mr-1 h-4 w-4" />
                清空
              </Button>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="after" className="text-xs">
                注册时间(起)
              </Label>
              <Input
                id="after"
                type="date"
                value={filters.registeredAfter}
                onChange={(e) =>
                  setFilters({ registeredAfter: e.target.value })
                }
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="before" className="text-xs">
                注册时间(止)
              </Label>
              <Input
                id="before"
                type="date"
                value={filters.registeredBefore}
                onChange={(e) =>
                  setFilters({ registeredBefore: e.target.value })
                }
              />
            </div>
            <div className="flex items-end text-xs text-muted-foreground">
              {filtersActive ? (
                <span>已启用筛选条件</span>
              ) : (
                <span>未启用任何筛选</span>
              )}
            </div>
          </div>

          {/* 批量操作条 */}
          {someSelected && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-primary/5 p-2 text-xs">
              <span className="text-muted-foreground">
                已选中 {selectedIds.length} 个用户
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={batchBusy !== ""}
                onClick={() => void onBatch("update_status", "active")}
              >
                <Play className="mr-1 h-3 w-3" />
                启用
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={batchBusy !== ""}
                onClick={() => void onBatch("update_status", "paused")}
              >
                <Pause className="mr-1 h-3 w-3" />
                停用
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={batchBusy !== ""}
                onClick={() => void onBatch("reset_password")}
              >
                <KeyRound className="mr-1 h-3 w-3" />
                重置密码
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={batchBusy !== ""}
                onClick={() => void onBatch("delete")}
              >
                <Trash2 className="mr-1 h-3 w-3" />
                软删除
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={batchBusy !== ""}
                onClick={() => setSelected({})}
              >
                取消选择
              </Button>
            </div>
          )}

          {listError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <div>
                <div className="font-medium">加载失败</div>
                <div>{listError}</div>
              </div>
            </div>
          )}

          {/* 列表 */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-muted-foreground">
                  <th className="py-2 text-left font-medium">
                    <button
                      type="button"
                      className="inline-flex items-center"
                      onClick={toggleAll}
                      aria-label={allSelected ? "取消全选" : "全选"}
                    >
                      {allSelected ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-2 text-left font-medium">用户 ID</th>
                  <th className="py-2 text-left font-medium">用户名</th>
                  <th className="py-2 text-left font-medium">邮箱</th>
                  <th className="py-2 text-left font-medium">等级</th>
                  <th className="py-2 text-left font-medium">状态</th>
                  <th className="py-2 text-right font-medium">余额</th>
                  <th className="py-2 text-right font-medium">设备数</th>
                  <th className="py-2 text-left font-medium">注册时间</th>
                  <th className="py-2 text-left font-medium">最近活跃</th>
                  <th className="py-2 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !listLoading && (
                  <tr>
                    <td
                      colSpan={11}
                      className="py-12 text-center text-muted-foreground"
                    >
                      暂无数据
                    </td>
                  </tr>
                )}
                {items.map((u) => (
                  <tr
                    key={u.userId}
                    className={cn(
                      "border-b hover:bg-accent/40",
                      selected[u.userId] && "bg-primary/5"
                    )}
                  >
                    <td className="py-2">
                      <button
                        type="button"
                        className="inline-flex items-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleOne(u.userId);
                        }}
                        aria-label={selected[u.userId] ? "取消选择" : "选择"}
                      >
                        {selected[u.userId] ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </td>
                    <td
                      className="cursor-pointer py-2 font-mono text-xs"
                      onClick={() => setDrawerUserId(u.userId)}
                    >
                      {u.userId.slice(0, 8)}…
                    </td>
                    <td
                      className="cursor-pointer py-2 font-medium"
                      onClick={() => setDrawerUserId(u.userId)}
                    >
                      {u.displayName || "—"}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {u.email ?? "—"}
                    </td>
                    <td className="py-2">
                      <Badge variant={tierVariant(u.tier)}>
                        {userTierLabel(u.tier)}
                      </Badge>
                    </td>
                    <td className="py-2">
                      <Badge variant={statusVariant(u.status)}>
                        {userStatusLabel(u.status)}
                      </Badge>
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {u.balance.toLocaleString()}
                    </td>
                    <td className="py-2 text-right text-xs">
                      {u.deviceCount}
                    </td>
                    <td className="py-2 text-xs">
                      {formatDate(u.registeredAt ?? u.activatedAt)}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {formatDate(u.lastSeenAt)}
                    </td>
                    <td className="py-2 text-right text-xs">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDrawerUserId(u.userId);
                        }}
                      >
                        详情
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {nextCursor && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                disabled={listLoading}
                onClick={() => void loadMore()}
              >
                {listLoading ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : null}
                加载更多
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <UserDetailDrawer
        userId={drawerUserId}
        onClose={() => setDrawerUserId(null)}
      />

      {createOpen && <CreateUserDialog onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function CreateUserDialog({
  onClose,
}: {
  onClose: () => void;
}): React.ReactElement {
  const createUser = useUsersStore((s) => s.createUser);
  const [form, setForm] = React.useState({
    email: "",
    password: "",
    displayName: "",
    tier: "beta",
    status: "active",
  });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setErr("请输入合法的邮箱");
      return;
    }
    if (form.password.length < 10) {
      setErr("初始密码至少 10 位");
      return;
    }
    setBusy(true);
    try {
      await createUser({
        email: form.email.trim(),
        password: form.password,
        displayName: form.displayName.trim(),
        tier: form.tier,
        status: form.status,
      });
      toast({ kind: "success", title: "用户已创建" });
      onClose();
    } catch (e2) {
      const msg = classifyError(e2);
      setErr(msg.description);
      toast({ kind: "error", title: msg.title, description: msg.description });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-5 shadow-xl">
        <div className="mb-3 text-sm font-semibold">新建用户</div>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="cu-email">邮箱</Label>
            <Input
              id="cu-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              disabled={busy}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cu-password">初始密码(至少 10 位)</Label>
            <Input
              id="cu-password"
              type="text"
              minLength={10}
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              disabled={busy}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cu-displayName">显示名</Label>
            <Input
              id="cu-displayName"
              value={form.displayName}
              onChange={(e) => set("displayName", e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="cu-tier">等级</Label>
              <select
                id="cu-tier"
                value={form.tier}
                onChange={(e) => set("tier", e.target.value)}
                disabled={busy}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {TIER_OPTIONS.filter((o) => o.value).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cu-status">状态</Label>
              <select
                id="cu-status"
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                disabled={busy}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="active">正常</option>
                <option value="paused">已停用</option>
              </select>
            </div>
          </div>
          {err && <div className="text-sm text-destructive">{err}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              取消
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              创建
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}