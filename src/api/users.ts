import { apiRequest } from "./client";

/* -------------------- list / detail -------------------- */

export interface AdminUserItem {
  userId: string;
  displayName: string;
  tier: string;
  status: string;
  balance: number;
  totalSpent: number;
  totalRecharged: number;
  activatedAt: string;
}

export interface AdminUserListResponse {
  items: AdminUserItem[];
  nextCursor: string | null;
}

export interface AdminUserDetail extends AdminUserItem {
  email: string | null;
  frozenBalance: number;
  expireAt: string | null;
  lastSeenAt: string | null;
  deviceCount: number;
  /** 累计 lifetime_grant(为前端展示赠送/消费比) */
  lifetimeGrant: number;
  lifetimeConsumed: number;
  /** 注册时间 */
  registeredAt: string | null;
}

export interface ListUsersParams {
  limit?: number;
  cursor?: string;
  q?: string;
  status?: string;
  tier?: string;
  /** 注册起始日 YYYY-MM-DD */
  registeredAfter?: string;
  /** 注册截止日 YYYY-MM-DD */
  registeredBefore?: string;
  [key: string]: string | number | boolean | undefined;
}

export async function listUsers(
  params: ListUsersParams = {}
): Promise<AdminUserListResponse> {
  return apiRequest<AdminUserListResponse>("/v1/admin/users", { query: params });
}

export async function getUserDetail(userId: string): Promise<AdminUserDetail> {
  return apiRequest<AdminUserDetail>(
    `/v1/admin/users/${encodeURIComponent(userId)}`
  );
}

/* -------------------- subscription / devices / ledger -------------------- */

export interface AdminUserSubscription {
  subscriptionId: string;
  planCode: string;
  status: string;
  startedAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  monthlyQuota: number;
  autoRenew: boolean;
}

export interface AdminUserSubscriptionsResponse {
  items: AdminUserSubscription[];
}

export async function getUserSubscriptions(
  userId: string
): Promise<AdminUserSubscription[]> {
  const resp = await apiRequest<AdminUserSubscriptionsResponse>(
    `/v1/admin/users/${encodeURIComponent(userId)}/subscriptions`
  );
  return resp.items ?? [];
}

export interface AdminUserDevice {
  deviceId: string;
  deviceName: string;
  platform: string;
  status: "active" | "revoked";
  lastSeenAt: string;
  createdAt: string;
}

export interface AdminUserDevicesResponse {
  items: AdminUserDevice[];
}

export async function getUserDevices(
  userId: string
): Promise<AdminUserDevice[]> {
  const resp = await apiRequest<AdminUserDevicesResponse>(
    `/v1/admin/users/${encodeURIComponent(userId)}/devices`
  );
  return resp.items ?? [];
}

export async function revokeUserDevice(
  userId: string,
  deviceId: string
): Promise<{ deviceId: string; status: string }> {
  return apiRequest(
    `/v1/admin/users/${encodeURIComponent(userId)}/devices/${encodeURIComponent(deviceId)}/revoke`,
    { method: "POST" }
  );
}

export interface AdminUserLedgerItem {
  ledgerId: string;
  type: "grant" | "consume" | "refund" | "reserve" | "unreserve" | "adjust";
  amount: number;
  source: string;
  refId: string | null;
  note: string;
  createdAt: string;
}

export interface AdminUserLedgerResponse {
  items: AdminUserLedgerItem[];
}

export async function getUserLedger(
  userId: string,
  limit = 20
): Promise<AdminUserLedgerItem[]> {
  const resp = await apiRequest<AdminUserLedgerResponse>(
    `/v1/admin/users/${encodeURIComponent(userId)}/ledger`,
    { query: { limit } }
  );
  return resp.items ?? [];
}

/* -------------------- write ops -------------------- */

export async function updateUser(
  userId: string,
  tier: string,
  status?: string
): Promise<{ userId: string; tier: string; status: string }> {
  return apiRequest(`/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    json: { tier, ...(status ? { status } : {}) },
  });
}

export async function grantBalance(
  userId: string,
  amount: number,
  note = ""
): Promise<{ userId: string; newBalance: number }> {
  return apiRequest(`/v1/admin/users/${encodeURIComponent(userId)}/grant`, {
    method: "POST",
    json: { amount, note },
  });
}

export async function revokeUserSessions(
  userId: string,
  reason = ""
): Promise<{ userId: string; revokedCount: number }> {
  return apiRequest(
    `/v1/admin/users/${encodeURIComponent(userId)}/revoke-sessions`,
    {
      method: "POST",
      json: { reason },
    }
  );
}