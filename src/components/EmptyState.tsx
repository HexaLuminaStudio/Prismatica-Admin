import * as React from "react";
import { Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * EmptyState(2026-08-18 新增)
 *
 * 统一空状态视觉:
 *  - 居中 icon + 文案
 *  - 可选操作按钮(刷新 / 新建 等)
 */
interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps): React.ReactElement {
  return (
    <div
      className={cn(
        "flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted/20 px-6 py-10 text-center",
        className
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <div className="text-sm font-medium text-foreground">{title}</div>
      {description && (
        <div className="max-w-md text-xs leading-relaxed text-muted-foreground">
          {description}
        </div>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/**
 * 加载占位骨架(卡片内统一尺寸)
 */
export function LoadingHint({
  text = "加载中…",
  className,
}: {
  text?: string;
  className?: string;
}): React.ReactElement {
  return (
    <div
      className={cn(
        "flex min-h-[200px] items-center justify-center gap-2 text-sm text-muted-foreground",
        className
      )}
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      {text}
    </div>
  );
}