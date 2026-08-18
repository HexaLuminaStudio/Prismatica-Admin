/**
 * UserDetailDrawer(2026-08-07 运营管理增强)
 *
 * 抽屉式用户详情:
 *  - 5 个 tab:基本信息 / 订阅 / 余额 / 设备 / 账本
 *  - 抽屉内操作:
 *      - 改会员等级 / 改状态 / 改邮箱 / 改昵称
 *      - 强制下线 / 手动赠送 / 重置密码(返回一次性明文)/ 删除
 *  - 写操作走 toast 反馈 + 后端 audit_log
 *
 * 数据由 useUsersStore 提供;不直接调 API。
 */

import * as React from "react";
import {
  X,
  Loader2,
  AlertTriangle,
  Coins,
  KeyRound,
  Power,
  Smartphone,
  Receipt,
  RefreshCcw,
  ChevronRight,
  Mail,
  Trash2,
  Copy,
  CalendarPlus,
  CheckCircle2,
} from "lucide-react";
import { useUsersStore, type DetailTab } from "@/store/users";
import {
  AdminUserDetail,
  AdminUserSubscription,
  AdminUserDevice,
  AdminUserLedgerItem,
  type SubscriptionPlanCode,
} from "@/api/users";
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
import { formatDate, cn, copyToClipboard } from "@/lib/utils";
import { userTierLabel, userStatusLabel } from "@/lib/labels";
import { classifyError } from "@/lib/errorMessages";
import { toast } from "@/components/Toast";

const TIER_OPTIONS = [
  { value: "free", label: "免费" },
  { value: "pro", label: "高级会员" },
  { value: "team", label: "团队会员" },
  { value: "guest", label: "游客" },
  { value: "trial", label: "体验用户" },
  { value: "beta", label: "内测用户" },
  { value: "beta_pro", label: "内测专业版" },
  { value: "paid", label: "付费用户" },
] as const;
const STATUS_OPTIONS = [
  { value: "active", label: "正常" },
  { value: "paused", label: "已停用" },
  { value: "banned", label: "已封禁" },
] as const;
const SUBSCRIPTION_PLANS: Array<{
  code: SubscriptionPlanCode;
  name: string;
  detail: string;
}> = [
  { code: "trial", name: "试用订阅", detail: "7 天 · 20 点额度" },
  { code: "pro_monthly", name: "Pro 月度", detail: "30 天 · 200 点额度" },
  { code: "team_monthly", name: "Team 月度", detail: "30 天 · 1,000 点额度" },
];
const SUBSCRIPTION_PLAN_NAMES = Object.fromEntries(
  SUBSCRIPTION_PLANS.map((plan) => [plan.code, plan.name])
) as Record<string, string>;
const SUBSCRIPTION_STATUS_NAMES: Record<string, string> = {
  active: "有效",
  expired: "已过期",
  canceled: "已取消",
  past_due: "待续费",
};
type Tier = (typeof TIER_OPTIONS)[number]["value"];
type Status = (typeof STATUS_OPTIONS)[number]["value"];

const isStatus = (value: string): value is Status =>
  STATUS_OPTIONS.some((option) => option.value === value);

const toEditableStatus = (value: string): Status | "" => {
  if (value === "suspended" || value === "expired") return "paused";
  return isStatus(value) ? value : "";
};

const TAB_LABELS: Record<DetailTab, string> = {
  info: "基本信息",
  subscription: "订阅",
  balance: "余额",
  devices: "设备",
  bills: "账本",
};

interface Props {
  userId: string | null;
  onClose: () => void;
}

