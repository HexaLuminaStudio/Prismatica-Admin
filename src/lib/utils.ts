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

/**
 * 复制文本到剪贴板。
 *
 * 优先用 Clipboard API(仅安全上下文 localhost/HTTPS 可用);
 * 失败时回退到隐藏 textarea + document.execCommand("copy") 方案,
 * 兼容 http://内网 IP 访问后台的场景。
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through 到 execCommand 方案
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * 下载 CSV 文件。
 *
 * 带 cookie 同源请求 → 取 blob → 触发浏览器下载。
 * 后端导出接口返回 text/csv attachment,不走 JSON envelope。
 */
export async function downloadCsv(
  path: string,
  filename: string
): Promise<void> {
  const base = (import.meta.env.VITE_API_BASE_URL as string) || "";
  const resp = await fetch((base || "") + path, { credentials: "include" });
  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try {
      const body = (await resp.json()) as { message?: string };
      msg = body.message ?? msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
