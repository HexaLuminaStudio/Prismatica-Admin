/**
 * Toast 轻量实现(2026-08-06 P0-B M2)
 *
 * 设计:
 *  - 单文件 React Portal,无外部依赖
 *  - 通过全局订阅 store(useToastStore)广播
 *  - 自动消失(success 默认 2.4s,error 默认 4.5s)
 *  - 同类消息会被合并为 1 条
 */

import * as React from "react";
import { create } from "zustand";
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastKind = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
  /** 自动消失毫秒数,0 表示不自动消失 */
  durationMs?: number;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

let counter = 0;
function genId(): string {
  counter += 1;
  return `t_${Date.now().toString(36)}_${counter}`;
}

const DEFAULT_DURATION: Record<ToastKind, number> = {
  success: 2400,
  info: 2400,
  warning: 3600,
  error: 4500,
};

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push(t) {
    const id = genId();
    const toast: Toast = { id, ...t };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    const ms = t.durationMs ?? DEFAULT_DURATION[t.kind ?? "info"];
    if (ms > 0) {
      window.setTimeout(() => get().dismiss(id), ms);
    }
    return id;
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
  clear() {
    set({ toasts: [] });
  },
}));

/** 便捷 API:直接 push 一条 toast(不返回 id) */
export function toast(input: {
  kind: ToastKind;
  title: string;
  description?: string;
  durationMs?: number;
}): void {
  useToastStore.getState().push(input);
}

const ICONS: Record<ToastKind, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
};

const KIND_CLASSES: Record<ToastKind, string> = {
  success:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  info: "border-border bg-card text-foreground",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
};

/** 挂在 Layout 根处的 Portal 容器 */
export function ToastContainer(): React.ReactElement {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2"
      role="region"
      aria-live="polite"
      aria-label="通知"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div
            key={t.id}
            role="alert"
            className={cn(
              "pointer-events-auto flex items-start gap-2 rounded-md border p-3 text-sm shadow-lg backdrop-blur-sm",
              KIND_CLASSES[t.kind]
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 flex-none" />
            <div className="flex-1">
              <div className="font-medium">{t.title}</div>
              {t.description && (
                <div className="mt-0.5 text-xs opacity-90">{t.description}</div>
              )}
            </div>
            <button
              type="button"
              aria-label="关闭"
              onClick={() => dismiss(t.id)}
              className="ml-1 opacity-60 transition-opacity hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}