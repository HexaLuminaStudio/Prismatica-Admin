/**
 * Users 管理页(2026-08-06 P0-B M2/M3 重构)
 *
 * 功能:
 *  - 列表:多维筛选(status / tier / 时间范围 / 关键词)
 *  - 分页:cursor
 *  - 行展开 → 抽屉式详情(独立 UserDetailDrawer)
 *  - CSV 导出(带当前筛选)
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
  { value: "suspended", label: "停用" },
  { value: "expired", label: "过期" },
] as const;

const TIER_OPTIONS = [
  { value: "", label: "全部等级" },
  { value: "guest", label: "游客" },
  { value: "trial", label: "体验" },
  { value: "beta", label: "内测" },
  { value: "beta_pro", label: "内测 Pro" },
  { value: "paid", label: "付费" },
] as const;

function tierVariant(t: string): "default" | "secondary" | "outline" {
  if (t === "paid" || t === "beta_pro") return "default";
  if (t === "trial") return "outline";
  return "secondary";
}

function statusVariant(
  s: string
): "default" | "destructive" | "outline" {
  if (s === "active") return "default";
  if (s === "expired") return "outline";
  return "destructive";
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

  const [drawerUserId, setDrawerUserId] = React.useState<string | null>(null);
  const [exporting, setExporting] = React.useState(false);

  // 初次加载 & 任一筛选变化都重新拉
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
              多维筛选 / 分页 / 强制下线 / 改 tier / 手动赠送
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
                关键词(邮箱 / displayName)
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
                      colSpan={10}
                      className="py-12 text-center text-muted-foreground"
                    >
                      暂无数据
                    </td>
                  </tr>
                )}
                {items.map((u) => (
                  <tr
                    key={u.userId}
                    className="cursor-pointer border-b hover:bg-accent/40"
                    onClick={() => setDrawerUserId(u.userId)}
                  >
                    <td className="py-2 font-mono text-xs">
                      {u.userId.slice(0, 8)}…
                    </td>
                    <td className="py-2 font-medium">{u.displayName}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {/* 列表里没有 email 字段,占位 */}
                      —
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
                    <td className="py-2 text-right text-xs text-muted-foreground">
                      —
                    </td>
                    <td className="py-2 text-xs">{formatDate(u.activatedAt)}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      —
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
    </div>
  );
}