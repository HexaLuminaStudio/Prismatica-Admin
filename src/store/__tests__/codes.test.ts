/**
 * codes store 单测(2026-08-06 P0-B M7)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as codesApi from "@/api/codes";
import type { CodeListItem } from "@/api/codes";

vi.mock("@/api/codes", () => ({
  listCodes: vi.fn(),
  issueCodes: vi.fn(),
  revokeCode: vi.fn(),
  lookupCode: vi.fn(),
}));

const mockedListCodes = vi.mocked(codesApi.listCodes);
const mockedIssueCodes = vi.mocked(codesApi.issueCodes);
const mockedRevokeCode = vi.mocked(codesApi.revokeCode);
const mockedLookupCode = vi.mocked(codesApi.lookupCode);

import { useCodesStore, DEFAULT_CODES_WIZARD } from "../codes";

const SAMPLE_CODE = {
  codeHash: "h_1",
  code: "INV-AAAA-BBBB-CCCC-DDDD",
  signedPayload: "sig",
  codeKind: "invite" as const,
  status: "active",
  grantedBalance: 100,
  grantedDays: 30,
  tier: "beta",
  amount: 0,
  issuedBy: "root",
  issuedAt: "2026-08-01T00:00:00Z",
  expireAt: "2027-08-01T00:00:00Z",
};

describe("useCodesStore", () => {
  beforeEach(() => {
    useCodesStore.getState().reset();
    vi.clearAllMocks();
  });
  afterEach(() => {
    useCodesStore.getState().reset();
  });

  it("旧响应不会覆盖新筛选结果", async () => {
    let resolveFirst: ((value: { items: CodeListItem[]; nextCursor: string | null }) => void) | undefined;
    const first = new Promise<{ items: CodeListItem[]; nextCursor: string | null }>((resolve) => {
      resolveFirst = resolve;
    });
    mockedListCodes.mockReturnValueOnce(first).mockResolvedValueOnce({
      items: [{
        codeHash: "h_new",
        codeKind: "invite",
        status: "active",
        grantedBalance: 100,
        grantedDays: 30,
        tier: "beta",
        amount: 0,
        issuedBy: "root",
        issuedAt: "2026-08-01T00:00:00Z",
        expireAt: "2027-08-01T00:00:00Z",
        consumedAt: null,
        consumedByUserId: null,
        consumedIp: null,
      }],
      nextCursor: null,
    });
    useCodesStore.getState().setFilters({ kind: "invite" });
    const firstRequest = useCodesStore.getState().loadList();
    useCodesStore.getState().setFilters({ status: "revoked" });
    const secondRequest = useCodesStore.getState().loadList();
    await secondRequest;
    resolveFirst?.({ items: [{
      codeHash: "h_old",
      codeKind: "invite",
      status: "active",
      grantedBalance: 100,
      grantedDays: 30,
      tier: "beta",
      amount: 0,
      issuedBy: "root",
      issuedAt: "2026-08-01T00:00:00Z",
      expireAt: "2027-08-01T00:00:00Z",
      consumedAt: null,
      consumedByUserId: null,
      consumedIp: null,
    }], nextCursor: "old" });
    await firstRequest;
    expect(useCodesStore.getState().items[0].codeHash).toBe("h_new");
    expect(mockedListCodes).toHaveBeenNthCalledWith(2, expect.objectContaining({ status: "revoked" }));
  });

  it("显式筛选快照用于列表请求", async () => {
    mockedListCodes.mockResolvedValueOnce({ items: [], nextCursor: null });
    useCodesStore.getState().setFilters({ kind: "invite", status: "active" });
    await useCodesStore.getState().loadList({ filters: { kind: "", status: "" } });
    expect(mockedListCodes).toHaveBeenCalledWith({ limit: 50 });
  });

  it("issue 保存明文批次 + 自动 reload 列表", async () => {
    mockedIssueCodes.mockResolvedValueOnce({ items: [SAMPLE_CODE] });
    mockedListCodes.mockResolvedValueOnce({
      items: [
        {
          codeHash: "h_1",
          codeKind: "invite",
          status: "active",
          grantedBalance: 100,
          grantedDays: 30,
          tier: "beta",
          amount: 0,
          issuedBy: "root",
          issuedAt: "2026-08-01T00:00:00Z",
          expireAt: "2027-08-01T00:00:00Z",
          consumedAt: null,
          consumedByUserId: null,
          consumedIp: null,
        },
      ],
      nextCursor: null,
    });

    const items = await useCodesStore.getState().issue({
      ...DEFAULT_CODES_WIZARD,
      kind: "invite",
      count: 1,
    });

    expect(items).toHaveLength(1);
    expect(useCodesStore.getState().lastIssuedBatch).toEqual([SAMPLE_CODE]);
    expect(useCodesStore.getState().items).toHaveLength(1);
    expect(mockedIssueCodes).toHaveBeenCalledTimes(1);
  });

  it("revoke 重新加载列表", async () => {
    mockedRevokeCode.mockResolvedValueOnce({
      codeHash: "h_1",
      status: "revoked",
    });
    mockedListCodes.mockResolvedValueOnce({ items: [], nextCursor: null });

    const r = await useCodesStore.getState().revoke("h_1");
    expect(r.status).toBe("revoked");
    expect(mockedListCodes).toHaveBeenCalled();
  });

  it("lookup 透传结果", async () => {
    mockedLookupCode.mockResolvedValueOnce({
      codeKind: "invite",
      codeHash: "h_1",
      status: "active",
      consumedAt: null,
      consumedByUserId: null,
      rechargeAmount: null,
    });
    const r = await useCodesStore.getState().lookup("INV-XXXX");
    expect(r.codeHash).toBe("h_1");
  });

  it("loadList(reset=true) 替换;setFilters 合并", async () => {
    useCodesStore.getState().setFilters({ kind: "invite" });
    expect(useCodesStore.getState().filters.kind).toBe("invite");
    mockedListCodes.mockResolvedValueOnce({ items: [], nextCursor: null });
    await useCodesStore.getState().loadList();
    expect(mockedListCodes).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "invite", limit: 50 })
    );
  });

  it("loadList 失败时记录 listError", async () => {
    mockedListCodes.mockRejectedValueOnce(new Error("network down"));
    await expect(useCodesStore.getState().loadList()).rejects.toThrow();
    expect(useCodesStore.getState().listError).toBe("network down");
  });

  it("clearIssuedBatch 清空批次缓存", () => {
    useCodesStore.setState({ lastIssuedBatch: [SAMPLE_CODE] });
    useCodesStore.getState().clearIssuedBatch();
    expect(useCodesStore.getState().lastIssuedBatch).toBeNull();
  });
});