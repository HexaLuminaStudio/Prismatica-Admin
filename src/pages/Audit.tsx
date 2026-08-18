/**
 * 审计日志页(2026-08-18 UI 优化)
 *
 * - 列表(分页 + 过滤:action / actor / targetUser / days)
 * - 顶部看板:近 N 日 action 分布
 * - 行:展开 details JSON
 */
import * as React from "react";
import {
  ScrollText,
  RefreshCcw,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  BarChart3,
} from "lucide-react";
import { AdminAuditItem, auditSummary, listAudit, ListAuditParams } from "@/api/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatDate, downloadCsv } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { actionLabel } from "@/lib/labels";

export function AuditPage(): React.ReactElement {
  const [items, setItems] = React.useState<AdminAuditItem[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<{ action: string; count: number }[]>([]);
  const [summaryTotal, setSummaryTotal] = React.useState(0);
  const [params, setParams] = React.useState<ListAuditParams>({ days: 7 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<number | null>(null);
  const [exporting, setExporting] = React.useState(false);

  const onExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (params.days) query.set("days", String(params.days));
      if (params.action) query.set("action", params.action);
      if (params.actor) query.set("actor", params.actor);
      if (params.targetUser) query.set("targetUser", params.targetUser);
      const qs = query.toString();
      await downloadCsv(
        `/v1/admin/export/audit.csv${qs ? `?${qs}` : ""}`,
        `audit-${new Date().toISOString().slice(0, 10)}.csv`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "导出失败");
    } finally {
      setExporting(false);
    }
  };

  const load = React.useCallback(
    async (opts: { reset?: boolean; cursor?: string; p?: ListAuditParams } = {}) => {
      setLoading(true);
      setError(null);
      const useParams = opts.p ?? params;
      try {
        const [list, sum] = await Promise.all([
          listAudit({
            limit: 50,
            ...(opts.cursor ? { cursor: opts.cursor } : {}),
            ...useParams,
          }),
          auditSummary(useParams.days ?? 7),
        ]);
        setItems((prev) => (opts.reset ? list.items : [...prev, ...list.items]));
        setNextCursor(list.nextCursor);
        setSummary(sum.items);
        setSummaryTotal(sum.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        setLoading(false);
      }
    },
    [params]
  );

  React.useEffect(() => {
    void load({ reset: true });
  }, [load]);

  const onApply = () => void load({ reset: true, p: params });
  const onReset = () => {
    const p: ListAuditParams = { days: 7 };
    setParams(p);
    void load({ reset: true, p });
  };

  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-muted-foreground" />
            审计日志
          </h1>
          <p className="page-subtitle">所有 admin 行为(登录 / grant / issue / revoke …)</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5">
            <BarChart3 className="h-3 w-3" />
            近 {params.days ?? 7} 日 · <span className="tabular">{summaryTotal.toLocaleString()}</span>
          </Badge>
          <Button variant="outline" size="sm" onClick={() => void onExport()} disabled={exporting || loading}>
            {exporting ? <Loader2 className="animate-spin" /> : <Download />}
            导出 CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void load({ reset: true, p: params })} disabled={loading} aria-label="刷新列表">
            <RefreshCcw className={cn(loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* 过滤栏 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>筛选条件</CardTitle>
          <CardDescription>支持 action 模糊匹配 + 操作员 / 目标用户精确匹配</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="days" className="text-xs">查询最近(天)</Label>
              <Input
                id="days"
                type="number"
                min={1}
                max={90}
                value={String(params.days ?? 7)}
                onChange={(e) =>
                  setParams((p) => ({ ...p, days: Number(e.target.value) || 7 }))
                }
                className="tabular"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="action" className="text-xs">行为类型(模糊)</Label>
              <Input
                id="action"
                value={params.action ?? ""}
                onChange={(e) => setParams((p) => ({ ...p, action: e.target.value }))}
                placeholder="如 admin.grant_balance"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="actor" className="text-xs">操作员</Label>
              <Input
                id="actor"
                value={params.actor ?? ""}
                onChange={(e) => setParams((p) => ({ ...p, actor: e.target.value }))}
                placeholder="如 root"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target" className="text-xs">目标用户</Label>
              <Input
                id="target"
                value={params.targetUser ?? ""}
                onChange={(e) =>
                  setParams((p) => ({ ...p, targetUser: e.target.value }))
                }
                placeholder="可选"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button size="sm" variant="ghost" onClick={onReset} disabled={loading}>
              重置
            </Button>
            <Button size="sm" onClick={onApply} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : null}
              应用
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 看板 */}
      {summary.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              近 {params.days ?? 7} 日 action 分布
            </CardTitle>
            <CardDescription>top 8 按计数降序</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {summary.slice(0, 8).map((s) => (
                <div
                  key={s.action}
                  className="flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5"
                >
                  <span className="font-mono text-xs">{s.action}</span>
                  <Badge variant="outline" className="tabular">{s.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {/* 列表 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="w-8 py-2.5 pl-4 text-left"></th>
                  <th className="py-2.5 text-left font-medium">时间</th>
                  <th className="py-2.5 text-left font-medium">actor</th>
                  <th className="py-2.5 text-left font-medium">action</th>
                  <th className="py-2.5 text-left font-medium">targetUser</th>
                  <th className="py-2.5 pr-4 text-left font-medium">ip</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <EmptyState
                        icon={ScrollText}
                        title="暂无审计日志"
                        description="符合当前筛选的审计行为将在这里展示"
                      />
                    </td>
                  </tr>
                )}
                {items.map((r) => (
                  <React.Fragment key={r.auditId}>
                    <tr
                      className="cursor-pointer border-b transition-colors hover:bg-muted/40"
                      onClick={() =>
                        setExpanded(expanded === r.auditId ? null : r.auditId)
                      }
                    >
                      <td className="py-2 pl-4">
                        {expanded === r.auditId ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </td>
                      <td className="py-2 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {formatDate(r.createdAt)}
                      </td>
                      <td className="py-2 font-medium text-foreground">{r.actor}</td>
                      <td className="py-2">
                        <Badge variant="secondary">{actionLabel(r.action)}</Badge>
                        <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">{r.action}</span>
                      </td>
                      <td className="py-2 font-mono text-[11px] text-ellipsis max-w-[160px]">
                        {r.targetUser ?? "—"}
                      </td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                        {r.ip ?? "—"}
                      </td>
                    </tr>
                    {expanded === r.auditId && (
                      <tr className="border-b bg-muted/30">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="text-xs">
                            <div className="mb-1.5 font-medium text-muted-foreground">详情</div>
                            <pre className="max-h-64 overflow-auto rounded-md border bg-card p-2 font-mono text-[11px] leading-relaxed scrollbar-thin">
                              {r.details ? JSON.stringify(r.details, null, 2) : "—"}
                            </pre>
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
            <div className="flex justify-center border-t p-3">
              <Button variant="outline" size="sm" disabled={loading} onClick={() => void load({ cursor: nextCursor, p: params })}>
                {loading ? <Loader2 className="animate-spin" /> : null}
                加载更多
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}