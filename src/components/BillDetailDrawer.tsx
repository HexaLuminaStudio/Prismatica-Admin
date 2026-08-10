/**
 * BillDetailDrawer(2026-08-06 P0-B M5)
 *
 * 抽屉式账单详情:展示账单全字段 + 余额变动 + 资源用量 + 关联 source 链接(可选)。
 * 数据由 useBillsStore 提供。
 */

import * as React from "react";
import { X, Loader2, AlertTriangle, Receipt } from "lucide-react";
import { AdminBillItem } from "@/api/bills";
import { useBillsStore } from "@/store/bills";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, cn } from "@/lib/utils";
import { billStatusLabel } from "@/lib/labels";

interface Props {
  billId: string | null;
  onClose: () => void;
}

export function BillDetailDrawer({ billId, onClose }: Props): React.ReactElement | null {
  const ensureDetail = useBillsStore((s) => s.ensureDetail);
  const cache = useBillsStore((s) =>
    billId ? s.detailCache[billId] : null
  );

  React.useEffect(() => {
    if (!billId) return;
    let cancelled = false;
    void (async () => {
      try {
        await ensureDetail(billId);
      } catch (e) {
        if (!cancelled) {
          // store 已经记下 null,这里不再 toast
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [billId, ensureDetail]);

  if (!billId) return null;
  const isLoading = !cache || cache === "loading";
  const detail: AdminBillItem | null =
    cache && cache !== "loading" ? cache : null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-[560px] flex-col border-l bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div>
            <div className="text-sm font-semibold">账单详情</div>
            <div className="font-mono text-xs text-muted-foreground">
              {billId}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {isLoading && (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载账单…
            </div>
          )}
          {!isLoading && !detail && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              账单加载失败,请关闭后重试。
            </div>
          )}
          {detail && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Receipt className="h-4 w-4" />
                基本信息
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-md border bg-muted/20 p-3 text-xs md:grid-cols-3">
                <Item label="billId" value={detail.billId} mono />
                <Item label="userId" value={detail.userId} mono />
                <Item
                  label="用户"
                  value={detail.displayName ?? "—"}
                />
                <Item
                  label="状态"
                  value={
                    <Badge
                      variant={
                        detail.status === "pending"
                          ? "default"
                          : detail.status === "settled"
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {billStatusLabel(detail.status)}
                    </Badge>
                  }
                />
                <Item label="actionType" value={detail.actionType} mono />
                <Item
                  label="动作"
                  value={detail.actionDisplayName || detail.actionType}
                />
                <Item label="taskId" value={detail.taskId || "—"} mono />
                <Item
                  label="幂等键"
                  value={detail.idempotencyKey || "—"}
                  mono
                />
                <Item
                  label="价格版本"
                  value={detail.pricingVersion || "—"}
                  mono
                />
                <Item
                  label="创建时间"
                  value={formatDate(detail.createdAt)}
                />
                <Item
                  label="结算时间"
                  value={formatDate(detail.settledAt)}
                />
              </div>

              <div className="text-sm font-medium">金额与资源</div>
              <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/20 p-3 text-xs md:grid-cols-4">
                <Item
                  label="预估扣费"
                  value={detail.estimatedCost.toLocaleString()}
                  mono
                />
                <Item
                  label="实际扣费"
                  value={detail.realCost.toLocaleString()}
                  mono
                  valueClass={
                    detail.realCost > detail.estimatedCost
                      ? "text-destructive"
                      : ""
                  }
                />
                <Item
                  label="资源用量"
                  value={detail.resourceUsed.toLocaleString()}
                  mono
                />
                <Item
                  label="输入 Token"
                  value={detail.inputTokens?.toLocaleString() ?? "—"}
                  mono
                />
                <Item
                  label="输出 Token"
                  value={detail.outputTokens?.toLocaleString() ?? "—"}
                  mono
                />
                <Item
                  label="余额变动"
                  value={`${detail.balanceBefore.toLocaleString()} → ${detail.balanceAfter.toLocaleString()}`}
                  mono
                />
              </div>

              <div className="text-sm font-medium">锁定价格快照</div>
              <pre className="max-h-56 overflow-auto rounded-md border bg-muted/20 p-3 text-xs">
                {JSON.stringify(detail.pricingSnapshot ?? {}, null, 2)}
              </pre>

              <div className="text-sm font-medium">描述</div>
              <div className="rounded-md border bg-muted/20 p-3 text-xs">
                {detail.description || (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Item({
  label,
  value,
  mono = false,
  valueClass,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  valueClass?: string;
}): React.ReactElement {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className={cn("font-medium", mono && "font-mono", valueClass)}>
        {value}
      </div>
    </div>
  );
}
