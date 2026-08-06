import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** 标准 shadcn 风格 cn:clsx + tailwind-merge */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 格式化日期(默认 ISO) */
export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

/** 仅日期 */
export function formatDateOnly(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 截断长字符串(保留末尾 4 位) */
export function maskCodeTail(code: string, head = 4, tail = 4): string {
  if (!code) return "—";
  if (code.length <= head + tail + 2) return code;
  return `${code.slice(0, head)}…${code.slice(-tail)}`;
}
