import { apiRequest } from "./client";

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
  frozenBalance: number;
  expireAt: string | null;
  lastSeenAt: string | null;
  deviceCount: number;
}

export interface ListUsersParams {
  limit?: number;
  cursor?: string;
  q?: string;
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