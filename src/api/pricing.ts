import { apiRequest } from "./client";

export type BillingMode = "fixed" | "token" | "metered";

export interface PricingRule {
  featureCode: string;
  displayName: string;
  billingMode: BillingMode;
  unitName: string;
  unitSize: number;
  fixedCost: number;
  baseCost: number;
  perUnitCost: number;
  inputTokenCostPer1K: number;
  outputTokenCostPer1K: number;
  minCost: number;
  maxCost: number;
  enabled: boolean;
}

export interface PricingVersion {
  versionCode: string;
  status: "draft" | "published" | "retired";
  note: string;
  createdBy: string;
  publishedBy: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export interface PricingOverview {
  activeVersion: string;
  rules: PricingRule[];
  versions: PricingVersion[];
}

export async function getPricingOverview(): Promise<PricingOverview> {
  return apiRequest<PricingOverview>("/v1/admin/pricing");
}

export async function createPricingDraft(
  rules: PricingRule[],
  note: string
): Promise<{ versionCode: string; status: "draft"; rules: PricingRule[] }> {
  return apiRequest("/v1/admin/pricing/drafts", {
    method: "POST",
    json: { rules, note },
  });
}

export async function publishPricingVersion(
  versionCode: string
): Promise<{ versionCode: string; status: "published"; publishedAt: string }> {
  return apiRequest(
    `/v1/admin/pricing/${encodeURIComponent(versionCode)}/publish`,
    { method: "POST" }
  );
}
