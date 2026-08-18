/**
 * UI 中文化字典(2026-08-06)
 *
 * 集中所有"英文技术词 → 中文业务术语"的映射。
 * TypeScript 类型仍使用英文原值,仅在 UI 层翻译。
 *
 * 使用方式:
 *   <Badge title={u.tier}>{userTierLabel(u.tier)}</Badge>
 *
 * 未匹配的值走 fallback(原样返回),不抛错。
 */

/* ---------------- 凭证类型(kind) ---------------- */

export const KIND_LABEL: Record<string, string> = {
  gift: "礼包码",
  pkg: "礼包码",
  PKG: "礼包码",
  invite: "邀请码",
  trial: "体验码",
  recharge: "充值码",
};

export const KIND_DESC: Record<string, string> = {
  gift: "用户登录后通过礼包码兑换,即可充值余额 + 开通会员",
  pkg: "用户登录后通过礼包码兑换,即可充值余额 + 开通会员",
  PKG: "用户登录后通过礼包码兑换,即可充值余额 + 开通会员",
};

export function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? "礼包码";
}

export function kindDesc(kind: string): string {
  return KIND_DESC[kind] ?? KIND_DESC.gift;
}

/* ---------------- 凭证状态 ---------------- */

export const CODE_STATUS_LABEL: Record<string, string> = {
  active: "有效",
  consumed: "已使用",
  exhausted: "已使用",
  revoked: "已撤销",
  expired: "已过期",
};

export function codeStatusLabel(status: string): string {
  return CODE_STATUS_LABEL[status] ?? status;
}

/* ---------------- 用户会员等级 ---------------- */

export const USER_TIER_LABEL: Record<string, string> = {
  free: "免费",
  pro: "高级会员",
  team: "团队会员",
  guest: "游客",
  trial: "体验用户",
  beta: "内测用户",
  beta_pro: "内测专业版",
  paid: "付费用户",
};

export function userTierLabel(tier: string): string {
  return USER_TIER_LABEL[tier] ?? tier;
}

/* ---------------- 用户状态 ---------------- */

export const USER_STATUS_LABEL: Record<string, string> = {
  active: "正常",
  paused: "已停用",
  banned: "已封禁",
  deleted: "已删除",
  suspended: "已停用",
  expired: "已过期",
};

export function userStatusLabel(status: string): string {
  return USER_STATUS_LABEL[status] ?? status;
}

/* ---------------- 账单状态 ---------------- */

export const BILL_STATUS_LABEL: Record<string, string> = {
  pending: "待结算",
  settled: "已结算",
  refunded: "已退款",
};

export function billStatusLabel(status: string): string {
  return BILL_STATUS_LABEL[status] ?? status;
}

/* ---------------- 管理员角色 ---------------- */

export const ADMIN_ROLE_LABEL: Record<string, string> = {
  owner: "超级管理员",
  admin: "管理员",
};

export function roleLabel(role: string): string {
  return ADMIN_ROLE_LABEL[role] ?? role;
}

/* ---------------- 审计行为类型(action) ---------------- */

/**
 * 已知 action 的中文映射。未识别者原样返回(保留技术值,便于排查)。
 * 前缀规范:admin.<资源>.<动作>
 */
export const ACTION_LABEL: Record<string, string> = {
  "admin.login": "管理员登录",
  "admin.login_failed": "登录失败",
  "admin.logout": "管理员登出",
  "admin.grant_balance": "为用户充值",
  "admin.revoke_sessions": "强制用户下线",
  "admin.update_user": "更新用户信息",
  "admin.issue_code": "签发凭证",
  "admin.revoke_code": "撤销凭证",
  "admin.create_admin": "新建管理员",
  "admin.update_admin": "更新管理员",
  "admin.change_password": "修改密码",
};

export function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action;
}
