/**
 * Admin 账号管理 API(2026-08-06 M3 新增)
 *
 * 端点(/v1/admin/admins/*):
 *   GET    /v1/admin/admins                       列表
 *   POST   /v1/admin/admins                       创建
 *   PATCH  /v1/admin/admins/{userId}              改 status / role
 *   DELETE /v1/admin/admins/{userId}?confirm=...  软删除(二次确认)
 *   POST   /v1/admin/admins/{userId}/reset-password 重置密码
 *
 * 仅 owner 可访问(后端 requireOwner 装饰器,前端二次防御)。
 */

import { apiRequest } from "./client";

export type AdminRole = "owner" | "admin";
export type AdminStatus = "active" | "locked";

export interface AdminAccountItem {
  userId: string;
  username: string;
  role: AdminRole;
  status: AdminStatus;
  lastLoginAt: string | null;
  failedAttempts: number;
  createdAt: string;
}

export interface AdminAccountListResponse {
  items: AdminAccountItem[];
  nextCursor: string | null;
}

export interface AdminCreateAdminRequest {
  username: string;
  password: string;
  role?: AdminRole;
}

export interface AdminCreateAdminResponse {
  userId: string;
  username: string;
  role: AdminRole;
  status: AdminStatus;
  createdAt: string;
}

export interface AdminUpdateAdminRequest {
  status?: AdminStatus;
  role?: AdminRole;
}

export interface AdminUpdateAdminResponse {
  userId: string;
  role: AdminRole | null;
  status: AdminStatus | null;
}

export interface AdminResetPasswordResponse {
  userId: string;
  newPassword: string;
}

export interface AdminDeleteAdminResponse {
  userId: string;
  deletedAt: string;
}

export interface ListAdminsParams {
  limit?: number;
  cursor?: string;
  q?: string;
  status?: AdminStatus;
  role?: AdminRole;
  [key: string]: string | number | boolean | undefined;
}

export async function listAdmins(
  params: ListAdminsParams = {}
): Promise<AdminAccountListResponse> {
  return apiRequest<AdminAccountListResponse>("/v1/admin/admins", { query: params });
}

export async function createAdmin(
  req: AdminCreateAdminRequest
): Promise<AdminCreateAdminResponse> {
  return apiRequest<AdminCreateAdminResponse>("/v1/admin/admins", {
    method: "POST",
    json: {
      username: req.username,
      password: req.password,
      role: req.role ?? "admin",
    },
  });
}

export async function updateAdmin(
  userId: string,
  req: AdminUpdateAdminRequest
): Promise<AdminUpdateAdminResponse> {
  return apiRequest<AdminUpdateAdminResponse>(
    `/v1/admin/admins/${encodeURIComponent(userId)}`,
    { method: "PATCH", json: req }
  );
}

export async function deleteAdmin(
  userId: string,
  usernameConfirm: string
): Promise<AdminDeleteAdminResponse> {
  return apiRequest<AdminDeleteAdminResponse>(
    `/v1/admin/admins/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      query: { confirm: usernameConfirm },
    }
  );
}

export async function resetAdminPassword(
  userId: string
): Promise<AdminResetPasswordResponse> {
  return apiRequest<AdminResetPasswordResponse>(
    `/v1/admin/admins/${encodeURIComponent(userId)}/reset-password`,
    { method: "POST" }
  );
}