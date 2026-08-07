/**
 * Bills 账单管理页(2026-08-06 P0-B M5 重构)
 *
 * 功能:
 *  - 列表(分页 + 过滤:status / userId / days)
 *  - 行点击 → 抽屉式详情(BillDetailDrawer)
 *  - CSV 导出(带当前筛选)
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
import { useBillsStore, EMPTY_BILLS_FILTERS } from "@/store/bills";
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
import { billStatusLabel } from "@/lib/labels";
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

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive"> = {
  pending: "default",
  settled: "secondary",
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              账单管理
            </CardTitle>
            <CardDescription>
              订单流水 / 结算与退款状态 / 余额变动
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
        <CardContent>
          {/* 筛选条 */}
          <div className="mb-4 grid grid-cols-1 gap-3 rounded-md border bg-muted/20 p-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">状态</Label>
              <div className="flex flex-wrap gap-1">
                {STATUS_OPTIONS.map((o) => (
                  <Button
                    key={o.value || "all"}
                    size="sm"
                    variant={filters.status === o.value ? "default" : "outline"}
                    onClick={() =>
                      setFilters({
                        status: o.value as typeof filters.status,
                      })
                    }
                    className="h-7"
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">时间范围</Label>
              <div className="flex flex-wrap gap-1">
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
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="userId" className="text-xs">
                按 userId 筛选
              </Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="userId"
                  value={filters.userId}
                  onChange={(e) => setFilters({ userId: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void loadList({ reset: true });
                  }}
                  placeholder="精确匹配用户 ID"
                  className="pl-8"
                />
              </div>
            </div>
            <div className="md:col-span-4 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {filtersActive ? "已启用筛选条件" : "未启用任何筛选"}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => void loadList({ reset: true })}
                  disabled={listLoading}
                >
                  应用
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
                  清空
                </Button>
              </div>
            </div>
          </div>

          {listError && (
            <div className="mb-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <div>{listError}</div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-muted-foreground">
                  <th className="py-2 text-left font-medium">创建时间</th>
                  <th className="py-2 text-left font-medium">账单 ID</th>
                  <th className="py-2 text-left font-medium">用户</th>
                  <th className="py-2 text-left font-medium">动作</th>
                  <th className="py-2 text-right font-medium">预估/实际</th>
                  <th className="py-2 text-left font-medium">状态</th>
                  <th className="py-2 text-left font-medium">结算时间</th>
                  <th className="py-2 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !listLoading && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-12 text-center text-muted-foreground"
                    >
                      暂无账单
                    </td>
                  </tr>
                )}
                {items.map((b) => (
                  <tr
                    key={b.billId}
                    className="cursor-pointer border-b hover:bg-accent/40"
                    onClick={() => setDrawerBillId(b.billId)}
                  >
                    <td className="py-2 text-xs">{formatDate(b.createdAt)}</td>
                    <td className="py-2 font-mono text-xs">
                      {b.billId.slice(0, 8)}…
                    </td>
                    <td className="py-2 text-xs">
                      {b.displayName ? (
                        <span>
                          <span className="font-medium">{b.displayName}</span>
                          <span className="ml-1 font-mono text-muted-foreground">
                            ({b.userId.slice(0, 8)}…)
                          </span>
                        </span>
                      ) : (
                        <span className="font-mono text-muted-foreground">
                          {b.userId.slice(0, 8)}…
                        </span>
                      )}
                    </td>
                    <td className="py-2">{b.actionDisplayName || b.actionType}</td>
                    <td className="py-2 text-right tabular-nums text-xs">
                      {b.estimatedCost.toLocaleString()} /{" "}
                      <span
                        className={
                          b.realCost > b.estimatedCost ? "text-destructive" : ""
                        }
                      >
                        {b.realCost.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-2">
                      <Badge variant={STATUS_BADGE[b.status] ?? "secondary"}>
                        {billStatusLabel(b.status)}
                      </Badge>
                    </td>
                    <td className="py-2 text-xs">{formatDate(b.settledAt)}</td>
                    <td className="py-2 text-right">
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
            <div className="mt-3 flex justify-center">
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

      <BillDetailDrawer
        billId={drawerBillId}
        onClose={() => setDrawerBillId(null)}
      />
    </div>
  );
}