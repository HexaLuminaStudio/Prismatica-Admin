/**
 * Bills 账单管理页(2026-08-18 UI 优化)
 *
 * - 列表(分页 +过滤:status / userId / days)
 * - 行点击 → 抽屉式详情
 * - CSV 导出(带当前筛选)
 */
import * as React from "react";
import {
  Receipt,
  Search,
  RefreshCcw,
  Download,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useBillsStore } from "@/store/bills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatDate, downloadCsv } from "@/lib/utils";
import { billStatusLabel } from "@/lib/labels";
import { EmptyState } from "@/components/EmptyState";
import { classifyError } from "@/lib/errorMessages";
import { toast } from "@/components/Toast";
import { BillDetailDrawer } from "@/components/BillDetailDrawer";

const STATUS_OPTIONS = [
  { value: "", label: "全部" },
  { value: "pending", label: "待结算" },
  { value: "settled", label: "已结算" },
  { value: "refunded", label: "已退款" },
] as const;

const DAYS_OPTIONS = [
  { value: "", label: "全部时间" },
  { value: "7", label: "近 7 天" },
  { value: "30", label: "近 30 天" },
  { value: "90", label: "近 90 天" },
] as const;

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "warning"> = {
  pending: "warning",
  settled: "default",
  refunded: "destructive",
};

