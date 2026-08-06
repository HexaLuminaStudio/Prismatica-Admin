import { apiRequest } from "./client";

export interface AdminAuditItem {
  auditId: number;
  actor: string;
  action: string;
  targetUser: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

export interface AdminAuditResponse {
  items: AdminAuditItem[];
  nextCursor: string | null;
}

export interface AdminAuditSummaryItem {
  action: string;
  count: number;
}

export interface AdminAuditSummaryResponse {
  items: AdminAuditSummaryItem[];
  days: number;
  total: number;
}

export interface ListAuditParams {
  limit?: number;
  cursor?: string;
  action?: string;
  actor?: string;
  targetUser?: string;
  days?: number;
  [key: string]: string | number | boolean | undefined;
}

export async function listAudit(
  params: ListAuditParams = {}
): Promise<AdminAuditResponse> {
  return apiRequest<AdminAuditResponse>("/v1/admin/audit", { query: params });
}

export async function auditSummary(
  days = 7
): Promise<AdminAuditSummaryResponse> {
  return apiRequest<AdminAuditSummaryResponse>("/v1/admin/audit/summary", {
    query: { days },
  });
}