/**
 * bills store 单测(2026-08-06 P0-B M7)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as billsApi from "@/api/bills";

vi.mock("@/api/bills", () => ({
  listBills: vi.fn(),
  getBillDetail: vi.fn(),
}));

const mockedListBills = vi.mocked(billsApi.listBills);
const mockedGetBillDetail = vi.mocked(billsApi.getBillDetail);

import { useBillsStore } from "../bills";

const SAMPLE = {
  billId: "b_1",
  userId: "u_001",
  displayName: "alice",
  actionType: "ai_insight",
  actionDisplayName: "AI 洞察",
  estimatedCost: 5,
  realCost: 5,
  resourceUsed: 200,
  balanceBefore: 95,
  balanceAfter: 90,
  status: "settled",
  taskId: "t_1",
  description: "AI 洞察",
  idempotencyKey: "k_1",
  createdAt: "2026-08-01T00:00:00Z",
  settledAt: "2026-08-01T00:01:00Z",
};

describe("useBillsStore", () => {
  beforeEach(() => {
    useBillsStore.getState().reset();
    vi.clearAllMocks();
  });
  afterEach(() => {
    useBillsStore.getState().reset();
  });

  it("旧响应不会覆盖新筛选结果", async () => {
    let resolveFirst: ((value: { items: typeof SAMPLE[]; nextCursor: string | null }) => void) | undefined;
    const first = new Promise<{ items: typeof SAMPLE[]; nextCursor: string | null }>((resolve) => {
      resolveFirst = resolve;
    });
    mockedListBills.mockReturnValueOnce(first).mockResolvedValueOnce({
      items: [{ ...SAMPLE, billId: "b_new" }],
      nextCursor: null,
    });
    useBillsStore.getState().setFilters({ status: "pending" });
    const firstRequest = useBillsStore.getState().loadList();
    useBillsStore.getState().setFilters({ status: "settled" });
    const secondRequest = useBillsStore.getState().loadList();
    await secondRequest;
    resolveFirst?.({ items: [SAMPLE], nextCursor: "old" });
    await firstRequest;
    expect(useBillsStore.getState().items[0].billId).toBe("b_new");
    expect(mockedListBills).toHaveBeenNthCalledWith(2, expect.objectContaining({ status: "settled" }));
  });

  it("显式筛选快照用于列表请求", async () => {
    mockedListBills.mockResolvedValueOnce({ items: [], nextCursor: null });
    useBillsStore.getState().setFilters({ status: "pending", days: "30", userId: "u_old" });
    await useBillsStore.getState().loadList({ filters: { status: "", days: "", userId: "" } });
    expect(mockedListBills).toHaveBeenCalledWith({ limit: 50 });
  });

  it("setFilters 合并;resetFilters 还原", async () => {
    useBillsStore.getState().setFilters({ status: "settled", userId: "u_1" });
    expect(useBillsStore.getState().filters).toEqual({
      status: "settled",
      days: "",
      userId: "u_1",
    });
    useBillsStore.getState().resetFilters();
    expect(useBillsStore.getState().filters).toEqual({
      status: "",
      days: "",
      userId: "",
    });
  });

  it("loadList(reset=true) 替换 items", async () => {
    mockedListBills.mockResolvedValueOnce({ items: [SAMPLE], nextCursor: null });
    await useBillsStore.getState().loadList();
    expect(useBillsStore.getState().items).toEqual([SAMPLE]);
  });

  it("loadList(reset=false, cursor) 追加", async () => {
    mockedListBills.mockResolvedValueOnce({
      items: [SAMPLE],
      nextCursor: "c1",
    });
    mockedListBills.mockResolvedValueOnce({
      items: [{ ...SAMPLE, billId: "b_2" }],
      nextCursor: null,
    });
    await useBillsStore.getState().loadList();
    await useBillsStore.getState().loadList({ reset: false, cursor: "c1" });
    expect(useBillsStore.getState().items).toHaveLength(2);
  });

  it("filters → query 映射:days 转 number,空字符串不入参", async () => {
    mockedListBills.mockResolvedValueOnce({ items: [], nextCursor: null });
    useBillsStore.setState({
      filters: { status: "pending", days: "30", userId: "u_1" },
    });
    await useBillsStore.getState().loadList();
    expect(mockedListBills).toHaveBeenCalledWith({
      limit: 50,
      status: "pending",
      days: 30,
      userId: "u_1",
    });
  });

  it("ensureDetail 缓存命中", async () => {
    mockedGetBillDetail.mockResolvedValueOnce(SAMPLE);
    const r1 = await useBillsStore.getState().ensureDetail("b_1");
    expect(r1.billId).toBe("b_1");
    const r2 = await useBillsStore.getState().ensureDetail("b_1");
    expect(r2).toBe(r1);
    expect(mockedGetBillDetail).toHaveBeenCalledTimes(1);
  });

  it("ensureDetail 失败时缓存 null 并抛错", async () => {
    mockedGetBillDetail.mockRejectedValueOnce(new Error("nope"));
    await expect(
      useBillsStore.getState().ensureDetail("b_x")
    ).rejects.toThrow();
    expect(useBillsStore.getState().detailCache["b_x"]).toBeNull();
  });

  it("loadList 失败时 listError 被记录", async () => {
    mockedListBills.mockRejectedValueOnce(new Error("down"));
    await expect(useBillsStore.getState().loadList()).rejects.toThrow();
    expect(useBillsStore.getState().listError).toBe("down");
  });
});