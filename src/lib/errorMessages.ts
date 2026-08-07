/**
 * 错误码 → 用户文案映射(2026-08-06 P0-B M1)
 *
 * 来源:设计文档 §6.1。
 * 原则:
 *  - 已知 code → 返回「title + description」分类文案
 *  - 未知 code → 返回 fallback(使用 ApiClientError.message)
 *  - HTTP 状态优先(code 缺省时按状态机推断)
 */

export interface ErrorMessage {
  title: string;
  description: string;
}

const MESSAGE_MAP: Record<string, ErrorMessage> = {
  // --- 鉴权 ---
  ADMIN_LOGIN_REQUIRED: {
    title: "请先登录",
    description: "登录状态已失效,请重新登录管理后台。",
  },
  ADMIN_INVALID_CREDENTIALS: {
    title: "凭据无效",
    description: "用户名或密码错误,请检查后重试。",
  },
  ADMIN_ACCOUNT_LOCKED: {
    title: "账号已锁定",
    description: "连续登录失败次数过多,账号已被临时锁定。请联系超级管理员。",
  },
  TOKEN_REVOKED: {
    title: "令牌已失效",
    description: "你的登录令牌已被吊销(可能是改密或强制下线)。请重新登录。",
  },

  // --- 资源/状态 ---
  NOT_FOUND: {
    title: "资源不存在",
    description: "请求的资源不存在或已被删除。",
  },
  BAD_REQUEST: {
    title: "请求参数错误",
    description: "提交的数据格式不正确,请检查后重试。",
  },
  FORBIDDEN: {
    title: "没有权限",
    description: "当前账号没有执行该操作的权限。",
  },
  CONFLICT: {
    title: "操作冲突",
    description: "该资源已存在或状态冲突,请刷新后重试。",
  },

  // --- 用户管理 ---
  EMAIL_ALREADY_USED: {
    title: "邮箱已被占用",
    description: "该邮箱已注册,不能重复创建。",
  },
  USER_NOT_FOUND: {
    title: "用户不存在",
    description: "找不到目标用户,可能已被删除。",
  },
  INVALID_TIER: {
    title: "会员等级无效",
    description: "所选等级不被系统支持,请选择正确的等级。",
  },

  // --- 计费 ---
  INSUFFICIENT_BALANCE: {
    title: "余额不足",
    description: "用户余额不足以执行该操作,请充值或赠送后再试。",
  },
  SUBSCRIPTION_EXPIRED: {
    title: "订阅已过期",
    description: "当前订阅已过期,请续订或手动开通。",
  },
  BILL_ALREADY_SETTLED: {
    title: "账单已结算",
    description: "该账单已经结算,不能重复提交。",
  },
  BILL_NOT_PENDING: {
    title: "账单已不可操作",
    description: "该账单不在待结算状态,操作失败。",
  },
  IDEMPOTENCY_CONFLICT: {
    title: "幂等键冲突",
    description: "同样的 Idempotency-Key 但参数不一致,请重试或更换 key。",
  },

  // --- 设备 ---
  MAX_DEVICES_REACHED: {
    title: "已达设备上限",
    description: "用户绑定的设备数已达上限,请先撤销其他设备。",
  },

  // --- 凭证 ---
  CODE_NOT_FOUND: {
    title: "凭证不存在",
    description: "找不到对应凭证,可能已被撤销或过期。",
  },
  CODE_ALREADY_CONSUMED: {
    title: "凭证已使用",
    description: "该凭证已被兑换,无法重复使用。",
  },
  CODE_EXPIRED: {
    title: "凭证已过期",
    description: "该凭证已超过有效期,无法再兑换。",
  },

  // --- 限速 ---
  RATE_LIMITED: {
    title: "请求过于频繁",
    description: "触发限速保护,请稍后再试。",
  },

  // --- 服务端 ---
  INTERNAL_ERROR: {
    title: "服务异常",
    description: "后端服务出现异常,请稍后再试或联系运维。",
  },
  NETWORK_ERROR: {
    title: "网络不可达",
    description: "无法连接到 PrismaticaAPI,请检查网络或后端服务。",
  },
};

const HTTP_FALLBACK: Record<number, ErrorMessage> = {
  0: { title: "网络不可达", description: "无法连接到后端服务,请稍后重试。" },
  400: { title: "请求参数错误", description: "提交的数据格式不正确,请检查后重试。" },
  401: { title: "请先登录", description: "登录状态已失效,请重新登录管理后台。" },
  402: { title: "需要付费", description: "余额不足或订阅已过期。" },
  403: { title: "没有权限", description: "当前账号没有执行该操作的权限。" },
  404: { title: "资源不存在", description: "请求的资源不存在或已被删除。" },
  409: { title: "操作冲突", description: "资源已存在或状态冲突,请刷新后重试。" },
  422: { title: "数据校验失败", description: "提交的数据未通过校验,请检查后重试。" },
  423: { title: "账号已锁定", description: "账号被临时锁定,请稍后再试。" },
  429: { title: "请求过于频繁", description: "触发限速保护,请稍后再试。" },
  500: { title: "服务异常", description: "后端服务出现异常,请稍后再试或联系运维。" },
  502: { title: "网关异常", description: "网关层返回错误,请检查 Nginx/反代配置。" },
  503: { title: "服务暂不可用", description: "后端服务正在维护或重启,请稍后重试。" },
};

/**
 * 把任意错误归一化成 { title, description }。
 *
 * @param err 原始错误
 * @returns 永远返回 ErrorMessage(永不抛)
 */
export function classifyError(err: unknown): ErrorMessage {
  // ApiClientError 优先匹配 code;code 缺省或不识别时按 httpStatus 推断
  if (err && typeof err === "object" && "code" in err && "httpStatus" in err) {
    const e = err as { code?: string; httpStatus?: number; message?: string };
    const code = e.code;
    if (code && MESSAGE_MAP[code]) return MESSAGE_MAP[code];
    if (code && code !== "INTERNAL_ERROR") {
      // 未识别的业务 code:优先用后端 message
      if (e.message) {
        return { title: `错误(${code})`, description: e.message };
      }
      return {
        title: "操作失败",
        description: `后端返回了未识别的错误码(${code})`,
      };
    }
    // code 缺省或为通用 INTERNAL_ERROR:走 HTTP fallback
    if (typeof e.httpStatus === "number" && HTTP_FALLBACK[e.httpStatus]) {
      return HTTP_FALLBACK[e.httpStatus];
    }
    if (e.message) {
      return { title: "操作失败", description: e.message };
    }
    return {
      title: "操作失败",
      description: "后端返回了未知错误",
    };
  }

  // 普通 Error
  if (err instanceof Error) {
    return { title: "操作失败", description: err.message };
  }

  return { title: "操作失败", description: "未知错误,请稍后再试。" };
}