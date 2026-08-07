/**
 * Dashboard(2026-08-06 P0-B M6 重构)
 *
 * - 顶部 KPI 行(用户总数 / 7 日活跃 / 7 日 grant 总额 / 待结算账单 / 活跃兑换码)
 * - 订阅分布饼图(free / pro / team 三色,M6 新增)
 * - 兑换码看板(已签发 / 已使用 / 已撤销,M6 新增)
 * - 中间两栏:近 7 日 audit 行为分布 + 账单状态条
 * - 最近 audit 日志
 *
 * 数据源:metrics-summary + subscription-distribution + codes-kpi + audit + audit-summary
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
  Ticket,
  PieChart as PieIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSessionStore } from "@/store/session";
import {
  fetchMetricsSummary,
  fetchSubscriptionDistribution,
  fetchCodesKpi,
} from "@/api/metrics";
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
import { userTierLabel } from "@/lib/labels";
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
  subscriptionDistribution: { tier: string; count: number }[];
  subscriptionTotal: number;
  codesKpi: {
    activeCount: number;
    consumedLast7Days: number;
    issuedLast7Days: number;
    revokedLast7Days: number;
  } | null;
  loadingModules: Record<ModuleKey, boolean>;
  errors: Partial<Record<ModuleKey, string>>;
}

type ModuleKey = "metrics" | "subscription" | "codes" | "auditSummary" | "recentAudit";

const MODULE_KEYS: ModuleKey[] = ["metrics", "subscription", "codes", "auditSummary", "recentAudit"];

const INITIAL_LOADING: Record<ModuleKey, boolean> = {
  metrics: true,
  subscription: true,
  codes: true,
  auditSummary: true,
  recentAudit: true,
};

const INITIAL: State = {
  metrics: null,
  summary: [],
  recent: [],
  subscriptionDistribution: [],
  subscriptionTotal: 0,
  codesKpi: null,
  loadingModules: INITIAL_LOADING,
  errors: {},
};

const TIER_COLORS: Record<string, string> = {
  guest: "#94a3b8",
  trial: "#a78bfa",
  beta: "#60a5fa",
  beta_pro: "#34d399",
  paid: "#f59e0b",
  free: "#94a3b8",
  pro: "#60a5fa",
  team: "#34d399",
};

function pickColor(tier: string, idx: number): string {
  if (TIER_COLORS[tier]) return TIER_COLORS[tier];
  const fallback = ["#60a5fa", "#a78bfa", "#34d399", "#f59e0b", "#f472b6"];
  return fallback[idx % fallback.length];
}

export function DashboardPage(): React.ReactElement {
  const me = useSessionStore((s) => s.me);
  const [state, setState] = React.useState<State>(INITIAL);
  const requestIdRef = React.useRef(0);
  const isLoading = MODULE_KEYS.some((key) => state.loadingModules[key]);
  const errorMessages = Array.from(new Set(Object.values(state.errors)));

  const load = React.useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setState((currentState) => ({
      ...currentState,
      loadingModules: { ...INITIAL_LOADING },
      errors: {},
    }));

    const updateModule = (
      moduleKey: ModuleKey,
      update: (currentState: State) => Partial<State>
    ) => {
      if (requestId !== requestIdRef.current) return;
      setState((currentState) => ({
        ...currentState,
        ...update(currentState),
        loadingModules: { ...currentState.loadingModules, [moduleKey]: false },
      }));
    };

    const failModule = (moduleKey: ModuleKey, error: unknown) => {
      const message =
        error instanceof ApiClientError
          ? error.message
          : error instanceof Error
            ? error.message
            : "加载失败";
      updateModule(moduleKey, (currentState) => ({
        errors: { ...currentState.errors, [moduleKey]: message },
      }));
    };

    await Promise.allSettled([
      fetchMetricsSummary().then(
        (metrics) => updateModule("metrics", () => ({ metrics })),
        (error) => failModule("metrics", error)
      ),
      fetchSubscriptionDistribution().then(
        (distribution) =>
          updateModule("subscription", () => ({
            subscriptionDistribution: distribution.items,
            subscriptionTotal: distribution.total,
          })),
        (error) => failModule("subscription", error)
      ),
      fetchCodesKpi().then(
        (codesKpi) => updateModule("codes", () => ({ codesKpi })),
        (error) => failModule("codes", error)
      ),
      auditSummary(7).then(
        (summary) => updateModule("auditSummary", () => ({ summary: summary.items })),
        (error) => failModule("auditSummary", error)
      ),
      listAudit({ limit: 8 }).then(
        (audit) => updateModule("recentAudit", () => ({ recent: audit.items })),
        (error) => failModule("recentAudit", error)
      ),
    ]);
  }, []);

  React.useEffect(() => {
    void load();
    return () => {
      requestIdRef.current += 1;
    };
  }, [load]);

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
        >
          <RefreshCcw
            className={cn(
              "mr-1 h-4 w-4",
              isLoading && "animate-spin"
            )}
          />
          刷新
        </Button>
      </div>

      {/* KPI 行 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          title="用户总数"
          value={state.metrics?.userCount ?? "—"}
          description="平台用户总人数"
          icon={Users}
          accent="text-sky-500"
        />
        <KpiCard
          title="7 日活跃设备"
          value={state.metrics?.sevenDayActive ?? "—"}
          description="过去 7 天有过活跃的设备数"
          icon={Activity}
          accent="text-emerald-500"
        />
        <KpiCard
          title="7 日充值总额"
          value={state.metrics?.sevenDayGrantTotal ?? "—"}
          description="过去 7 天累计充值余额"
          icon={Coins}
          accent="text-amber-500"
        />
        <KpiCard
          title="待结算账单"
          value={state.metrics?.billsPending ?? "—"}
          description="账单状态为待结算的数量"
          icon={Clock}
          accent="text-rose-500"
        />
        <KpiCard
          title="活跃兑换码"
          value={state.codesKpi?.activeCount ?? "—"}
          description="已签发且未过期的有效码"
          icon={Ticket}
          accent="text-indigo-500"
        />
      </div>

      {errorMessages.length > 0 && !isLoading && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <div>
            <div className="font-medium">部分仪表盘模块加载失败</div>
            <div className="text-destructive/90">{errorMessages.join("；")}</div>
          </div>
        </div>
      )}

      {/* 图表 + 详情三栏 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        {/* 订阅分布(M6) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieIcon className="h-4 w-4" />
              订阅分布
            </CardTitle>
            <CardDescription>
              按当前 tier 统计(总 {state.subscriptionTotal.toLocaleString()})
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state.loadingModules.subscription && state.subscriptionDistribution.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                加载中…
              </div>
            ) : state.subscriptionDistribution.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                暂无订阅数据
              </div>
            ) : (
              <div className="space-y-3">
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={state.subscriptionDistribution}
                        dataKey="count"
                        nameKey="tier"
                        innerRadius={45}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {state.subscriptionDistribution.map((d, idx) => (
                          <Cell
                            key={d.tier}
                            fill={pickColor(d.tier, idx)}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(v: number, n) => [
                          v.toLocaleString(),
                          userTierLabel(String(n)),
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1">
                  {state.subscriptionDistribution.map((d, idx) => {
                    const pct =
                      state.subscriptionTotal > 0
                        ? Math.round((d.count / state.subscriptionTotal) * 100)
                        : 0;
                    return (
                      <div
                        key={d.tier}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ background: pickColor(d.tier, idx) }}
                          />
                          <span>{userTierLabel(d.tier)}</span>
                        </div>
                        <div className="font-mono text-muted-foreground">
                          {d.count.toLocaleString()} · {pct}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 近 7 日 audit 行为分布 */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>近 7 日 admin 行为分布</CardTitle>
            <CardDescription>
              按 audit_logs.action group by 计 count(来源:audit-summary)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state.loadingModules.auditSummary && state.summary.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                加载中…
              </div>
            ) : state.summary.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                近 7 日暂无管理员操作记录
              </div>
            ) : (
              <div className="h-[260px]">
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

        {/* 账单状态(近 7 日) */}
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

      {/* 兑换码看板(M6)+ 最近 audit */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              兑换码看板
            </CardTitle>
            <CardDescription>近 7 日签发 / 使用 / 撤销 节奏</CardDescription>
          </CardHeader>
          <CardContent>
            {state.loadingModules.codes && !state.codesKpi ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                加载中…
              </div>
            ) : !state.codesKpi ? (
              <div className="text-sm text-muted-foreground">暂无数据</div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <MiniStat
                  label="7 日新签发"
                  value={state.codesKpi.issuedLast7Days}
                  accent="text-indigo-500"
                />
                <MiniStat
                  label="7 日已使用"
                  value={state.codesKpi.consumedLast7Days}
                  accent="text-emerald-500"
                />
                <MiniStat
                  label="7 日已撤销"
                  value={state.codesKpi.revokedLast7Days}
                  accent="text-rose-500"
                />
                <div className="col-span-3 mt-2 text-xs text-muted-foreground">
                  当前有效可兑换的码共{" "}
                  <span className="font-mono font-medium text-foreground">
                    {state.codesKpi.activeCount.toLocaleString()}
                  </span>{" "}
                  个
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
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
            {state.loadingModules.recentAudit && state.recent.length === 0 ? (
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

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}): React.ReactElement {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold tabular-nums", accent)}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}