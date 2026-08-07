import { apiRequest } from "./client";

/** 礼包码:统一业务身份 = gift(历史 invite/trial/recharge 兼容) */
export type CodeKind = "gift";

export interface IssueCodesParams {
  kind?: CodeKind;
  count: number;
  grantedBalance?: number;
  grantedDays?: number;
  tier?: string;
  expireDays?: number;
  /** 备注(可选) */
  note?: string;
}

export interface IssuedCodeItem {
  codeHash: string;
  code: string;
  signedPayload: string;
  codeKind: CodeKind | string;
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
  const json: Record<string, unknown> = {
    kind: "gift",
    count: params.count,
    grantedBalance: params.grantedBalance ?? 100,
    grantedDays: params.grantedDays ?? 30,
    tier: params.tier ?? "beta",
    expireDays: params.expireDays ?? 30,
  };
  if (params.note) json.note = params.note;
  return apiRequest<IssueCodesResponse>("/v1/admin/codes", {
    method: "POST",
    json,
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