export function UserDetailDrawer({ userId, onClose }: Props): React.ReactElement | null {
  const ensureDetail = useUsersStore((s) => s.ensureDetail);
  const loadTab = useUsersStore((s) => s.loadTab);
  const cache = useUsersStore((s) =>
    userId ? s.detailCache[userId] : null
  );

  const [tab, setTab] = React.useState<DetailTab>("info");

  // 抽屉打开 / 切换 userId 时拉详情
  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setTab("info");
    void (async () => {
      try {
        await ensureDetail(userId);
        if (!cancelled) {
          // 默认拉订阅 tab 数据(成本最低)
          void loadTab(userId, "subscription");
        }
      } catch (e) {
        const msg = classifyError(e);
        toast({ kind: "error", title: msg.title, description: msg.description });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, ensureDetail, loadTab]);

  // 切换 tab 时按需加载子数据
  React.useEffect(() => {
    if (!userId || tab === "info") return;
    const loadKey: Exclude<DetailTab, "info"> =
      tab === "balance" ? "bills" : tab;
    void loadTab(userId, loadKey);
  }, [userId, tab, loadTab]);

  if (!userId) return null;
  const isLoading = !cache || cache === "loading";
  const detail: AdminUserDetail | null =
    cache && cache !== "loading" ? cache.detail : null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-[720px] flex-col border-l bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div>
            <div className="text-sm font-semibold">用户详情</div>
            <div className="text-xs text-muted-foreground font-mono">{userId}</div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* tabs */}
        <div className="flex shrink-0 border-b px-2">
          {(Object.keys(TAB_LABELS) as DetailTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "relative px-3 py-2 text-xs font-medium transition-colors",
                tab === t
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {TAB_LABELS[t]}
              {tab === t && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded bg-primary" />
              )}
            </button>
          ))}
        </div>

        {/* body */}
        <div className="flex-1 overflow-auto p-5">
          {isLoading && (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载详情…
            </div>
          )}
          {!isLoading && cache === null && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              详情加载失败,请关闭后重试。
            </div>
          )}
          {detail && cache !== "loading" && (
            <>
              {tab === "info" && (
                <InfoTab detail={detail} userId={userId} onClose={onClose} />
              )}
              {tab === "subscription" && (
                <SubscriptionTab
                  cache={cache}
                  userId={userId}
                  onRefresh={() => void loadTab(userId, "subscription", true)}
                />
              )}
              {tab === "balance" && (
                <BalanceTab
                  cache={cache}
                  userId={userId}
                  detail={detail}
                  onRefresh={() => void loadTab(userId, "bills", true)}
                />
              )}
              {tab === "devices" && (
                <DevicesTab
                  cache={cache}
                  userId={userId}
                  onRefresh={() => void loadTab(userId, "devices", true)}
                />
              )}
              {tab === "bills" && (
                <LedgerTab
                  cache={cache}
                  detail={detail}
                  onRefresh={() => void loadTab(userId, "bills", true)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===================== 各 Tab ===================== */

function InfoTab({
  detail,
  userId,
  onClose,
}: {
  detail: AdminUserDetail;
  userId: string;
  onClose: () => void;
}): React.ReactElement {
  const changeProfile = useUsersStore((s) => s.changeProfile);
  const grant = useUsersStore((s) => s.grant);
  const revokeSessions = useUsersStore((s) => s.revokeSessions);
  const resetPassword = useUsersStore((s) => s.resetPassword);
  const removeUser = useUsersStore((s) => s.removeUser);

  const [tier, setTier] = React.useState<Tier>((detail.tier as Tier) ?? "free");
  const [status, setStatus] = React.useState<Status | "">(toEditableStatus(detail.status));
  const [email, setEmail] = React.useState(detail.email ?? "");
  const [displayName, setDisplayName] = React.useState(detail.displayName ?? "");
  const [busy, setBusy] = React.useState<
    "" | "profile" | "grant" | "revoke" | "reset" | "delete"
  >("");
  const [grantOpen, setGrantOpen] = React.useState(false);
  const [resetResult, setResetResult] = React.useState<string | null>(null);

  React.useEffect(() => {
    setTier((detail.tier as Tier) ?? "free");
    setStatus(toEditableStatus(detail.status));
    setEmail(detail.email ?? "");
    setDisplayName(detail.displayName ?? "");
  }, [detail.tier, detail.status, detail.email, detail.displayName]);

  const dirty =
    tier !== detail.tier ||
    (status !== "" && status !== detail.status) ||
    email !== (detail.email ?? "") ||
    displayName !== (detail.displayName ?? "");

  const onSaveProfile = async () => {
    setBusy("profile");
    try {
      await changeProfile(userId, {
        tier,
        status: status || undefined,
        email: email.trim() || undefined,
        displayName: displayName.trim() || undefined,
      });
      toast({ kind: "success", title: "已更新用户资料" });
    } catch (e) {
      const msg = classifyError(e);
      toast({ kind: "error", title: msg.title, description: msg.description });
    } finally {
      setBusy("");
    }
  };

  const onRevoke = async () => {
    if (
      !window.confirm(
        `确定强制该用户(${userId.slice(0, 8)}…)下线吗?\n其所有登录会话将被撤销,需要重新登录。`
      )
    )
      return;
    setBusy("revoke");
    try {
      const r = await revokeSessions(userId, "admin 强制下线");
      toast({
        kind: "success",
        title: "强制下线成功",
        description: `已撤销 ${r.revokedCount} 个 session`,
      });
    } catch (e) {
      const msg = classifyError(e);
      toast({ kind: "error", title: msg.title, description: msg.description });
    } finally {
      setBusy("");
    }
  };

  const onResetPassword = async () => {
    if (
      !window.confirm(
        `确定重置该用户(${userId.slice(0, 8)}…)的密码?所有 session 会被撤销,新密码仅展示一次。`
      )
    )
      return;
    setBusy("reset");
    try {
      const r = await resetPassword(userId);
      setResetResult(r.newPassword);
      toast({
        kind: "success",
        title: "密码已重置",
        description: "新密码仅在此抽屉中显示一次,请立刻保存或告知用户。",
      });
    } catch (e) {
      const msg = classifyError(e);
      toast({ kind: "error", title: msg.title, description: msg.description });
    } finally {
      setBusy("");
    }
  };

  const onDelete = async () => {
    const confirmText = window.prompt(
      `确定删除该用户(${userId.slice(0, 8)}…)?\n将撤销该用户所有会话并禁用设备。\n请输入 userId(${userId})以确认:`,
      ""
    );
    if (confirmText !== userId) return;
    setBusy("delete");
    try {
      await removeUser(userId);
      toast({ kind: "success", title: "用户已删除" });
      onClose();
    } catch (e) {
      const msg = classifyError(e);
      toast({ kind: "error", title: msg.title, description: msg.description });
    } finally {
      setBusy("");
    }
  };

  const onGrantSubmit = async (amount: number, note: string) => {
    setBusy("grant");
    try {
      const r = await grant(userId, amount, note);
      toast({
        kind: "success",
        title: "充值成功",
        description: `已赠送 ${amount} 积分,当前余额 ${r.newBalance.toLocaleString()}`,
      });
      setGrantOpen(false);
    } catch (e) {
      const msg = classifyError(e);
      toast({ kind: "error", title: msg.title, description: msg.description });
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-5">
      {/* summary grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-md border bg-muted/20 p-4 text-xs md:grid-cols-3">
        <SummaryItem label="邮箱" value={detail.email ?? "—"} />
        <SummaryItem label="userId" value={userId} mono />
        <SummaryItem label="会员等级" value={userTierLabel(detail.tier)} />
        <SummaryItem label="状态" value={userStatusLabel(detail.status)} />
        <SummaryItem
          label="余额"
          value={detail.balance.toLocaleString()}
          mono
        />
        {detail.frozenBalance > 0 && (
          <SummaryItem
            label="(冻结)"
            value={detail.frozenBalance.toLocaleString()}
            mono
          />
        )}
        <SummaryItem
          label="累计充值"
          value={(detail.lifetimeGrant ?? detail.totalRecharged).toLocaleString()}
          mono
        />
        <SummaryItem
          label="累计消费"
          value={(detail.lifetimeConsumed ?? detail.totalSpent).toLocaleString()}
          mono
        />
        <SummaryItem label="设备数" value={String(detail.deviceCount)} />
        <SummaryItem
          label="注册时间"
          value={formatDate(detail.registeredAt ?? detail.activatedAt)}
        />
        <SummaryItem label="激活时间" value={formatDate(detail.activatedAt)} />
        <SummaryItem label="到期时间" value={formatDate(detail.expireAt)} />
        <SummaryItem label="最近活跃" value={formatDate(detail.lastSeenAt)} />
      </div>

      {/* 操作区:基础资料 */}
      <section className="space-y-3 rounded-md border p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Mail className="h-4 w-4" />
          基础资料
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">邮箱</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy !== ""}
              type="email"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">显示名</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={busy !== ""}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">会员等级</div>
          <div className="flex flex-wrap gap-2">
            {TIER_OPTIONS.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={tier === option.value ? "default" : "outline"}
                disabled={busy !== ""}
                onClick={() => setTier(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">状态</div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={status === "" ? "default" : "outline"}
              disabled={busy !== ""}
              onClick={() => setStatus("")}
            >
              保持不变
            </Button>
            {STATUS_OPTIONS.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={status === option.value ? "default" : "outline"}
                disabled={busy !== ""}
                onClick={() => setStatus(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button
            size="sm"
            disabled={busy !== "" || !dirty}
            onClick={() => void onSaveProfile()}
          >
            {busy === "profile" ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : null}
            保存资料
          </Button>
        </div>
      </section>

      {/* 操作区:安全 / 账户管理 */}
      <section className="space-y-3 rounded-md border p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <KeyRound className="h-4 w-4" />
          快捷操作
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== ""}
            onClick={() => setGrantOpen(true)}
          >
            <Coins className="mr-1 h-4 w-4" />
            手动赠送
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== ""}
            onClick={() => void onRevoke()}
          >
            {busy === "revoke" ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Power className="mr-1 h-4 w-4" />
            )}
            强制下线
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== ""}
            onClick={() => void onResetPassword()}
          >
            {busy === "reset" ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="mr-1 h-4 w-4" />
            )}
            重置密码
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={busy !== ""}
            onClick={() => void onDelete()}
          >
            {busy === "delete" ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-1 h-4 w-4" />
            )}
            删除
          </Button>
        </div>

        {resetResult && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
            <div className="font-medium text-amber-700 dark:text-amber-300">
              新密码(仅展示一次):
            </div>
            <div className="mt-1 flex items-center gap-2">
              <code className="rounded bg-background px-2 py-1 font-mono">
                {resetResult}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void copyToClipboard(resetResult)}
              >
                <Copy className="mr-1 h-3 w-3" />
                复制
              </Button>
            </div>
          </div>
        )}
      </section>

      {grantOpen && (
        <GrantDialog
          onClose={() => setGrantOpen(false)}
          onSubmit={(amount, note) => void onGrantSubmit(amount, note)}
        />
      )}
    </div>
  );
}

function SummaryItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): React.ReactElement {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className={cn("font-medium", mono && "font-mono")}>{value}</div>
    </div>
  );
}

function SubscriptionTab({
  cache,
  userId,
  onRefresh,
}: {
  cache: ReturnType<typeof useUsersStore.getState>["detailCache"][string];
  userId: string;
  onRefresh: () => void;
}): React.ReactElement {
  const createSubscription = useUsersStore((s) => s.createSubscription);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  if (!cache || cache === "loading") return <></>;
  const loading = cache.loadingTabs.subscription;
  const err = cache.tabErrors.subscription;
  const items = cache.subscriptions;
  const hasActiveSubscription = (items ?? []).some(
    (item) =>
      item.status === "active" &&
      new Date(item.currentPeriodEnd).getTime() > Date.now()
  );

  const handleCreate = async (planCode: SubscriptionPlanCode) => {
    if (creating) return;
    setCreating(true);
    try {
      const result = await createSubscription(userId, planCode);
      setDialogOpen(false);
      toast({
        kind: "success",
        title: "订阅已开通",
        description: `资源下载权限已生效，同时派发 ${result.grantedBalance.toLocaleString()} 点额度。`,
      });
    } catch (error) {
      const message = classifyError(error);
      toast({
        kind: "error",
        title: message.title,
        description: message.description,
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <TabScaffold
        title="订阅"
        icon={<Receipt className="h-4 w-4" />}
        loading={!!loading}
        error={err ?? null}
        onRefresh={onRefresh}
        empty={false}
        emptyText=""
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-md border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                HSK 资源下载权限
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                有效的试用、Pro 或 Team 订阅均可下载受保护数据库。
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setDialogOpen(true)}
              disabled={hasActiveSubscription || creating}
            >
              {creating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CalendarPlus className="mr-2 h-4 w-4" />
              )}
              {hasActiveSubscription ? "已有有效订阅" : "开通订阅"}
            </Button>
          </div>

          {!loading && !err && (items?.length ?? 0) === 0 && (
            <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
              该用户暂无订阅记录，可从上方选择计划开通。
            </div>
          )}

          {items && items.length > 0 && (
            <div className="space-y-2">
          {items.map((s: AdminUserSubscription) => (
            <div
              key={s.subscriptionId}
              className="rounded-md border bg-muted/20 p-3 text-xs"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {SUBSCRIPTION_PLAN_NAMES[s.planCode] ?? s.planCode}
                  </div>
                  <div className="mt-0.5 text-muted-foreground">
                    {s.planCode}
                  </div>
                </div>
                <Badge
                  variant={
                    s.status === "active"
                      ? "default"
                      : s.status === "expired"
                        ? "outline"
                        : "destructive"
                  }
                >
                  {SUBSCRIPTION_STATUS_NAMES[s.status] ?? s.status}
                </Badge>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-y-1 md:grid-cols-4">
                <SummaryItem
                  label="本期额度"
                  value={s.monthlyQuota.toLocaleString()}
                  mono
                />
                <SummaryItem
                  label="周期"
                  value={`${formatDate(s.currentPeriodStart)} → ${formatDate(s.currentPeriodEnd)}`}
                />
                <SummaryItem label="开始" value={formatDate(s.startedAt)} />
                <SummaryItem
                  label="自动续费"
                  value={s.autoRenew ? "是" : "否"}
                />
              </div>
            </div>
          ))}
            </div>
          )}
        </div>
      </TabScaffold>
      {dialogOpen && (
        <SubscriptionDialog
          busy={creating}
          onClose={() => !creating && setDialogOpen(false)}
          onSubmit={(planCode) => void handleCreate(planCode)}
        />
      )}
    </>
  );
}

function SubscriptionDialog({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (planCode: SubscriptionPlanCode) => void;
}): React.ReactElement {
  const [planCode, setPlanCode] = React.useState<SubscriptionPlanCode>(
    "pro_monthly"
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscription-dialog-title"
    >
      <div className="w-full max-w-md rounded-lg border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div id="subscription-dialog-title" className="text-sm font-semibold">
              开通用户订阅
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              开通后资源下载权限立即生效，并派发该计划的首期额度。
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onClose}
            disabled={busy}
            aria-label="关闭开通订阅窗口"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2" role="radiogroup" aria-label="订阅计划">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const selected = planCode === plan.code;
            return (
              <button
                key={plan.code}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPlanCode(plan.code)}
                disabled={busy}
                className={cn(
                  "flex w-full items-center justify-between rounded-md border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-input hover:bg-muted/50"
                )}
              >
                <span>
                  <span className="block text-sm font-medium">{plan.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {plan.detail}
                  </span>
                </span>
                <span
                  className={cn(
                    "h-4 w-4 rounded-full border",
                    selected
                      ? "border-[5px] border-primary"
                      : "border-muted-foreground/40"
                  )}
                />
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            取消
          </Button>
          <Button type="button" onClick={() => onSubmit(planCode)} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            确认开通
          </Button>
        </div>
      </div>
    </div>
  );
}

function BalanceTab({
  cache,
  detail,
  onRefresh,
}: {
  cache: ReturnType<typeof useUsersStore.getState>["detailCache"][string];
  userId: string;
  detail: AdminUserDetail;
  onRefresh: () => void;
}): React.ReactElement {
  if (!cache || cache === "loading") return <></>;
  const loading = cache.loadingTabs.bills;
  const err = cache.tabErrors.bills;
  const items = cache.ledger ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/20 p-4 text-xs md:grid-cols-4">
        <SummaryItem
          label="当前余额"
          value={detail.balance.toLocaleString()}
          mono
        />
        <SummaryItem
          label="冻结"
          value={detail.frozenBalance.toLocaleString()}
          mono
        />
        <SummaryItem
          label="累计充值"
          value={(detail.lifetimeGrant ?? detail.totalRecharged).toLocaleString()}
          mono
        />
        <SummaryItem
          label="累计消费"
          value={(detail.lifetimeConsumed ?? detail.totalSpent).toLocaleString()}
          mono
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">最近账本(最多 20 条)</div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onRefresh}
          disabled={!!loading}
          aria-label="刷新账本"
        >
          <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>
      {err && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          {err}
        </div>
      )}
      {!err && items.length === 0 && !loading && (
        <div className="rounded-md border bg-muted/20 p-8 text-center text-xs text-muted-foreground">
          暂无账本记录
        </div>
      )}
      {!err && items.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">时间</th>
                <th className="px-3 py-2 text-left font-medium">类型</th>
                <th className="px-3 py-2 text-left font-medium">来源</th>
                <th className="px-3 py-2 text-right font-medium">金额</th>
                <th className="px-3 py-2 text-left font-medium">说明</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.ledgerId} className="border-t">
                  <td className="px-3 py-2 font-mono">{formatDate(it.createdAt)}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">{it.type}</Badge>
                  </td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">
                    {it.source}
                    {it.refId ? ` · ${it.refId.slice(0, 8)}…` : ""}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right tabular-nums",
                      it.amount < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {it.amount > 0 ? `+${it.amount}` : it.amount}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {it.note || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DevicesTab({
  cache,
  userId,
  onRefresh,
}: {
  cache: ReturnType<typeof useUsersStore.getState>["detailCache"][string];
  userId: string;
  onRefresh: () => void;
}): React.ReactElement {
  const revokeDevice = useUsersStore((s) => s.revokeDevice);
  if (!cache || cache === "loading") return <></>;
  const loading = cache.loadingTabs.devices;
  const err = cache.tabErrors.devices;
  const items = cache.devices ?? [];

  const onRevoke = async (d: AdminUserDevice) => {
    if (
      !window.confirm(
        `确定撤销设备「${d.deviceName || d.deviceId.slice(0, 8)}」吗?\n该设备将被强制下线。`
      )
    )
      return;
    try {
      await revokeDevice(userId, d.deviceId);
      toast({ kind: "success", title: "设备已撤销" });
    } catch (e) {
      const msg = classifyError(e);
      toast({ kind: "error", title: msg.title, description: msg.description });
    }
  };

  return (
    <TabScaffold
      title="设备"
      icon={<Smartphone className="h-4 w-4" />}
      loading={!!loading}
      error={err ?? null}
      onRefresh={onRefresh}
      empty={!loading && !err && items.length === 0}
      emptyText="该用户暂无设备绑定"
    >
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((d) => (
            <div
              key={d.deviceId}
              className="flex items-center justify-between rounded-md border bg-muted/20 p-3 text-xs"
            >
              <div>
                <div className="font-medium">
                  {d.deviceName || d.deviceId.slice(0, 8) + "…"}
                </div>
                <div className="text-muted-foreground">
                  <span className="font-mono">{d.deviceId.slice(0, 12)}…</span>
                  {" · "}
                  {d.platform}
                  {" · 最近活跃 "}
                  {formatDate(d.lastSeenAt)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    d.status === "active" ? "default" : d.status === "revoked" ? "destructive" : "outline"
                  }
                >
                  {d.status}
                </Badge>
                {d.status === "active" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void onRevoke(d)}
                  >
                    撤销
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </TabScaffold>
  );
}

function LedgerTab({
  cache,
  detail,
  onRefresh,
}: {
  cache: ReturnType<typeof useUsersStore.getState>["detailCache"][string];
  detail: AdminUserDetail;
  onRefresh: () => void;
}): React.ReactElement {
  return <BalanceTab cache={cache} detail={detail} userId="" onRefresh={onRefresh} />;
}

/* ===================== 公共组件 ===================== */

function TabScaffold({
  title,
  icon,
  loading,
  error,
  onRefresh,
  empty,
  emptyText,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onRefresh}
          disabled={loading}
          aria-label={`刷新${title}`}
        >
          <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          {error}
        </div>
      )}
      {loading && (
        <div className="flex h-24 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中…
        </div>
      )}
      {!loading && !error && empty && (
        <div className="rounded-md border bg-muted/20 p-8 text-center text-xs text-muted-foreground">
          {emptyText}
        </div>
      )}
      {!loading && !error && !empty && children}
    </div>
  );
}

function GrantDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (amount: number, note: string) => void;
}): React.ReactElement {
  const [amount, setAmount] = React.useState("100");
  const [note, setNote] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const a = Number(amount);
    if (!Number.isFinite(a) || a <= 0 || !Number.isInteger(a)) {
      setErr("金额必须是大于 0 的整数");
      return;
    }
    if (a > 100_000) {
      setErr("单次赠送不得超过 100,000");
      return;
    }
    onSubmit(a, note);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">手动赠送积分</div>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="amount">赠送数量</Label>
            <Input
              id="amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="note">备注</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="可选,如:客服补偿"
            />
          </div>
          {err && <div className="text-sm text-destructive">{err}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button type="submit">
              确认赠送
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const isTier = (value: string): value is Tier =>
  TIER_OPTIONS.some((option) => option.value === value);
