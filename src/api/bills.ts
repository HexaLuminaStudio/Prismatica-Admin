import { apiRequest } from "./client";

export interface AdminBillItem {
  billId: string;
  userId: string;
  displayName: string | null;
  actionType: string;
  actionDisplayName: string;
  estimatedCost: number;
  realCost: number;
  resourceUsed: number;
  balanceBefore: number;
  balanceAfter: number;
  status: string;
  taskId: string;
  description: string;
  idempotencyKey: string | null;
  pricingVersion?: string | null;
  pricingSnapshot?: Record<string, unknown>;
  inputTokens?: number | null;
  outputTokens?: number | null;
  createdAt: string;
  settledAt: string | null;
}

export interface AdminBillListResponse {
  items: AdminBillItem[];
  nextCursor: string | null;
}

export interface ListBillsParams {
  limit?: number;
  cursor?: string;
  status?: string;
  userId?: string;
  days?: number;
  [key: string]: string | number | boolean | undefined;
}

export async function listBills(
  params: ListBillsParams = {}
): Promise<AdminBillListResponse> {
  return apiRequest<AdminBillListResponse>("/v1/admin/bills", { query: params });
}

export async function getBillDetail(billId: string): Promise<AdminBillItem> {
  return apiRequest<AdminBillItem>(
    `/v1/admin/bills/${encodeURIComponent(billId)}`
  );
}
