/**
 * 审计日志页(2026-08-06 实现)
 *
 * 功能:
 *  - 列表(分页 + 过滤:action / actor / targetUser / days)
 *  - 顶部看板:近 N 日 action 分布
 *  - 行:展开 details JSON
 */

import * as React from "react";
import {
  ScrollText,
  RefreshCcw,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  AdminAuditItem,
  AdminAuditSummaryItem,
  auditSummary,
  listAudit,
  ListAuditParams,
} from "@/api/audit";
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
import { formatDate, cn } from "@/lib/utils";

export function AuditPage(): React.ReactElement {
  const [items, setItems] = React.useState<AdminAuditItem[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<AdminAuditSummaryItem[]>([]);
  const [summaryTotal, setSummaryTotal] = React.useState(0);
  const [params, setParams] = React.useState<ListAuditParams>({ days: 7 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<number | null>(null);

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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="h-4 w-4" />
              审计日志
            </CardTitle>
            <CardDescription>所有 admin 行为(登录/grant/issue/revoke…)</CardDescription>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">近 {params.days ?? 7} 日总计:</span>
            <Badge variant="secondary">{summaryTotal.toLocaleString()}</Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void load({ reset: true, p: params })}
              disabled={loading}
            >
              <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* 过滤栏 */}
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="space-y-1">
              <Label htmlFor="days" className="text-xs">
                查询最近(天)
              </Label>
              <Input
                id="days"
                type="number"
                min={1}
                max={90}
                value={String(params.days ?? 7)}
                onChange={(e) =>
                  setParams((p) => ({ ...p, days: Number(e.target.value) || 7 }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="action" className="text-xs">
                行为类型(模糊)
              </Label>
              <Input
                id="action"
                value={params.action ?? ""}
                onChange={(e) => setParams((p) => ({ ...p, action: e.target.value }))}
                placeholder="如 admin.grant_balance"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="actor" className="text-xs">
                操作员
              </Label>
              <Input
                id="actor"
                value={params.actor ?? ""}
                onChange={(e) => setParams((p) => ({ ...p, actor: e.target.value }))}
                placeholder="如 root"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="target" className="text-xs">
                目标用户
              </Label>
              <Input
                id="target"
                value={params.targetUser ?? ""}
                onChange={(e) =>
                  setParams((p) => ({ ...p, targetUser: e.target.value }))
                }
                placeholder="可选"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button size="sm" onClick={onApply} disabled={loading}>
                应用
              </Button>
              <Button size="sm" variant="ghost" onClick={onReset} disabled={loading}>
                重置
              </Button>
            </div>
          </div>

          {/* 看板:近 N 日 action 分布 */}
          {summary.length > 0 && (
            <div className="mb-4 rounded-md border bg-muted/30 p-3 text-xs">
              <div className="mb-2 font-medium text-muted-foreground">action 分布(top 8)</div>
              <div className="flex flex-wrap gap-2">
                {summary.slice(0, 8).map((s) => (
                  <div
                    key={s.action}
                    className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1"
                  >
                    <span className="font-mono">{s.action}</span>
                    <Badge variant="outline">{s.count}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                  <th className="py-2 text-left font-medium">时间</th>
                  <th className="py-2 text-left font-medium">actor</th>
                  <th className="py-2 text-left font-medium">action</th>
                  <th className="py-2 text-left font-medium">targetUser</th>
                  <th className="py-2 text-left font-medium">ip</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      暂无审计日志
                    </td>
                  </tr>
                )}
                {items.map((r) => (
                  <React.Fragment key={r.auditId}>
                    <tr
                      className="cursor-pointer border-b hover:bg-accent/40"
                      onClick={() =>
                        setExpanded(expanded === r.auditId ? null : r.auditId)
                      }
                    >
                      <td className="py-2">
                        {expanded === r.auditId ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </td>
                      <td className="py-2 font-mono text-xs">{formatDate(r.createdAt)}</td>
                      <td className="py-2 font-medium">{r.actor}</td>
                      <td className="py-2">
                        <Badge variant="secondary">{r.action}</Badge>
                      </td>
                      <td className="py-2 text-xs font-mono">
                        {r.targetUser ? r.targetUser.slice(0, 12) + "…" : "—"}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {r.ip ?? "—"}
                      </td>
                    </tr>
                    {expanded === r.auditId && (
                      <tr className="border-b bg-muted/30">
                        <td colSpan={6} className="p-3">
                          <div className="text-xs">
                            <div className="mb-1 font-medium">详情</div>
                            <pre className="overflow-x-auto rounded-md border bg-card p-2 font-mono text-[11px]">
                              {r.details
                                ? JSON.stringify(r.details, null, 2)
                                : "—"}
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
            <div className="mt-3 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => void load({ cursor: nextCursor, p: params })}
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