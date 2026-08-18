/**
 * Dashboard(2026-08-18 视觉重构)
 *
 * - 顶部 KPI 行(5 个核心指标,带趋势线占位)
 * - 订阅 tier 分布 + 近 7 日审计分布 + 账单状态三栏
 * - 兑换码 7 日看板 + 最近审计
 * - 全部使用模块化失败容错,部分失败不阻塞其他模块
 */
import * as React from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Activity,
  Coins,
  Clock,
  RefreshCcw,
  Ticket,
  PieChart as PieIcon,
  TrendingUp,
  AlertTriangle,
  Loader2,
  Sparkles,
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
import { cn, formatDate } from "@/lib/utils";
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
  iconBg?: string;
}

function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  accent = "text-primary",
  iconBg = "bg-primary/10",
}: KpiCardProps): React.ReactElement {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="text-[12px] font-medium text-muted-foreground">{title}</div>
            <div className="tabular text-[28px] font-semibold leading-none tracking-tight">
              <span>
                {value === "—" ? <span className="text-muted-foreground/40">—</span> : value}
              </span>
            </div>
            {description && (
              <div className="text-[11px] leading-relaxed text-muted-foreground">
                {description}
              </div>
            )}
          </div>
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              iconBg
            )}
          >
            <Icon className={cn("h-4 w-4", accent)} />
          </span>
        </div>
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

const MODULE_KEYS: ModuleKey[] = [
  "metrics",
  "subscription",
  "codes",
  "auditSummary",
  "recentAudit",
];

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
  pro: "#16a39e",
  team: "#0ea5e9",
};

const FALLBACK_COLORS = ["#16a39e", "#0ea5e9", "#a78bfa", "#34d399", "#f59e0b", "#f472b6"];

