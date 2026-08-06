/**
 * Dashboard(2026-08-05 M2)
 *
 * - 顶部 4 个 KPI 卡片:用户总数 / 7 日活跃 / 7 日 grant 总额 / 待结算账单数
 * - 中间两栏:
 *     - 左:近 7 日 audit 行为分布(柱状图)
 *     - 右:最近 audit 日志(表格 + 跳转)
 *
 * 数据源:metrics-summary + audit + audit-summary
 * 加载方式:并行 useEffect + Promise.all;失败单独展示
 */

import * as React from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Activity,
  Coins,
  Clock,
  AlertTriangle,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSessionStore } from "@/store/session";
import { fetchMetricsSummary } from "@/api/metrics";
import { auditSummary, listAudit } from "@/api/audit";
import { ApiClientError } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, cn } from "@/lib/utils";
import type { AdminMetricsSummary } from "@/api/metrics";
import type {
  AdminAuditItem,
  AdminAuditSummaryItem,
} from "@/api/audit";

interface KpiCardProps {
  title: string;
  value: number | string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
}

function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  accent = "text-primary",
}: KpiCardProps): React.ReactElement {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={cn("h-5 w-5", accent)} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

interface State {
  metrics: AdminMetricsSummary | null;
  summary: AdminAuditSummaryItem[];
  recent: AdminAuditItem[];
  loading: boolean;
  error: string | null;
}

const INITIAL: State = {
  metrics: null,
  summary: [],
  recent: [],
  loading: true,
  error: null,
};

export function DashboardPage(): React.ReactElement {
  const me = useSessionStore((s) => s.me);
  const [state, setState] = React.useState<State>(INITIAL);

  const load = React.useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [metrics, summary, audit] = await Promise.all([
        fetchMetricsSummary(),
        auditSummary(7),
        listAudit({ limit: 8 }),
      ]);
      setState({
        metrics,
        summary: summary.items,
        recent: audit.items,
        loading: false,
        error: null,
      });
    } catch (e) {
      const msg =
        e instanceof ApiClientError
          ? e.message
          : e instanceof Error
            ? e.message
            : "加载失败";
      setState((s) => ({ ...s, loading: false, error: msg }));
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // 自动每 60s 静默刷新(轻量)
  React.useEffect(() => {
    const t = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">仪表盘</h1>
          <p className="text-sm text-muted-foreground">
            {me
              ? `${me.username} · 你好,以下是平台近况`
              : "以下是平台近况"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={state.loading}
        >
          <RefreshCcw
            className={cn(
              "mr-1 h-4 w-4",
              state.loading && "animate-spin"
            )}
          />
          刷新
        </Button>
      </div>

      {/* KPI 行 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="用户总数"
          value={state.metrics?.userCount ?? "—"}
          description="user_accounts 总计"
          icon={Users}
          accent="text-sky-500"
        />
        <KpiCard
          title="7 日活跃设备"
          value={state.metrics?.sevenDayActive ?? "—"}
          description="user_devices.lastSeenAt ≥ now-7d"
          icon={Activity}
          accent="text-emerald-500"
        />
        <KpiCard
          title="7 日 grant 总额"
          value={state.metrics?.sevenDayGrantTotal ?? "—"}
          description="admin.grant_balance amount sum (近 7 日)"
          icon={Coins}
          accent="text-amber-500"
        />
        <KpiCard
          title="待结算账单"
          value={state.metrics?.billsPending ?? "—"}
          description="bills.status = pending"
          icon={Clock}
          accent="text-rose-500"
        />
      </div>

      {/* 错误条 */}
      {state.error && !state.loading && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <div>
            <div className="font-medium">仪表盘加载失败</div>
            <div className="text-destructive/90">{state.error}</div>
          </div>
        </div>
      )}

      {/* 图表 + 详情两栏 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>近 7 日 admin 行为分布</CardTitle>
            <CardDescription>
              按 audit_logs.action group by 计 count(来源:audit-summary)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state.loading && state.summary.length === 0 ? (
              <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                加载中…
              </div>
            ) : state.summary.length === 0 ? (
              <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                近 7 日暂无 admin 行为记录
              </div>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={state.summary}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="action"
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--accent))" }}
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="count"
                      name="次数"
                      fill="hsl(var(--primary))"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>账单状态(近 7 日)</CardTitle>
            <CardDescription>settled / refunded</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <BillBar
              label="已结算"
              value={state.metrics?.billsSettledLast7Days ?? 0}
              total={
                (state.metrics?.billsSettledLast7Days ?? 0) +
                (state.metrics?.billsRefundedLast7Days ?? 0)
              }
              colorClass="bg-emerald-500"
            />
            <BillBar
              label="已退款"
              value={state.metrics?.billsRefundedLast7Days ?? 0}
              total={
                (state.metrics?.billsSettledLast7Days ?? 0) +
                (state.metrics?.billsRefundedLast7Days ?? 0)
              }
              colorClass="bg-rose-500"
            />
            {state.metrics && (
              <div className="pt-2 text-xs text-muted-foreground">
                占比高的颜色 = 该状态活跃
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 最近 audit 日志 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>最近审计</CardTitle>
            <CardDescription>audit_logs DESC by createdAt(展示 8 条)</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/audit">查看全部 →</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {state.loading && state.recent.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              加载中…
            </div>
          ) : state.recent.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              暂无审计日志
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-muted-foreground">
                    <th className="py-2 text-left font-medium">时间</th>
                    <th className="py-2 text-left font-medium">操作员</th>
                    <th className="py-2 text-left font-medium">动作</th>
                    <th className="py-2 text-left font-medium">目标用户</th>
                    <th className="py-2 text-left font-medium">详情</th>
                  </tr>
                </thead>
                <tbody>
                  {state.recent.map((row) => (
                    <tr key={row.auditId} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs text-muted-foreground">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="py-2 font-medium">{row.actor}</td>
                      <td className="py-2">
                        <Badge variant="secondary">{row.action}</Badge>
                      </td>
                      <td className="py-2 text-xs">
                        {row.targetUser ?? "—"}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground max-w-[300px] truncate">
                        {row.details
                          ? Object.entries(row.details)
                              .map(([k, v]) => `${k}=${v}`)
                              .join(" · ")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BillBar({
  label,
  value,
  total,
  colorClass,
}: {
  label: string;
  value: number;
  total: number;
  colorClass: string;
}): React.ReactElement {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {value.toLocaleString()} ({pct}%)
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full transition-all", colorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
