import { apiRequest } from "./client";

export interface AdminMetricsSummary {
  userCount: number;
  sevenDayActive: number;
  sevenDayGrantTotal: number;
  billsPending: number;
  billsSettledLast7Days: number;
  billsRefundedLast7Days: number;
}

export interface SubscriptionDistributionItem {
  tier: string;
  count: number;
}

export interface SubscriptionDistributionResponse {
  items: SubscriptionDistributionItem[];
  total: number;
}

export interface CodesKpi {
  activeCount: number;
  consumedLast7Days: number;
  issuedLast7Days: number;
  revokedLast7Days: number;
}

export async function fetchMetricsSummary(): Promise<AdminMetricsSummary> {
  return apiRequest<AdminMetricsSummary>("/v1/admin/metrics/summary");
}

export async function fetchSubscriptionDistribution(): Promise<SubscriptionDistributionResponse> {
  return apiRequest<SubscriptionDistributionResponse>(
    "/v1/admin/metrics/subscription-distribution"
  );
}

export async function fetchCodesKpi(): Promise<CodesKpi> {
  return apiRequest<CodesKpi>("/v1/admin/metrics/codes-kpi");
}