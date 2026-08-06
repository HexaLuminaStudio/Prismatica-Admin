/**
 * 用户管理页(2026-08-06 实现)
 *
 * 功能:
 *  - 列表 + 模糊搜索(q 关键字 / 分页 nextCursor)
 *  - 行展开:详情/加余额/撤销会话
 *  - 改 tier/状态(弹窗)
 */

import * as React from "react";
import {
  Users as UsersIcon,
  Search,
  RefreshCcw,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Coins,
  KeyRound,
  X,
  Edit2,
  Check,
  Download,
} from "lucide-react";
import {
  AdminUserItem,
  AdminUserDetail,
  getUserDetail,
  grantBalance,
  listUsers,
  revokeUserSessions,
  updateUser,
} from "@/api/users";
import { ApiClientError } from "@/api/client";
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

const TIERS = ["guest", "trial", "beta", "beta_pro", "paid"] as const;
type Tier = (typeof TIERS)[number];

const STATUSES = ["active", "suspended", "expired"] as const;
type Status = (typeof STATUSES)[number];

function tierVariant(t: string): "default" | "secondary" | "outline" {
  if (t === "paid" || t === "beta_pro") return "default";
  if (t === "trial") return "outline";
  return "secondary";
}

function statusVariant(s: string): "default" | "destructive" | "outline" {
  if (s === "active") return "default";
  if (s === "expired") return "outline";
  return "destructive";
}

