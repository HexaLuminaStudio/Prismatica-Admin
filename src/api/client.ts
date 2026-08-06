/**
 * fetch wrapper(2026-08-06 重构,适配后端统一 envelope)
 *
 * 后端响应统一为:
 *   成功: { code: "OK", data: <payload>, requestId }
 *   失败: { code: "BAD_REQUEST", message: "...", requestId?, details? }
 *
 * 能力:
 *  - 自动带 cookie(credentials: "include")
 *  - 4xx/5xx → 抛 ApiClientError(code/message/httpStatus)
 *  - 处理 401(cookie 过期) → 清 session + 跳 /login
 *  - 2xx 自动解 envelope,返回 `data` 字段
 *
 * 开发期通过 Vite proxy(/admin 与 /v1 → http://127.0.0.1:8000),
 * 生产同源 Nginx 反代,baseUrl 为 "" 让浏览器走同源。
 */

const envBaseUrl = (import.meta.env.VITE_API_BASE_URL as string) || "";
export const API_BASE_URL = envBaseUrl.replace(/\/$/, "");

export interface ApiErrorBody {
  code: string;
  message: string;
  requestId?: string;
  details?: Record<string, unknown>;
}

export class ApiClientError extends Error {
  code: string;
  httpStatus: number;
  requestId?: string;
  details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    httpStatus: number,
    requestId?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.requestId = requestId;
    this.details = details;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  json?: unknown;
  /**
   * query 参数(value 必须是基本类型之一,且不能是 undefined/null/空串)
   * 用 `Record<string, ...>` 是为了让入参处支持 dict-of-any。
   */
  query?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string>;
  /** 跳过 401 自动跳登录(用于 /admin/login 自己) */
  skipAuthRedirect?: boolean;
}

function buildUrl(path: string, query?: Record<string, unknown>): string {
  const base = API_BASE_URL || "";
  let url = base + path;
  if (query) {
    const entries = Object.entries(query).filter(
      ([, v]) => v !== undefined && v !== null && v !== ""
    );
    if (entries.length > 0) {
      const q = entries
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&");
      url += (url.includes("?") ? "&" : "?") + q;
    }
  }
  return url;
}

/** 401 监听器(由 session store 设置) */
let onAuthFailure: (() => void) | null = null;
export function setAuthFailureHandler(handler: () => void) {
  onAuthFailure = handler;
}

/** 解包 envelope,提取顶层字段。失败返回 null(调用方决定走 fallback) */
function parseEnvelope(body: unknown): {
  ok: boolean;
  code: string;
  data: unknown;
  message?: string;
  requestId?: string;
  details?: Record<string, unknown>;
} | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.code !== "string" || !("data" in b)) {
    // 非 envelope(老接口或健康检查):原样返回
    return null;
  }
  return {
    ok: b.code === "OK",
    code: b.code,
    data: b.data,
    message: typeof b.message === "string" ? b.message : undefined,
    requestId: typeof b.requestId === "string" ? b.requestId : undefined,
    details:
      b.details && typeof b.details === "object"
        ? (b.details as Record<string, unknown>)
        : undefined,
  };
}

export async function apiRequest<T = unknown>(
  path: string,
  opts: RequestOptions = {}
): Promise<T> {
  const { method = "GET", json, query, headers = {}, skipAuthRedirect } = opts;

  const init: RequestInit = {
    method,
    credentials: "include", // 关键:带上 cookie
    headers: {
      Accept: "application/json",
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
  };
  if (json !== undefined) {
    init.body = JSON.stringify(json);
  }

  const url = buildUrl(path, query);
  let resp: Response;
  try {
    resp = await fetch(url, init);
  } catch {
    throw new ApiClientError(
      "NETWORK_ERROR",
      "后端不可达,请检查网络或后端服务",
      0
    );
  }

  // 401 处理(cookie 过期)
  if (resp.status === 401 && !skipAuthRedirect) {
    if (onAuthFailure) onAuthFailure();
    let body: ApiErrorBody | null = null;
    try {
      const raw = (await resp.json()) as Partial<ApiErrorBody> & {
        code?: string;
        message?: string;
      };
      body = {
        code: raw.code ?? "ADMIN_LOGIN_REQUIRED",
        message: raw.message ?? "登录已过期,请重新登录",
      };
    } catch {
      // ignore
    }
    throw new ApiClientError(
      body?.code ?? "ADMIN_LOGIN_REQUIRED",
      body?.message ?? "登录已过期,请重新登录",
      401
    );
  }

  // 解析响应
  if (resp.status === 204) return undefined as unknown as T;
  let data: unknown;
  const text = await resp.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  } else {
    data = null;
  }

  if (!resp.ok) {
    // 错误:优先解 envelope(顶层 code/message),否则兼容旧 error.* 结构
    if (data && typeof data === "object" && "code" in data && "message" in data) {
      const e = data as ApiErrorBody;
      throw new ApiClientError(e.code, e.message, resp.status, e.requestId, e.details);
    }
    const errBody = (data && typeof data === "object" && "error" in data
      ? (data as { error: ApiErrorBody }).error
      : null) as ApiErrorBody | null;
    throw new ApiClientError(
      errBody?.code ?? "INTERNAL_ERROR",
      errBody?.message ?? `HTTP ${resp.status}`,
      resp.status,
      errBody?.requestId,
      errBody?.details
    );
  }

  // 成功:解 envelope,返回 data
  const env = parseEnvelope(data);
  if (env) {
    return env.data as T;
  }
  // 老接口无 envelope → 原样返回
  return data as T;
}