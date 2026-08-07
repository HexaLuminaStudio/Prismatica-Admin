/**
 * 礼包码管理页(2026-08-07 运营管理增强)
 *
 * 业务调整:
 *  - 新流程只保留「礼包码」一种凭证类型(gift);邀请码/体验码/充值码统一归并。
 *  - 状态文案统一由前端映射:exhausted → 已使用,active → 有效,revoked → 已撤销,expired → 已过期。
 *
 * 功能:
 *  - 批量签发向导(数量 / 有效期 / 赠送余额 / 天数 / 等级 / 备注)
 *  - 列表筛选(status)+ 分页 + 撤销 + 查码
 *  - 签发成功后弹明文(一次性展示 + 复制 / 下载 TXT)
 *  - CSV 导出(带当前筛选)
 *
 * 数据由 useCodesStore 提供。
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
  Download,
  FileText,
} from "lucide-react";
import {
  IssuedCodeItem,
  CodeLookupResponse,
} from "@/api/codes";
import { useCodesStore, DEFAULT_CODES_WIZARD, EMPTY_CODES_FILTERS, type CodesWizardDraft } from "@/store/codes";
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
import {
  formatDate,
  cn,
  maskCodeTail,
  copyToClipboard,
  downloadCsv,
  downloadTextFile,
} from "@/lib/utils";
import { kindLabel, codeStatusLabel } from "@/lib/labels";
import { classifyError } from "@/lib/errorMessages";
import { toast } from "@/components/Toast";

const STATUS_BADGE: Record<
  string,
  "default" | "destructive" | "secondary" | "outline"
> = {
  active: "default",
  exhausted: "secondary",
  revoked: "destructive",
  expired: "outline",
};

const STATUS_OPTIONS = [
  { value: "", label: "全部" },
  { value: "active", label: "有效" },
  { value: "exhausted", label: "已使用" },
  { value: "revoked", label: "已撤销" },
  { value: "expired", label: "已过期" },
] as const;

export function CodesPage(): React.ReactElement {
  const items = useCodesStore((s) => s.items);
  const nextCursor = useCodesStore((s) => s.nextCursor);
  const filters = useCodesStore((s) => s.filters);
  const setFilters = useCodesStore((s) => s.setFilters);
  const loadList = useCodesStore((s) => s.loadList);
  const loadMore = useCodesStore((s) => s.loadMore);
  const revoke = useCodesStore((s) => s.revoke);
  const listLoading = useCodesStore((s) => s.listLoading);
  const listError = useCodesStore((s) => s.listError);
  const lastIssuedBatch = useCodesStore((s) => s.lastIssuedBatch);
  const clearIssuedBatch = useCodesStore((s) => s.clearIssuedBatch);

  const [exporting, setExporting] = React.useState(false);
  const [issueOpen, setIssueOpen] = React.useState(false);
  const [lookupOpen, setLookupOpen] = React.useState(false);

  React.useEffect(() => {
    void loadList({ reset: true }).catch(() => {});
  }, [loadList]);

  const onExport = async () => {
    setExporting(true);
    try {
      const q = new URLSearchParams();
      if (filters.status) q.set("status", filters.status);
      const qs = q.toString();
      await downloadCsv(
        `/v1/admin/export/codes.csv${qs ? `?${qs}` : ""}`,
        `codes-${new Date().toISOString().slice(0, 10)}.csv`
      );
      toast({ kind: "success", title: "导出已开始" });
    } catch (e) {
      const msg = classifyError(e);
      toast({ kind: "error", title: "导出失败", description: msg.description });
    } finally {
      setExporting(false);
    }
  };

  const onRevoke = async (codeHash: string) => {
    if (!window.confirm(`确定撤销礼包码 ${codeHash.slice(0, 12)}…?`)) return;
    try {
      const r = await revoke(codeHash);
      toast({
        kind: "success",
        title: "礼包码已撤销",
        description: `status=${r.status}`,
      });
    } catch (e) {
      const msg = classifyError(e);
      toast({ kind: "error", title: msg.title, description: msg.description });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              礼包码
            </CardTitle>
            <CardDescription>
              统一凭证:用户登录后通过礼包码充值 / 开通会员
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
              variant="outline"
              size="sm"
              onClick={() => setLookupOpen(true)}
            >
              <Search className="mr-1 h-4 w-4" />
              查码
            </Button>
            <Button size="sm" onClick={() => setIssueOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              批量签发
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* 筛选条 */}
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">状态:</span>
            {STATUS_OPTIONS.map((o) => (
              <Button
                key={o.value || "all-s"}
                size="sm"
                variant={filters.status === o.value ? "default" : "outline"}
                onClick={() =>
                  setFilters({
                    status: o.value as
                      | ""
                      | "active"
                      | "exhausted"
                      | "revoked"
                      | "expired",
                  })
                }
                className="h-7"
              >
                {o.label}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void loadList({ reset: true })}
              disabled={listLoading}
              className="ml-2"
            >
              <RefreshCcw
                className={cn("h-4 w-4", listLoading && "animate-spin")}
              />
            </Button>
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
                  <th className="py-2 text-left font-medium">codeHash</th>
                  <th className="py-2 text-left font-medium">类型</th>
                  <th className="py-2 text-left font-medium">状态</th>
                  <th className="py-2 text-left font-medium">面值</th>
                  <th className="py-2 text-left font-medium">签发人</th>
                  <th className="py-2 text-left font-medium">签发时间</th>
                  <th className="py-2 text-left font-medium">消费信息</th>
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
                      暂无礼包码
                    </td>
                  </tr>
                )}
                {items.map((c) => (
                  <tr key={c.codeHash} className="border-b">
                    <td className="py-2 font-mono text-xs">
                      {maskCodeTail(c.codeHash, 10, 4)}
                    </td>
                    <td className="py-2">
                      <Badge variant="outline">{kindLabel(c.codeKind)}</Badge>
                    </td>
                    <td className="py-2">
                      <Badge variant={STATUS_BADGE[c.status] ?? "outline"}>
                        {codeStatusLabel(c.status)}
                      </Badge>
                    </td>
                    <td className="py-2 text-xs">
                      赠 {c.grantedBalance ?? 0} / {c.grantedDays ?? 0}d
                    </td>
                    <td className="py-2 text-xs">{c.issuedBy}</td>
                    <td className="py-2 text-xs">{formatDate(c.issuedAt)}</td>
                    <td className="py-2 text-xs">
                      {c.consumedAt ? (
                        <span>
                          {formatDate(c.consumedAt)} by{" "}
                          <span className="font-mono">
                            {maskCodeTail(c.consumedByUserId ?? "?", 8, 4)}
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

      {issueOpen && (
        <IssueDialog onClose={() => setIssueOpen(false)} />
      )}

      {lastIssuedBatch && (
        <IssuedResultDialog
          items={lastIssuedBatch}
          onClose={() => clearIssuedBatch()}
        />
      )}

      {lookupOpen && (
        <LookupDialog onClose={() => setLookupOpen(false)} />
      )}
    </div>
  );
}

/* ===================== 向导 ===================== */

function IssueDialog({ onClose }: { onClose: () => void }): React.ReactElement {
  const issue = useCodesStore((s) => s.issue);
  const [draft, setDraft] = React.useState<CodesWizardDraft>({
    ...DEFAULT_CODES_WIZARD,
  });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const set = <K extends keyof CodesWizardDraft>(
    key: K,
    value: CodesWizardDraft[K]
  ) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const c = draft.count;
    if (!Number.isInteger(c) || c < 1 || c > 1000) {
      setErr("签发数量必须是 1~1000 之间的整数");
      return;
    }
    if (!Number.isInteger(draft.expireDays) || draft.expireDays < 1) {
      setErr("有效期必须 ≥ 1 天");
      return;
    }
    if (
      !Number.isInteger(draft.grantedBalance) ||
      draft.grantedBalance < 0
    ) {
      setErr("赠送余额必须是非负整数");
      return;
    }
    if (
      !Number.isInteger(draft.grantedDays) ||
      draft.grantedDays < 1
    ) {
      setErr("赠送天数必须是 ≥ 1 的整数");
      return;
    }
    if (!draft.tier.trim()) {
      setErr("会员等级不能为空");
      return;
    }

    setBusy(true);
    try {
      const items = await issue(draft);
      toast({
        kind: "success",
        title: "签发成功",
        description: `共 ${items.length} 个礼包码`,
      });
      onClose();
    } catch (e2) {
      const msg = classifyError(e2);
      setErr(msg.description);
      toast({ kind: "error", title: msg.title, description: msg.description });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="批量签发礼包码" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1">
          <Label>凭证类型</Label>
          <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            当前统一为「礼包码」(用户登录后兑换即可充值 + 开通会员)
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="count">签发数量</Label>
            <Input
              id="count"
              type="number"
              min={1}
              max={1000}
              value={String(draft.count)}
              onChange={(e) => set("count", Number(e.target.value))}
              disabled={busy}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="expireDays">有效期(天)</Label>
            <Input
              id="expireDays"
              type="number"
              min={1}
              value={String(draft.expireDays)}
              onChange={(e) => set("expireDays", Number(e.target.value))}
              disabled={busy}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="balance">赠送余额</Label>
            <Input
              id="balance"
              type="number"
              min={0}
              value={String(draft.grantedBalance)}
              onChange={(e) =>
                set("grantedBalance", Number(e.target.value))
              }
              disabled={busy}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="days">赠送天数</Label>
            <Input
              id="days"
              type="number"
              min={1}
              value={String(draft.grantedDays)}
              onChange={(e) => set("grantedDays", Number(e.target.value))}
              disabled={busy}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tier">会员等级</Label>
            <Input
              id="tier"
              value={draft.tier}
              onChange={(e) => set("tier", e.target.value)}
              disabled={busy}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="note">备注(可选)</Label>
          <Input
            id="note"
            value={draft.note}
            onChange={(e) => set("note", e.target.value)}
            disabled={busy}
            placeholder="如:运营活动 2026Q3"
            maxLength={200}
          />
        </div>

        {err && <div className="text-sm text-destructive">{err}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={busy}
          >
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

/* ===================== 签发结果(明文一次性展示) ===================== */

function IssuedResultDialog({
  items,
  onClose,
}: {
  items: IssuedCodeItem[];
  onClose: () => void;
}): React.ReactElement {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const copy = async (code: string, key: string) => {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1500);
      toast({ kind: "success", title: "已复制到剪贴板" });
    } else {
      toast({ kind: "error", title: "复制失败", description: "请手动选中并复制" });
    }
  };

  const onDownloadTxt = () => {
    const lines = items.map((it) => it.code).join("\n");
    downloadTextFile(lines + "\n", `gift-codes-${new Date().toISOString().slice(0, 10)}.txt`);
    toast({ kind: "success", title: "TXT 文件已下载" });
  };

  const onCopyAll = async () => {
    const lines = items.map((it) => it.code).join("\n");
    await copy(lines, "__all__");
  };

  return (
    <Modal
      title={`签发成功(${items.length} 个 · 请立即保存)`}
      onClose={onClose}
      maxWidthClass="max-w-xl"
    >
      <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
        明文 code 仅在此窗口显示一次,关闭后无法再次查看,请立刻复制或下载 TXT。
      </div>
      <div className="mb-3 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => void onCopyAll()}>
          <Copy className="mr-1 h-3 w-3" />
          复制全部
        </Button>
        <Button size="sm" onClick={onDownloadTxt}>
          <FileText className="mr-1 h-3 w-3" />
          下载 TXT
        </Button>
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
              onClick={() => void copy(it.code, it.codeHash)}
            >
              {copiedKey === it.codeHash ? (
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

/* ===================== 单码查询 ===================== */

function LookupDialog({ onClose }: { onClose: () => void }): React.ReactElement {
  const lookup = useCodesStore((s) => s.lookup);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<CodeLookupResponse | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setErr("请输入 code");
      return;
    }
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const r = await lookup(trimmed);
      setResult(r);
    } catch (e2) {
      const msg = classifyError(e2);
      setErr(msg.description);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="单码查询" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="lookup">明文 code</Label>
          <Input
            id="lookup"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="PKG-XXXX-XXXX-XXXX-XXXX"
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
              <span className="text-muted-foreground">类型: </span>
              <Badge variant="outline">{kindLabel(result.codeKind)}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground">状态: </span>
              <Badge variant={STATUS_BADGE[result.status] ?? "outline"}>
                {codeStatusLabel(result.status)}
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
                  {maskCodeTail(result.consumedByUserId, 8, 4)}
                </span>
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

/* ===================== 通用 Modal ===================== */

function Modal({
  title,
  onClose,
  children,
  maxWidthClass = "max-w-xl",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClass?: string;
}): React.ReactElement {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className={cn(
          "w-full rounded-lg border bg-card p-5 shadow-xl",
          maxWidthClass
        )}
      >
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