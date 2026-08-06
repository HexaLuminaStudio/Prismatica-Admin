/**
 * 凭证签发页(2026-08-06 实现)
 *
 * 功能:
 *  - 批量签发 INV/TRY/RCH(弹窗:kind/count/参数)
 *  - 凭证列表(过滤 kind/status,分页)
 *  - 行:复制明文 code / 撤销
 *  - 单码查询(lookup):输入明文 code → 查 status
 */

import * as React from "react";
import {
  Ticket,
  Plus,
  Search,
  RefreshCcw,
  Copy,
  Ban,
  X,
  Check,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  CodeKind,
  IssuedCodeItem,
  CodeListItem,
  issueCodes,
  listCodes,
  revokeCode,
  lookupCode,
  CodeLookupResponse,
} from "@/api/codes";
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
import { formatDate, cn, maskCodeTail } from "@/lib/utils";
import {
  kindLabel,
  kindDesc,
  codeStatusLabel,
} from "@/lib/labels";

const KIND_LABELS: Record<CodeKind, string> = {
  invite: "邀请码(赠 balance+tier)",
  trial: "体验码(短周期 trial)",
  recharge: "充值码(直接加 amount)",
};

const STATUS_BADGE: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  active: "default",
  consumed: "secondary",
  revoked: "destructive",
  expired: "outline",
};