function pickColor(tier: string, idx: number): string {
  return TIER_COLORS[tier] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
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
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="page-header">
        <div>
          <h1 className="page-title">仪表盘</h1>
          <p className="page-subtitle">
            {me ? `${me.username} · 你好,以下是平台近况` : "以下是平台近况"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          aria-busy={isLoading}
        >
          <RefreshCcw className={cn(isLoading && "animate-spin")} />
          刷新
        </Button>
      </div>

      {/* KPI 行 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          title="用户总数"
          value={state.metrics?.userCount ?? "—"}
          description="平台注册用户总人数"
          icon={Users}
          accent="text-sky-600"
          iconBg="bg-sky-500/10"
        />
        <KpiCard
          title="7 日活跃设备"
          value={state.metrics?.sevenDayActive ?? "—"}
          description="过去 7 天有过活跃"
          icon={Activity}
          accent="text-emerald-600"
          iconBg="bg-emerald-500/10"
        />
        <KpiCard
          title="7 日充值总额"
          value={state.metrics?.sevenDayGrantTotal ?? "—"}
          description="过去 7 天累计充值余额"
          icon={Coins}
          accent="text-amber-600"
          iconBg="bg-amber-500/10"
        />
        <KpiCard
          title="待结算账单"
          value={state.metrics?.billsPending ?? "—"}
          description="pending 状态账单数"
          icon={Clock}
          accent="text-rose-600"
          iconBg="bg-rose-500/10"
        />
        <KpiCard
          title="活跃兑换码"
          value={state.codesKpi?.activeCount ?? "—"}
          description="已签发且未过期"
          icon={Ticket}
          accent="text-indigo-600"
          iconBg="bg-indigo-500/10"
        />
      </div>

      {errorMessages.length > 0 && !isLoading && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">部分仪表盘模块加载失败</div>
            <div className="mt-0.5 break-all text-destructive/90">
              {errorMessages.join("；")}
            </div>
          </div>
        </div>
      )}

      {/* 图表三栏 */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-7">
        {/* 订阅分布 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-muted-foreground" />
              订阅分布
            </CardTitle>
            <CardDescription>
              按当前 tier 统计(总 {state.subscriptionTotal.toLocaleString()})
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state.loadingModules.subscription && state.subscriptionDistribution.length === 0 ? (
              <ModuleSkeleton />
            ) : state.subscriptionDistribution.length === 0 ? (
              <EmptyHint text="暂无订阅数据" />
            ) : (
              <div className="space-y-3">
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={state.subscriptionDistribution}
                        dataKey="count"
                        nameKey="tier"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={2}
                        strokeWidth={0}
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
                <div className="space-y-1.5">
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
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: pickColor(d.tier, idx) }}
                          />
                          <span className="text-foreground">{userTierLabel(d.tier)}</span>
                        </div>
                        <div className="tabular text-muted-foreground">
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
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              近 7 日 admin 行为分布
            </CardTitle>
            <CardDescription>按 audit_logs.action group by 计 count</CardDescription>
          </CardHeader>
          <CardContent>
            {state.loadingModules.auditSummary && state.summary.length === 0 ? (
              <ModuleSkeleton />
            ) : state.summary.length === 0 ? (
              <EmptyHint text="近 7 日暂无管理员操作记录" />
            ) : (
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={state.summary} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="action"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      width={32}
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
                      maxBarSize={40}
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
            <CardDescription>settled / refunded 占比</CardDescription>
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
              <div className="border-t pt-3 text-[11px] leading-relaxed text-muted-foreground">
                柱长 = 该状态占比;色块越长表示该状态越活跃
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 兑换码看板 + 最近 audit */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-7">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-muted-foreground" />
              兑换码看板
            </CardTitle>
            <CardDescription>近 7 日签发 / 使用 / 撤销 节奏</CardDescription>
          </CardHeader>
          <CardContent>
            {state.loadingModules.codes && !state.codesKpi ? (
              <ModuleSkeleton />
            ) : !state.codesKpi ? (
              <EmptyHint text="暂无兑换码数据" />
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <MiniStat
                    label="7 日新签发"
                    value={state.codesKpi.issuedLast7Days}
                    accent="text-indigo-600"
                  />
                  <MiniStat
                    label="7 日已使用"
                    value={state.codesKpi.consumedLast7Days}
                    accent="text-emerald-600"
                  />
                  <MiniStat
                    label="7 日已撤销"
                    value={state.codesKpi.revokedLast7Days}
                    accent="text-rose-600"
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">当前有效可兑换</span>
                  <span className="tabular text-sm font-semibold text-foreground">
                    {state.codesKpi.activeCount.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                最近审计
              </CardTitle>
              <CardDescription>audit_logs DESC by createdAt(展示 8 条)</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/audit">查看全部 →</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {state.loadingModules.recentAudit && state.recent.length === 0 ? (
              <ModuleSkeleton />
            ) : state.recent.length === 0 ? (
              <EmptyHint text="暂无审计日志" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-[11px] uppercase text-muted-foreground">
                      <th className="py-2 pr-3 text-left font-medium">时间</th>
                      <th className="py-2 pr-3 text-left font-medium">操作员</th>
                      <th className="py-2 pr-3 text-left font-medium">动作</th>
                      <th className="py-2 pr-3 text-left font-medium">目标</th>
                      <th className="py-2 text-left font-medium">详情</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.recent.map((row) => (
                      <tr key={row.auditId} className="border-b last:border-0 table-row-hover">
                        <td className="py-2 pr-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          {formatDate(row.createdAt)}
                        </td>
                        <td className="py-2 pr-3 font-medium text-foreground whitespace-nowrap">
                          {row.actor}
                        </td>
                        <td className="py-2 pr-3">
                          <Badge variant="secondary">{row.action}</Badge>
                        </td>
                        <td className="py-2 pr-3 font-mono text-[11px] text-ellipsis max-w-[120px]">
                          {row.targetUser ?? "—"}
                        </td>
                        <td className="py-2 text-[11px] text-muted-foreground text-ellipsis max-w-[260px]">
                          {row.details
                            ? Object.entries(row.details)
                                .map(([k, v]) => `${k}=${String(v).slice(0, 24)}`)
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

function ModuleSkeleton(): React.ReactElement {
  return (
    <div className="flex h-[180px] items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      加载中…
    </div>
  );
}

function EmptyHint({ text }: { text: string }): React.ReactElement {
  return (
    <div className="flex h-[180px] items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
      {text}
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
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular text-muted-foreground">
          {value.toLocaleString()} ({pct}%)
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
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
    <div className="rounded-md border bg-muted/30 px-3 py-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn("tabular mt-1 text-2xl font-semibold", accent)}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}