export function UsersPage(): React.ReactElement {
  const [items, setItems] = React.useState<AdminUserItem[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<Record<string, AdminUserDetail | "loading" | null>>({});
  const [exporting, setExporting] = React.useState(false);

  const onExport = async () => {
    setExporting(true);
    setError(null);
    try {
      await downloadCsv(
        "/v1/admin/export/users.csv",
        `users-${new Date().toISOString().slice(0, 10)}.csv`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "导出失败");
    } finally {
      setExporting(false);
    }
  };

  const load = React.useCallback(
    async (opts: { reset?: boolean; cursor?: string; keyword?: string } = {}) => {
      setLoading(true);
      setError(null);
      try {
        const resp = await listUsers({
          limit: 50,
          ...(opts.cursor ? { cursor: opts.cursor } : {}),
          ...(opts.keyword !== undefined ? { q: opts.keyword } : {}),
        });
        setItems((prev) => (opts.reset ? resp.items : [...prev, ...resp.items]));
        setNextCursor(resp.nextCursor);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  React.useEffect(() => {
    void load({ reset: true });
  }, [load]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void load({ reset: true, keyword: q });
  };

  const toggleExpand = async (userId: string) => {
    if (expanded === userId) {
      setExpanded(null);
      return;
    }
    setExpanded(userId);
    if (!detail[userId]) {
      setDetail((d) => ({ ...d, [userId]: "loading" }));
      try {
        const data = await getUserDetail(userId);
        setDetail((d) => ({ ...d, [userId]: data }));
      } catch (e) {
        setDetail((d) => ({ ...d, [userId]: null }));
        setError(e instanceof Error ? e.message : "加载详情失败");
      }
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
            <CardDescription>列表 / 搜索 / 加余额 / 强制下线 / 改 tier</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void onExport()}
              disabled={exporting || loading}
            >
              {exporting ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1 h-4 w-4" />
              )}
              导出 CSV
            </Button>
            <form onSubmit={onSearch} className="flex w-72 items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="搜索 displayName / userId"
                  className="pl-8"
                />
              </div>
              <Button type="submit" variant="outline" size="sm" disabled={loading}>
                <Search className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void load({ reset: true, keyword: q })}
                disabled={loading}
              >
                <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <div>
                <div className="font-medium">加载失败</div>
                <div>{error}</div>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-muted-foreground">
                  <th className="w-8 py-2 text-left"></th>
                  <th className="py-2 text-left font-medium">用户 ID</th>
                  <th className="py-2 text-left font-medium">用户名</th>
                  <th className="py-2 text-left font-medium">会员等级</th>
                  <th className="py-2 text-left font-medium">状态</th>
                  <th className="py-2 text-right font-medium">当前余额</th>
                  <th className="py-2 text-right font-medium">累计充值</th>
                  <th className="py-2 text-right font-medium">累计消费</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      暂无数据
                    </td>
                  </tr>
                )}
                {items.map((u) => (
                  <React.Fragment key={u.userId}>
                    <tr
                      className="cursor-pointer border-b hover:bg-accent/40"
                      onClick={() => void toggleExpand(u.userId)}
                    >
                      <td className="py-2">
                        {expanded === u.userId ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </td>
                      <td className="py-2 font-mono text-xs">{u.userId.slice(0, 8)}…</td>
                      <td className="py-2 font-medium">{u.displayName}</td>
                      <td className="py-2">
                        <Badge variant={tierVariant(u.tier)}>{u.tier}</Badge>
                      </td>
                      <td className="py-2">
                        <Badge variant={statusVariant(u.status)}>{u.status}</Badge>
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {u.balance.toLocaleString()}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {u.totalRecharged.toLocaleString()}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {u.totalSpent.toLocaleString()}
                      </td>
                    </tr>
                    {expanded === u.userId && (
                      <tr className="border-b bg-muted/30">
                        <td colSpan={8} className="p-4">
                          <UserDetailRow
                            userId={u.userId}
                            detail={detail[u.userId]}
                            onChanged={async () => {
                              // 重新拉详情
                              setDetail((d) => ({ ...d, [u.userId]: "loading" }));
                              try {
                                const data = await getUserDetail(u.userId);
                                setDetail((d) => ({ ...d, [u.userId]: data }));
                                void load({ reset: true, keyword: q });
                              } catch {
                                setDetail((d) => ({ ...d, [u.userId]: null }));
                              }
                            }}
                            onError={setError}
                          />
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
                onClick={() => void load({ cursor: nextCursor, keyword: q })}
              >
                {loading ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : null}
                加载更多
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UserDetailRow({
  userId,
  detail,
  onChanged,
  onError,
}: {
  userId: string;
  detail: AdminUserDetail | "loading" | null | undefined;
  onChanged: () => Promise<void> | void;
  onError: (msg: string) => void;
}): React.ReactElement {
  if (detail === "loading" || detail === undefined) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        加载详情…
      </div>
    );
  }
  if (detail === null) {
    return <div className="text-sm text-destructive">详情加载失败</div>;
  }

  return (
    <UserDetailActions
      userId={userId}
      detail={detail}
      onChanged={onChanged}
      onError={onError}
    />
  );
}

function UserDetailActions({
  userId,
  detail,
  onChanged,
  onError,
}: {
  userId: string;
  detail: AdminUserDetail;
  onChanged: () => Promise<void> | void;
  onError: (msg: string) => void;
}): React.ReactElement {
  const [grantOpen, setGrantOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<"" | "grant" | "revoke" | "edit">("");

  const onRevoke = async () => {
    if (!confirm(`确定要强制该用户(${userId.slice(0, 8)}…)下线吗?\n其所有登录会话将被撤销,需要重新登录。`)) return;
    setBusy("revoke");
    try {
      const r = await revokeUserSessions(userId, "admin 强制下线");
      onError(`已撤销 ${r.revokedCount} 个 session`);
      await onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "撤销失败");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs md:grid-cols-4">
        <div>
          <span className="text-muted-foreground">userId: </span>
          <span className="font-mono">{userId}</span>
        </div>
        <div>
          <span className="text-muted-foreground">余额: </span>
          <span className="font-medium tabular-nums">
            {detail.balance.toLocaleString()}
          </span>
          {detail.frozenBalance > 0 && (
            <span className="ml-1 text-muted-foreground">
              (冻结 {detail.frozenBalance.toLocaleString()})
            </span>
          )}
        </div>
        <div>
          <span className="text-muted-foreground">设备数: </span>
          <span className="font-medium">{detail.deviceCount}</span>
        </div>
        <div>
          <span className="text-muted-foreground">最近活跃: </span>
          <span className="font-medium">{formatDate(detail.lastSeenAt)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">到期: </span>
          <span className="font-medium">{formatDate(detail.expireAt)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">激活: </span>
          <span className="font-medium">{formatDate(detail.activatedAt)}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== ""}
          onClick={() => setEditOpen(true)}
        >
          <Edit2 className="mr-1 h-4 w-4" />
          改 tier / status
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== ""}
          onClick={() => setGrantOpen(true)}
        >
          <Coins className="mr-1 h-4 w-4" />
          加余额
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== ""}
          onClick={onRevoke}
        >
          {busy === "revoke" ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <KeyRound className="mr-1 h-4 w-4" />
          )}
          撤销所有 session
        </Button>
      </div>

      {grantOpen && (
        <GrantDialog
          userId={userId}
          onClose={() => setGrantOpen(false)}
          onDone={async (msg) => {
            onError(msg);
            setGrantOpen(false);
            await onChanged();
          }}
        />
      )}
      {editOpen && (
        <EditTierDialog
          userId={userId}
          initialTier={detail.tier}
          initialStatus={detail.status}
          onClose={() => setEditOpen(false)}
          onDone={async (msg) => {
            onError(msg);
            setEditOpen(false);
            await onChanged();
          }}
        />
      )}
    </div>
  );
}

function GrantDialog({
  userId,
  onClose,
  onDone,
}: {
  userId: string;
  onClose: () => void;
  onDone: (msg: string) => void;
}): React.ReactElement {
  const [amount, setAmount] = React.useState("100");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const a = Number(amount);
    if (!Number.isFinite(a) || a <= 0) {
      setErr("金额必须是大于 0 的整数");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await grantBalance(userId, a, note);
      onDone(`已为用户充值 ${a} 余额,当前余额 ${r.newBalance.toLocaleString()}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`为用户 ${userId.slice(0, 8)}… 充值`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="amount">充值金额</Label>
          <Input
            id="amount"
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="note">备注</Label>
          <Input
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="可选,如:客服补偿"
            disabled={busy}
          />
        </div>
        {err && <div className="text-sm text-destructive">{err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            取消
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            确认
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditTierDialog({
  userId,
  initialTier,
  initialStatus,
  onClose,
  onDone,
}: {
  userId: string;
  initialTier: string;
  initialStatus: string;
  onClose: () => void;
  onDone: (msg: string) => void;
}): React.ReactElement {
  const [tier, setTier] = React.useState<Tier>((initialTier as Tier) ?? "beta");
  const [status, setStatus] = React.useState<Status | "">(
    (STATUSES as readonly string[]).includes(initialStatus) ? (initialStatus as Status) : ""
  );
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await updateUser(userId, tier, status || undefined);
      onDone(`已更新会员等级为「${userTierLabel(tier)}」${status ? `, 状态为「${userStatusLabel(status)}」` : ""}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "操作失败";
      if (e instanceof ApiClientError) {
        setErr(`${msg}`);
      } else {
        setErr(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`改 tier / status(${userId.slice(0, 8)}…)`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1">
          <Label>tier</Label>
          <div className="flex flex-wrap gap-2">
            {TIERS.map((t) => (
              <Button
                key={t}
                type="button"
                size="sm"
                variant={tier === t ? "default" : "outline"}
                onClick={() => setTier(t)}
                disabled={busy}
              >
                {tier === t ? <Check className="mr-1 h-3 w-3" /> : null}
                {t}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label>status(可选)</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={status === "" ? "default" : "outline"}
              onClick={() => setStatus("")}
              disabled={busy}
            >
              保持不变
            </Button>
            {STATUSES.map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={status === s ? "default" : "outline"}
                onClick={() => setStatus(s)}
                disabled={busy}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>
        {err && <div className="text-sm text-destructive">{err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            取消
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            保存
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">{title}</div>
          <Button type="button" size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}