export function CodesPage(): React.ReactElement {
  const [items, setItems] = React.useState<CodeListItem[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [filterKind, setFilterKind] = React.useState<"" | CodeKind>("");
  const [filterStatus, setFilterStatus] = React.useState<"" | "active" | "consumed" | "revoked" | "expired">("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [issueOpen, setIssueOpen] = React.useState(false);
  const [lookupOpen, setLookupOpen] = React.useState(false);
  const [issuedBatch, setIssuedBatch] = React.useState<IssuedCodeItem[] | null>(null);

  const load = React.useCallback(
    async (opts: { reset?: boolean; cursor?: string } = {}) => {
      setLoading(true);
      setError(null);
      try {
        const resp = await listCodes({
          limit: 50,
          ...(filterKind ? { kind: filterKind } : {}),
          ...(filterStatus ? { status: filterStatus } : {}),
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
    [filterKind, filterStatus]
  );

  React.useEffect(() => {
    void load({ reset: true });
  }, [load]);

  const onRevoke = async (codeHash: string) => {
    if (!confirm(`确定撤销凭证 ${codeHash.slice(0, 12)}…?`)) return;
    try {
      const r = await revokeCode(codeHash);
      setError(`已撤销 ${r.codeHash.slice(0, 8)}…(status=${r.status})`);
      void load({ reset: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "撤销失败");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              凭证签发
            </CardTitle>
            <CardDescription>INV/TRY/RCH 码批量签发与查询</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setLookupOpen(true)}>
              <Search className="mr-1 h-4 w-4" />
              查码
            </Button>
            <Button size="sm" onClick={() => setIssueOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              签发
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">凭证类型:</span>
            {(["", "invite", "trial", "recharge"] as const).map((k) => (
              <Button
                key={k || "all"}
                size="sm"
                variant={filterKind === k ? "default" : "outline"}
                onClick={() => setFilterKind(k as typeof filterKind)}
              >
                {k ? kindLabel(k) : "全部"}
              </Button>
            ))}
            <span className="ml-4 text-muted-foreground">状态:</span>
            {(["", "active", "consumed", "revoked", "expired"] as const).map((s) => (
              <Button
                key={s || "all-s"}
                size="sm"
                variant={filterStatus === s ? "default" : "outline"}
                onClick={() => setFilterStatus(s as typeof filterStatus)}
              >
                {s ? codeStatusLabel(s) : "全部"}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void load({ reset: true })}
              disabled={loading}
              className="ml-2"
            >
              <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
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
                  <th className="py-2 text-left font-medium">codeHash</th>
                  <th className="py-2 text-left font-medium">kind</th>
                  <th className="py-2 text-left font-medium">status</th>
                  <th className="py-2 text-left font-medium">面值</th>
                  <th className="py-2 text-left font-medium">签发人</th>
                  <th className="py-2 text-left font-medium">签发时间</th>
                  <th className="py-2 text-left font-medium">消费信息</th>
                  <th className="py-2 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      暂无凭证
                    </td>
                  </tr>
                )}
                {items.map((c) => (
                  <tr key={c.codeHash} className="border-b">
                    <td className="py-2 font-mono text-xs">{c.codeHash.slice(0, 12)}…</td>
                    <td className="py-2">
                      <Badge variant="outline">{c.codeKind}</Badge>
                    </td>
                    <td className="py-2">
                      <Badge variant={STATUS_BADGE[c.status] ?? "outline"}>{c.status}</Badge>
                    </td>
                    <td className="py-2 text-xs">
                      {c.codeKind === "recharge"
                        ? `+${c.amount ?? 0}`
                        : `赠 ${c.grantedBalance ?? 0} / ${c.grantedDays ?? 0}d`}
                    </td>
                    <td className="py-2 text-xs">{c.issuedBy}</td>
                    <td className="py-2 text-xs">{formatDate(c.issuedAt)}</td>
                    <td className="py-2 text-xs">
                      {c.consumedAt ? (
                        <span>
                          {formatDate(c.consumedAt)} by{" "}
                          <span className="font-mono">
                            {c.consumedByUserId?.slice(0, 8) ?? "?"}…
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {c.status === "active" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void onRevoke(c.codeHash)}
                        >
                          <Ban className="mr-1 h-3 w-3" />
                          撤销
                        </Button>
                      )}
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

      {issueOpen && (
        <IssueDialog
          onClose={() => setIssueOpen(false)}
          onDone={async (items, msg) => {
            setIssuedBatch(items);
            setIssueOpen(false);
            setError(msg);
            await load({ reset: true });
          }}
        />
      )}

      {issuedBatch && (
        <IssuedResultDialog
          items={issuedBatch}
          onClose={() => setIssuedBatch(null)}
        />
      )}

      {lookupOpen && (
        <LookupDialog onClose={() => setLookupOpen(false)} />
      )}
    </div>
  );
}

function IssueDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (items: IssuedCodeItem[], msg: string) => void;
}): React.ReactElement {
  const [kind, setKind] = React.useState<CodeKind>("invite");
  const [count, setCount] = React.useState("5");
  const [grantedBalance, setGrantedBalance] = React.useState("100");
  const [grantedDays, setGrantedDays] = React.useState("30");
  const [tier, setTier] = React.useState("beta");
  const [amount, setAmount] = React.useState("50");
  const [expireDays, setExpireDays] = React.useState("14");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const isRecharge = kind === "recharge";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const c = Number(count);
      if (!Number.isFinite(c) || c < 1 || c > 1000) {
        throw new Error("签发数量必须在 1~1000 之间");
      }
      const params = {
        kind,
        count: c,
        ...(isRecharge
          ? { amount: Number(amount) }
          : {
              grantedBalance: Number(grantedBalance),
              grantedDays: Number(grantedDays),
              tier,
            }),
        expireDays: Number(expireDays),
      };
      const resp = await issueCodes(params);
      onDone(
        resp.items,
        `成功签发 ${resp.items.length} 个「${kindLabel(kind)}」`
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "签发失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="批量签发凭证" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1">
          <Label>凭证类型</Label>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {(["invite", "trial", "recharge"] as CodeKind[]).map((k) => (
              <Button
                key={k}
                type="button"
                size="sm"
                variant={kind === k ? "default" : "outline"}
                onClick={() => setKind(k)}
                disabled={busy}
              >
                {kind === k ? <Check className="mr-1 h-3 w-3" /> : null}
                {kindLabel(k)}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{kindDesc(kind)}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="count">签发数量</Label>
            <Input
              id="count"
              type="number"
              min={1}
              max={1000}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="expireDays">有效期(天)</Label>
            <Input
              id="expireDays"
              type="number"
              min={1}
              value={expireDays}
              onChange={(e) => setExpireDays(e.target.value)}
              disabled={busy}
            />
          </div>
        </div>

        {isRecharge ? (
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
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="balance">赠送余额</Label>
              <Input
                id="balance"
                type="number"
                min={0}
                value={grantedBalance}
                onChange={(e) => setGrantedBalance(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="days">赠送天数</Label>
              <Input
                id="days"
                type="number"
                min={1}
                value={grantedDays}
                onChange={(e) => setGrantedDays(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tier">会员等级</Label>
              <Input
                id="tier"
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>
        )}

        {err && <div className="text-sm text-destructive">{err}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            取消
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            签发
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function IssuedResultDialog({
  items,
  onClose,
}: {
  items: IssuedCodeItem[];
  onClose: () => void;
}): React.ReactElement {
  const [copied, setCopied] = React.useState<string | null>(null);
  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <Modal title={`签发成功(${items.length} 个)`} onClose={onClose}>
      <div className="mb-3 text-xs text-muted-foreground">
        明文 code 仅在此窗口显示一次,请立即复制保存。
      </div>
      <div className="max-h-80 space-y-1 overflow-y-auto">
        {items.map((it) => (
          <div
            key={it.codeHash}
            className="flex items-center justify-between rounded-md border bg-muted/30 px-2 py-1.5 text-xs"
          >
            <span className="font-mono">{it.code}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void copy(it.code)}
            >
              {copied === it.code ? (
                <Check className="h-3 w-3 text-emerald-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <Button onClick={onClose}>已保存,关闭</Button>
      </div>
    </Modal>
  );
}

function LookupDialog({ onClose }: { onClose: () => void }): React.ReactElement {
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<CodeLookupResponse | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setErr("请输入 code");
      return;
    }
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const r = await lookupCode(code.trim());
      setResult(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "查询失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="查码" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="lookup">明文 code</Label>
          <Input
            id="lookup"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="INV-XXXX-XXXX-XXXX-XXXX"
            disabled={busy}
          />
        </div>
        {err && <div className="text-sm text-destructive">{err}</div>}
        {result && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
            <div>
              <span className="text-muted-foreground">codeHash: </span>
              <span className="font-mono">{result.codeHash}</span>
            </div>
            <div>
              <span className="text-muted-foreground">codeKind: </span>
              <Badge variant="outline">{result.codeKind}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground">status: </span>
              <Badge variant={STATUS_BADGE[result.status] ?? "outline"}>
                {result.status}
              </Badge>
            </div>
            {result.consumedAt && (
              <div>
                <span className="text-muted-foreground">consumedAt: </span>
                {formatDate(result.consumedAt)}
              </div>
            )}
            {result.consumedByUserId && (
              <div>
                <span className="text-muted-foreground">consumedBy: </span>
                <span className="font-mono">
                  {maskCodeTail(result.consumedByUserId, 6, 4)}
                </span>
              </div>
            )}
            {result.rechargeAmount != null && (
              <div>
                <span className="text-muted-foreground">rechargeAmount: </span>
                {result.rechargeAmount}
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            关闭
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            查询
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
      <div className="w-full max-w-xl rounded-lg border bg-card p-5 shadow-xl">
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