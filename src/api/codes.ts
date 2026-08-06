import { apiRequest } from "./client";

export type CodeKind = "invite" | "trial" | "recharge";

export interface IssueCodesParams {
  kind: CodeKind;
  count: number;
  grantedBalance?: number;
  grantedDays?: number;
  tier?: string;
  amount?: number;
  expireDays?: number;
}

export interface IssuedCodeItem {
  codeHash: string;
  code: string;
  signedPayload: string;
  codeKind: CodeKind;
  status: string;
  grantedBalance: number | null;
  grantedDays: number | null;
  tier: string | null;
  amount: number | null;
  issuedBy: string;
  issuedAt: string;
  expireAt: string;
}

export interface IssueCodesResponse {
  items: IssuedCodeItem[];
}

export async function issueCodes(
  params: IssueCodesParams
): Promise<IssueCodesResponse> {
  return apiRequest<IssueCodesResponse>("/v1/admin/codes", {
    method: "POST",
    json: {
      kind: params.kind,
      count: params.count,
      grantedBalance: params.grantedBalance ?? 100,
      grantedDays: params.grantedDays ?? 30,
      tier: params.tier ?? "beta",
      amount: params.amount ?? 0,
      expireDays: params.expireDays ?? 14,
    },
  });
}

export interface CodeListItem {
  codeHash: string;
  codeKind: string;
  status: string;
  grantedBalance: number | null;
  grantedDays: number | null;
  tier: string | null;
  amount: number | null;
  issuedBy: string;
  issuedAt: string;
  expireAt: string | null;
  consumedAt: string | null;
  consumedByUserId: string | null;
  consumedIp: string | null;
}

export interface CodeListResponse {
  items: CodeListItem[];
  nextCursor: string | null;
}

export async function listCodes(params: {
  kind?: string;
  status?: string;
  limit?: number;
  cursor?: string;
} = {}): Promise<CodeListResponse> {
  return apiRequest<CodeListResponse>("/v1/admin/codes", { query: params });
}

export async function revokeCode(
  codeHash: string
): Promise<{ codeHash: string; status: string }> {
  return apiRequest(`/v1/admin/codes/${encodeURIComponent(codeHash)}/revoke`, {
    method: "POST",
  });
}

export interface CodeLookupResponse {
  codeKind: string;
  codeHash: string;
  status: string;
  consumedAt: string | null;
  consumedByUserId: string | null;
  rechargeAmount: number | null;
}

export async function lookupCode(code: string): Promise<CodeLookupResponse> {
  return apiRequest<CodeLookupResponse>("/v1/admin/codes/lookup", {
    query: { code },
  });
}