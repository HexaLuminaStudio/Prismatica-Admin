import { apiRequest } from "./client";

export interface AdminMetricsSummary {
  userCount: number;
  sevenDayActive: number;
  sevenDayGrantTotal: number;
  billsPending: number;
  billsSettledLast7Days: number;
  billsRefundedLast7Days: number;
}

export async function fetchMetricsSummary(): Promise<AdminMetricsSummary> {
  return apiRequest<AdminMetricsSummary>("/v1/admin/metrics/summary");
}