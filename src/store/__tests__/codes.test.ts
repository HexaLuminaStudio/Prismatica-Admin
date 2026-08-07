/**
 * codes store 单测(2026-08-07 运营管理增强)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as codesApi from "@/api/codes";
import type { CodeListItem, IssuedCodeItem } from "@/api/codes";

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

const SAMPLE_CODE: IssuedCodeItem = {
  codeHash: "h_1",
  code: "PKG-AAAA-BBBB-CCCC-DDDD",
  signedPayload: "sig",
  codeKind: "gift",
  status: "active",
  grantedBalance: 100,
  grantedDays: 30,
  tier: "beta",
  amount: 0,
  issuedBy: "root",
  issuedAt: "2026-08-01T00:00:00Z",
  expireAt: "2027-08-01T00:00:00Z",
};

function makeItem(overrides: Partial<CodeListItem> = {}): CodeListItem {
  return {
    codeHash: "h_1",
    codeKind: "gift",
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
    ...overrides,
  };
}

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
      items: [makeItem({ codeHash: "h_new" })],
      nextCursor: null,
    });
    useCodesStore.getState().setFilters({ status: "active" });
    const firstRequest = useCodesStore.getState().loadList();
    useCodesStore.getState().setFilters({ status: "revoked" });
    const secondRequest = useCodesStore.getState().loadList();
    await secondRequest;
    resolveFirst?.({ items: [makeItem({ codeHash: "h_old" })], nextCursor: "old" });
    await firstRequest;
    expect(useCodesStore.getState().items[0].codeHash).toBe("h_new");
    expect(mockedListCodes).toHaveBeenNthCalledWith(2, expect.objectContaining({ status: "revoked" }));
  });

  it("显式筛选快照用于列表请求", async () => {
    mockedListCodes.mockResolvedValueOnce({ items: [], nextCursor: null });
    useCodesStore.getState().setFilters({ status: "active" });
    await useCodesStore.getState().loadList({ filters: { status: "" } });
    expect(mockedListCodes).toHaveBeenCalledWith({ limit: 50 });
  });

  it("issue 保存明文批次 + 自动 reload 列表", async () => {
    mockedIssueCodes.mockResolvedValueOnce({ items: [SAMPLE_CODE] });
    mockedListCodes.mockResolvedValueOnce({
      items: [makeItem({ codeHash: "h_1" })],
      nextCursor: null,
    });

    const items = await useCodesStore.getState().issue({
      ...DEFAULT_CODES_WIZARD,
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
      codeKind: "gift",
      codeHash: "h_1",
      status: "active",
      consumedAt: null,
      consumedByUserId: null,
      rechargeAmount: null,
    });
    const r = await useCodesStore.getState().lookup("PKG-XXXX");
    expect(r.codeHash).toBe("h_1");
  });

  it("setFilters 合并;loadList 携带 status", async () => {
    useCodesStore.getState().setFilters({ status: "active" });
    expect(useCodesStore.getState().filters.status).toBe("active");
    mockedListCodes.mockResolvedValueOnce({ items: [], nextCursor: null });
    await useCodesStore.getState().loadList();
    expect(mockedListCodes).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active", limit: 50 })
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