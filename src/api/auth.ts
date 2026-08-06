import { apiRequest } from "./client";

export interface AdminMe {
  userId: string;
  username: string;
  role: string;
  status: string;
  lastLoginAt?: string | null;
}

export async function login(
  username: string,
  password: string
): Promise<AdminMe> {
  return apiRequest<AdminMe>("/v1/admin/auth/login", {
    method: "POST",
    json: { username, password },
    skipAuthRedirect: true,
  });
}

export async function logout(): Promise<void> {
  await apiRequest<void>("/v1/admin/auth/logout", { method: "POST" });
}

export async function fetchMe(): Promise<AdminMe | null> {
  try {
    return await apiRequest<AdminMe>("/v1/admin/auth/me");
  } catch {
    return null;
  }
}

export async function changePassword(
  oldPassword: string,
  newPassword: string
): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>("/v1/admin/auth/change-password", {
    method: "POST",
    json: { oldPassword, newPassword },
  });
}