export function BillsPage(): React.ReactElement {
  const items = useBillsStore((s) => s.items);
  const nextCursor = useBillsStore((s) => s.nextCursor);
  const filters = useBillsStore((s) => s.filters);
  const setFilters = useBillsStore((s) => s.setFilters);
  const resetFilters = useBillsStore((s) => s.resetFilters);
  const loadList = useBillsStore((s) => s.loadList);
  const loadMore = useBillsStore((s) => s.loadMore);
  const listLoading = useBillsStore((s) => s.listLoading);
  const listError = useBillsStore((s) => s.listError);

  const [exporting, setExporting] = React.useState(false);
  const [drawerBillId, setDrawerBillId] = React.useState<string | null>(null);

  React.useEffect(() => {
    void loadList({ reset: true }).catch(() => {});
  }, [loadList]);

  const filtersActive =
    filters.status !== "" || filters.days !== "" || filters.userId.trim() !== "";

  const onExport = async () => {
    setExporting(true);
    try {
      const q = new URLSearchParams();
      if (filters.status) q.set("status", filters.status);
      if (filters.days) q.set("days", filters.days);
      if (filters.userId.trim()) q.set("userId", filters.userId.trim());
      const qs = q.toString();
      await downloadCsv(
        `/v1/admin/export/bills.csv${qs ? `?${qs}` : ""}`,
        `bills-${new Date().toISOString().slice(0, 10)}.csv`
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
      {/* 页面标题 */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            账单管理
          </h1>
          <p className="page-subtitle">订单流水 / 结算与退款状态 / 余额变动</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void onExport()} disabled={exporting || listLoading}>
            {exporting ? <Loader2 className="animate-spin" /> : <Download />}
            导出 CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void loadList({ reset: true })} disabled={listLoading} aria-label="刷新列表">
            <RefreshCcw className={cn(listLoading && "animate-spin")} />
            刷新
          </Button>
        </div>
      </div>

      {/* 筛选卡 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>筛选条件</CardTitle>
          <CardDescription>
            {filtersActive ? "已启用筛选条件" : "未启用任何筛选"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 状态 */}
          <div className="space-y-1.5">
            <Label className="text-xs">状态</Label>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((o) => (
                <Button
                  key={o.value || "all"}
                  size="sm"
                  variant={filters.status === o.value ? "default" : "outline"}
                  onClick={() => setFilters({ status: o.value as typeof filters.status })}
                  className="h-7"
                >
                  {o.label}
                </Button>
              ))}
            </div>
          </div>

          {/* 时间范围 */}
          <div className="space-y-1.5">
            <Label className="text-xs">时间范围</Label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS_OPTIONS.map((o) => (
                <Button
                  key={o.value || "all-d"}
                  size="sm"
                  variant={filters.days === o.value ? "default" : "outline"}
                  onClick={() => setFilters({ days: o.value })}
                  className="h-7"
                >
                  {o.label}
                </Button>
              ))}
            </div>
          </div>

          {/* 用户 ID */}
          <div className="space-y-1.5">
            <Label htmlFor="userId" className="text-xs">按 userId 筛选</Label>
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="userId"
                value={filters.userId}
                onChange={(e) => setFilters({ userId: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void loadList({ reset: true });
                }}
                placeholder="精确匹配用户 ID"
                className="pl-9 font-mono tabular"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-3">
            <Button size="sm" variant="ghost" onClick={() => { resetFilters(); void loadList({ reset: true }); }} disabled={!filtersActive}>
              清空筛选
            </Button>
            <Button size="sm" onClick={() => void loadList({ reset: true })} disabled={listLoading}>
              {listLoading ? <Loader2 className="animate-spin" /> : null}
              应用
            </Button>
          </div>
        </CardContent>
      </Card>

      {listError && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>{listError}</div>
        </div>
      )}

      {/* 列表 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2.5 pl-4 text-left font-medium">创建时间</th>
                  <th className="py-2.5 text-left font-medium">账单 ID</th>
                  <th className="py-2.5 text-left font-medium">用户</th>
                  <th className="py-2.5 text-left font-medium">动作</th>
                  <th className="py-2.5 text-right font-medium">预估 / 实际</th>
                  <th className="py-2.5 text-left font-medium">状态</th>
                  <th className="py-2.5 text-left font-medium">结算时间</th>
                  <th className="py-2.5 pr-4 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !listLoading && (
                  <tr>
                    <td colSpan={8} className="p-0">
                      <EmptyState
                        icon={Receipt}
                        title="暂无账单"
                        description={
                          filtersActive
                            ? "当前筛选条件下没有匹配的账单"
                            : "用户消费后将产生账单记录"
                        }
                      />
                    </td>
                  </tr>
                )}
                {items.map((b) => (
                  <tr
                    key={b.billId}
                    className="cursor-pointer border-b last:border-0 transition-colors hover:bg-muted/40"
                    onClick={() => setDrawerBillId(b.billId)}
                  >
                    <td className="py-2 pl-4 text-xs whitespace-nowrap text-muted-foreground">
                      {formatDate(b.createdAt)}
                    </td>
                    <td className="py-2 font-mono text-xs text-foreground">
                      {b.billId.slice(0, 8)}…
                    </td>
                    <td className="py-2 text-xs">
                      {b.displayName ? (
                        <span>
                          <span className="font-medium text-foreground">{b.displayName}</span>
                          <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                            ({b.userId.slice(0, 8)}…)
                          </span>
                        </span>
                      ) : (
                        <span className="font-mono text-muted-foreground">
                          {b.userId.slice(0, 8)}…
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-foreground">{b.actionDisplayName || b.actionType}</td>
                    <td className="py-2 text-right tabular text-xs">
                      {b.estimatedCost.toLocaleString()} /{" "}
                      <span className={cn(b.realCost > b.estimatedCost && "text-destructive font-medium")}>
                        {b.realCost.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-2">
                      <Badge variant={STATUS_BADGE[b.status] ?? "secondary"}>
                        {billStatusLabel(b.status)}
                      </Badge>
                    </td>
                    <td className="py-2 text-xs whitespace-nowrap text-muted-foreground">
                      {formatDate(b.settledAt)}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDrawerBillId(b.billId);
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
            <div className="flex justify-center border-t p-3">
              <Button variant="outline" size="sm" disabled={listLoading} onClick={() => void loadMore()}>
                {listLoading ? <Loader2 className="animate-spin" /> : null}
                加载更多
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <BillDetailDrawer billId={drawerBillId} onClose={() => setDrawerBillId(null)} />
    </div>
  );
}