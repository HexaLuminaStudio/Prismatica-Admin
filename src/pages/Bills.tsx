/**
 * 账单管理页(2026-08-06 新增)
 *
 * 功能:
 *  - 列表(分页 + 过滤:status / userId / days)
 *  - 行展开:详情(description / taskId / 幂等键 / 余额变动 / 资源用量)
 *  - 顶部「导出 CSV」
 *
 * 数据源:GET /v1/admin/bills
 */

import * as React from "react";
import {
  Receipt,
  Search,
  RefreshCcw,
  Download,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { AdminBillItem, ListBillsParams, listBills } from "@/api/bills";
import { downloadCsv } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate, cn } from "@/lib/utils";
import { billStatusLabel } from "@/lib/labels";

const STATUSES = ["", "pending", "settled", "refunded"] as const;
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
  const [items, setItems] = React.useState<AdminBillItem[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [filterStatus, setFilterStatus] = React.useState<string>("");
  const [days, setDays] = React.useState<string>("");
  const [userId, setUserId] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [exporting, setExporting] = React.useState(false);

  const load = React.useCallback(
    async (opts: { reset?: boolean; cursor?: string } = {}) => {
      setLoading(true);
      setError(null);
      try {
        const resp = await listBills({
          limit: 50,
          ...(filterStatus ? { status: filterStatus } : {}),
          ...(days ? { days: Number(days) } : {}),
          ...(userId.trim() ? { userId: userId.trim() } : {}),
          ...(opts.cursor ? { cursor: opts.cursor } : {}),
        });
        setItems((prev) => (opts.reset ? resp.items : [...prev, ...resp.items]));
        setNextCursor(resp.nextCursor);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        setLoading(false);
      }
    },
    [filterStatus, days, userId]
  );

  React.useEffect(() => {
    void load({ reset: true });
  }, [load]);

  const onExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (days) params.set("days", days);
      if (userId.trim()) params.set("userId", userId.trim());
      const qs = params.toString();
      await downloadCsv(
        `/v1/admin/export/bills.csv${qs ? `?${qs}` : ""}`,
        `bills-${new Date().toISOString().slice(0, 10)}.csv`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "导出失败");
    } finally {
      setExporting(false);
    }
  };

  const toggleExpand = (billId: string) => {
    setExpanded((prev) => (prev === billId ? null : billId));
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
            <Button variant="outline" size="sm" onClick={() => void onExport()} disabled={exporting}>
              {exporting ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1 h-4 w-4" />
              )}
              导出 CSV
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void load({ reset: true })}
              disabled={loading}
            >
              <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">状态:</span>
            {STATUSES.map((s) => (
              <Button
                key={s || "all"}
                size="sm"
                variant={filterStatus === s ? "default" : "outline"}
                onClick={() => setFilterStatus(s)}
                className="h-7"
              >
                {s ? billStatusLabel(s) : "全部"}
              </Button>
            ))}
            <span className="ml-4 text-muted-foreground">时间:</span>
            {DAYS_OPTIONS.map((o) => (
              <Button
                key={o.value || "all-d"}
                size="sm"
                variant={days === o.value ? "default" : "outline"}
                onClick={() => setDays(o.value)}
                className="h-7"
              >
                {o.label}
              </Button>
            ))}
            <div className="relative ml-4 flex w-64 items-center">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="按 userId 精确筛选"
                className="h-8 pl-8"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void load({ reset: true });
                }}
              />
            </div>
          </div>

          {error && (
            <div className="mb-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <div>{error}</div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-muted-foreground">
                  <th className="w-8 py-2 text-left"></th>
                  <th className="py-2 text-left font-medium">创建时间</th>
                  <th className="py-2 text-left font-medium">账单 ID</th>
                  <th className="py-2 text-left font-medium">用户</th>
                  <th className="py-2 text-left font-medium">动作</th>
                  <th className="py-2 text-right font-medium">预估/实际</th>
                  <th className="py-2 text-left font-medium">状态</th>
                  <th className="py-2 text-left font-medium">结算时间</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      暂无账单
                    </td>
                  </tr>
                )}
                {items.map((b) => (
                  <React.Fragment key={b.billId}>
                    <tr
                      className="cursor-pointer border-b hover:bg-accent/40"
                      onClick={() => toggleExpand(b.billId)}
                    >
                      <td className="py-2">
                        {expanded === b.billId ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </td>
                      <td className="py-2 text-xs">{formatDate(b.createdAt)}</td>
                      <td className="py-2 font-mono text-xs">{b.billId.slice(0, 8)}…</td>
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
                        <span className={b.realCost > b.estimatedCost ? "text-destructive" : ""}>
                          {b.realCost.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-2">
                        <Badge variant={STATUS_BADGE[b.status] ?? "secondary"}>
                          {billStatusLabel(b.status)}
                        </Badge>
                      </td>
                      <td className="py-2 text-xs">
                        {formatDate(b.settledAt)}
                      </td>
                    </tr>
                    {expanded === b.billId && (
                      <tr className="border-b bg-muted/30">
                        <td colSpan={8} className="p-4">
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs md:grid-cols-4">
                            <div>
                              <span className="text-muted-foreground">billId: </span>
                              <span className="font-mono">{b.billId}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">userId: </span>
                              <span className="font-mono">{b.userId}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">taskId: </span>
                              <span className="font-mono">{b.taskId || "—"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">幂等键: </span>
                              <span className="font-mono">{b.idempotencyKey || "—"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">余额变动: </span>
                              {b.balanceBefore.toLocaleString()} → {b.balanceAfter.toLocaleString()}
                            </div>
                            <div>
                              <span className="text-muted-foreground">资源用量: </span>
                              <span className="tabular-nums">{b.resourceUsed.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">actionType: </span>
                              <span className="font-mono">{b.actionType}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">描述: </span>
                              <span>{b.description || "—"}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {nextCursor && (
            <div className="mt-3 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => void load({ cursor: nextCursor })}
              >
                {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                加载更多
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
