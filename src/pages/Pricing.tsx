import * as React from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  Check,
  History,
  Loader2,
  RefreshCcw,
  Rocket,
  X,
} from "lucide-react";
import {
  createPricingDraft,
  getPricingOverview,
  publishPricingVersion,
  type PricingOverview,
  type PricingRule,
} from "@/api/pricing";
import { toast } from "@/components/Toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { classifyError } from "@/lib/errorMessages";
import { formatDate } from "@/lib/utils";
import { useSessionStore } from "@/store/session";

const MODE_LABEL = { fixed: "固定价", token: "Token 计费", metered: "按量计费" } as const;

function numberValue(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function changedRuleCount(current: PricingRule[], original: PricingRule[]): number {
  const baseline = new Map(original.map((rule) => [rule.featureCode, JSON.stringify(rule)]));
  return current.filter((rule) => baseline.get(rule.featureCode) !== JSON.stringify(rule)).length;
}

export function PricingPage(): React.ReactElement {
  const me = useSessionStore((state) => state.me);
  const canPublish = me?.role === "owner";
  const [overview, setOverview] = React.useState<PricingOverview | null>(null);
  const [rules, setRules] = React.useState<PricingRule[]>([]);
  const [originalRules, setOriginalRules] = React.useState<PricingRule[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [publishing, setPublishing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [note, setNote] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPricingOverview();
      setOverview(data);
      setRules(data.rules.map((rule) => ({ ...rule })));
      setOriginalRules(data.rules.map((rule) => ({ ...rule })));
    } catch (loadError) {
      setError(classifyError(loadError).description);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const updateRule = (featureCode: string, patch: Partial<PricingRule>) => {
    setRules((items) =>
      items.map((rule) => (rule.featureCode === featureCode ? { ...rule, ...patch } : rule))
    );
  };

  const changed = changedRuleCount(rules, originalRules);

  const publish = async () => {
    setPublishing(true);
    try {
      const draft = await createPricingDraft(rules, note.trim() || "后台即时调价");
      await publishPricingVersion(draft.versionCode);
      toast({
        kind: "success",
        title: "新价格已发布",
        description: `版本 ${draft.versionCode} 已对新请求生效。`,
      });
      setConfirmOpen(false);
      setNote("");
      await load();
    } catch (publishError) {
      const message = classifyError(publishError);
      toast({ kind: "error", title: message.title, description: message.description });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between md:space-y-0">
          <div className="max-w-2xl">
            <CardTitle className="flex items-center gap-2">
              <BadgeDollarSign className="h-5 w-5" />
              定价中心
            </CardTitle>
            <CardDescription className="mt-1 leading-6">
              管理语料分析导出的公共固定价、语料下载与 HSK 作文导出的按量单价，以及平台 AI 的输入、输出 Token 单价。发布后仅影响新请求，进行中账单继续使用原价格快照。
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">当前版本 {overview?.activeVersion ?? "—"}</Badge>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || publishing}>
              <RefreshCcw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              刷新
            </Button>
            {canPublish && (
              <Button size="sm" disabled={loading || publishing || changed === 0} onClick={() => setConfirmOpen(true)}>
                <Rocket className="mr-1 h-4 w-4" />
                发布新价格{changed > 0 ? `（${changed} 项）` : ""}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!canPublish && (
            <div className="mb-4 flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
              当前账号可查看价格，但只有 owner 能创建并发布新版本。
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-start justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <span>{error}</span>
              <Button variant="ghost" size="sm" onClick={() => void load()}>重试</Button>
            </div>
          )}

          {loading ? (
            <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />正在加载价格目录…
            </div>
          ) : rules.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
              尚无价格规则，请先执行动态定价迁移。
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <div className="hidden grid-cols-[minmax(200px,1.3fr)_110px_minmax(260px,1.5fr)_220px_90px] gap-3 border-b bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground lg:grid">
                <span>收费功能</span><span>模式</span><span>单价</span><span>最低 / 最高</span><span>状态</span>
              </div>
              {rules.map((rule) => (
                <div key={rule.featureCode} className="grid gap-3 border-b px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(200px,1.3fr)_110px_minmax(260px,1.5fr)_220px_90px] lg:items-center">
                  <div>
                    <div className="text-sm font-medium">{rule.displayName}</div>
                    <div className="mt-0.5 font-mono text-xs text-muted-foreground">{rule.featureCode}</div>
                  </div>
                  <Badge variant="secondary" className="w-fit">{MODE_LABEL[rule.billingMode]}</Badge>
                  <RulePriceEditor rule={rule} disabled={!canPublish} onChange={(patch) => updateRule(rule.featureCode, patch)} />
                  <div className="grid grid-cols-2 gap-2">
                    <PriceInput label="最低" value={rule.minCost} disabled={!canPublish || rule.billingMode === "fixed"} onChange={(value) => updateRule(rule.featureCode, { minCost: value })} />
                    <PriceInput label="最高" value={rule.maxCost} disabled={!canPublish || rule.billingMode === "fixed"} onChange={(value) => updateRule(rule.featureCode, { maxCost: value })} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={rule.enabled} disabled={!canPublish} onChange={(event) => updateRule(rule.featureCode, { enabled: event.target.checked })} className="h-4 w-4 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                    {rule.enabled ? "启用" : "停用"}
                  </label>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" />发布历史</CardTitle>
          <CardDescription>最近 20 个价格版本；历史账单继续引用各自保存的规则快照。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y rounded-lg border">
            {(overview?.versions ?? []).map((version) => (
              <div key={version.versionCode} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium">{version.versionCode}</div>
                  <div className="text-xs text-muted-foreground">{version.note || "无发布说明"}</div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={version.status === "published" ? "default" : "secondary"}>{version.status === "published" ? "当前生效" : version.status === "draft" ? "草稿" : "已归档"}</Badge>
                  <span>{version.publishedAt ? formatDate(version.publishedAt) : formatDate(version.createdAt)}</span>
                </div>
              </div>
            ))}
            {!overview?.versions.length && <div className="px-4 py-8 text-center text-sm text-muted-foreground">暂无数据库价格版本，当前使用内置初始目录。</div>}
          </div>
        </CardContent>
      </Card>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="pricing-publish-title">
          <div className="w-full max-w-lg rounded-xl bg-card p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div><h2 id="pricing-publish-title" className="font-semibold">确认发布新价格</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{changed} 项价格将立即用于新请求；正在执行的任务不会改变。</p></div>
              <Button size="icon" variant="ghost" onClick={() => setConfirmOpen(false)} disabled={publishing} aria-label="关闭"><X className="h-4 w-4" /></Button>
            </div>
            <div className="mt-4 space-y-1.5"><Label htmlFor="pricing-note">发布说明</Label><Input id="pricing-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={255} placeholder="例如：调整 AI 输出 Token 单价" disabled={publishing} autoFocus /></div>
            <div className="mt-4 rounded-md border bg-muted/20 p-3 text-sm"><div className="flex items-center gap-2 font-medium"><Check className="h-4 w-4 text-emerald-600" />发布安全规则</div><ul className="mt-2 space-y-1 pl-6 text-muted-foreground"><li className="list-disc">旧版本自动归档，不删除历史记录</li><li className="list-disc">账单保存发布版本与完整价格快照</li><li className="list-disc">客户端最迟约 30 秒更新展示，执行前仍会重新报价</li></ul></div>
            <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={publishing}>取消</Button><Button onClick={() => void publish()} disabled={publishing}>{publishing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Rocket className="mr-1 h-4 w-4" />}确认发布</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function RulePriceEditor({ rule, disabled, onChange }: { rule: PricingRule; disabled: boolean; onChange: (patch: Partial<PricingRule>) => void }): React.ReactElement {
  if (rule.billingMode === "fixed") {
    return <PriceInput label="固定价" value={rule.fixedCost} disabled={disabled} onChange={(value) => onChange({ fixedCost: value, minCost: value, maxCost: value })} />;
  }
  if (rule.billingMode === "token") {
    return <div className="space-y-1"><div className="grid grid-cols-3 gap-2"><PriceInput label="Token 计量单位" value={rule.unitSize} disabled={disabled} onChange={(value) => onChange({ unitSize: Math.max(1, value), unitName: "Token", tokenPricingVersion: 2 })} /><PriceInput label="输入 / 单位" value={rule.inputTokenCostPerUnit} disabled={disabled} onChange={(value) => onChange({ inputTokenCostPerUnit: value, tokenPricingVersion: 2 })} /><PriceInput label="输出 / 单位" value={rule.outputTokenCostPerUnit} disabled={disabled} onChange={(value) => onChange({ outputTokenCostPerUnit: value, tokenPricingVersion: 2 })} /></div><p className="text-xs text-muted-foreground">每 {rule.unitSize.toLocaleString("zh-CN")} Token 为计价单位；{(rule.tokenPricingVersion ?? 2) >= 2 ? "输入、输出加权合计后仅向上取整一次" : "当前旧版输入、输出分别取整，重新发布后自动升级为合计取整"}</p></div>;
  }
  const countNoun = rule.unitName.endsWith("篇") ? "篇" : "条";
  return <div className="space-y-1"><PriceInput label={`${rule.unitName}单价`} value={rule.perUnitCost} disabled={disabled} onChange={(value) => onChange({ perUnitCost: value })} /><p className="text-xs text-muted-foreground">每 {rule.unitSize.toLocaleString("zh-CN")} {countNoun}为一档，不足一档按一档计</p></div>;
}

function PriceInput({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (value: number) => void }): React.ReactElement {
  return <div className="space-y-1"><Label className="text-xs lg:sr-only">{label}</Label><Input type="number" min={0} max={1_000_000} step={1} value={value} disabled={disabled} onChange={(event) => onChange(numberValue(event.target.value))} aria-label={label} className="h-9 tabular-nums" /></div>;
}
