/**
 * users store 单测(2026-08-06 P0-B M7)
 *
 * 用 vi.mock 替换 @/api/users;验证:
 *  - setFilters 合并 patch
 *  - resetFilters 还原
 *  - loadList(reset=true) 替换 items;loadList(reset=false, cursor) 追加
 *  - 错误时 listError 被记录
 *  - ensureDetail 命中缓存跳过,缓存命中 null 仍重拉
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as usersApi from "@/api/users";

vi.mock("@/api/users", () => ({
  listUsers: vi.fn(),
  getUserDetail: vi.fn(),
  getUserSubscriptions: vi.fn(),
  getUserDevices: vi.fn(),
  getUserLedger: vi.fn(),
  revokeUserDevice: vi.fn(),
  updateUser: vi.fn(),
  grantBalance: vi.fn(),
  revokeUserSessions: vi.fn(),
}));

const mockedListUsers = vi.mocked(usersApi.listUsers);
const mockedGetUserDetail = vi.mocked(usersApi.getUserDetail);
const mockedUpdateUser = vi.mocked(usersApi.updateUser);
const mockedGrantBalance = vi.mocked(usersApi.grantBalance);
const mockedRevokeUserSessions = vi.mocked(usersApi.revokeUserSessions);
const mockedGetUserSubscriptions = vi.mocked(usersApi.getUserSubscriptions);
const mockedGetUserLedger = vi.mocked(usersApi.getUserLedger);

import { useUsersStore } from "../users";

const FIXED_USER = {
  userId: "u_001",
  displayName: "alice",
  tier: "beta",
  status: "active",
  balance: 100,
  totalSpent: 0,
  totalRecharged: 0,
  activatedAt: "2026-08-01T00:00:00Z",
};

const FIXED_DETAIL = {
  ...FIXED_USER,
  email: "alice@example.com",
  frozenBalance: 0,
  expireAt: null,
  lastSeenAt: "2026-08-05T00:00:00Z",
  deviceCount: 1,
  lifetimeGrant: 100,
  lifetimeConsumed: 0,
  registeredAt: "2026-07-01T00:00:00Z",
};

describe("useUsersStore", () => {
  beforeEach(() => {
    useUsersStore.getState().reset();
    vi.clearAllMocks();
  });
  afterEach(() => {
    useUsersStore.getState().reset();
  });

  it("setFilters 合并;resetFilters 还原", () => {
    const { setFilters, resetFilters } = useUsersStore.getState();
    setFilters({ status: "active", tier: "paid" });
    setFilters({ keyword: "alice" });
    expect(useUsersStore.getState().filters).toEqual({
      status: "active",
      tier: "paid",
      registeredAfter: "",
      registeredBefore: "",
      keyword: "alice",
    });
    resetFilters();
    expect(useUsersStore.getState().filters).toEqual({
      status: "",
      tier: "",
      registeredAfter: "",
      registeredBefore: "",
      keyword: "",
    });
  });

  it("旧响应不会覆盖新筛选结果", async () => {
    let resolveFirst: ((value: { items: typeof FIXED_USER[]; nextCursor: string | null }) => void) | undefined;
    const first = new Promise<{ items: typeof FIXED_USER[]; nextCursor: string | null }>((resolve) => {
      resolveFirst = resolve;
    });
    mockedListUsers.mockReturnValueOnce(first).mockResolvedValueOnce({
      items: [{ ...FIXED_USER, userId: "u_new" }],
      nextCursor: null,
    });

    useUsersStore.getState().setFilters({ status: "active" });
    const firstRequest = useUsersStore.getState().loadList({ reset: true });
    useUsersStore.getState().setFilters({ status: "suspended" });
    const secondRequest = useUsersStore.getState().loadList({ reset: true });
    await secondRequest;
    resolveFirst?.({ items: [FIXED_USER], nextCursor: "old" });
    await firstRequest;

    expect(useUsersStore.getState().items[0].userId).toBe("u_new");
    expect(mockedListUsers).toHaveBeenNthCalledWith(1, expect.objectContaining({ status: "active" }));
    expect(mockedListUsers).toHaveBeenNthCalledWith(2, expect.objectContaining({ status: "suspended" }));
  });

  it("loadMore 在请求进行中不会重复分页请求", async () => {
    mockedListUsers.mockResolvedValueOnce({ items: [FIXED_USER], nextCursor: "cur_1" });
    await useUsersStore.getState().loadList();
    const pending = new Promise<{ items: typeof FIXED_USER[]; nextCursor: string | null }>(() => {});
    mockedListUsers.mockReturnValueOnce(pending);
    const firstMore = useUsersStore.getState().loadMore();
    await useUsersStore.getState().loadMore();
    expect(mockedListUsers).toHaveBeenCalledTimes(2);
    void firstMore;
  });

  it("显式筛选快照优先于 store 当前筛选", async () => {
    mockedListUsers.mockResolvedValueOnce({ items: [], nextCursor: null });
    useUsersStore.getState().setFilters({ status: "active" });
    await useUsersStore.getState().loadList({ reset: true, filters: { ...useUsersStore.getState().filters, status: "" } });
    expect(mockedListUsers).toHaveBeenCalledWith({ limit: 50 });
  });

  it("loadList(reset=true) 替换 items", async () => {
    mockedListUsers.mockResolvedValueOnce({
      items: [FIXED_USER],
      nextCursor: null,
    });
    await useUsersStore.getState().loadList();
    expect(useUsersStore.getState().items).toEqual([FIXED_USER]);
    expect(useUsersStore.getState().listLoading).toBe(false);
  });

  it("loadList(reset=false, cursor) 追加 items", async () => {
    mockedListUsers.mockResolvedValueOnce({
      items: [FIXED_USER],
      nextCursor: "cur_1",
    });
    mockedListUsers.mockResolvedValueOnce({
      items: [{ ...FIXED_USER, userId: "u_002" }],
      nextCursor: null,
    });
    await useUsersStore.getState().loadList();
    await useUsersStore.getState().loadList({ reset: false, cursor: "cur_1" });
    expect(useUsersStore.getState().items).toHaveLength(2);
  });

  it("loadList 失败时记录 listError", async () => {
    mockedListUsers.mockRejectedValueOnce(new Error("boom"));
    await expect(useUsersStore.getState().loadList()).rejects.toThrow();
    expect(useUsersStore.getState().listError).toBe("boom");
  });

  it("ensureDetail 命中缓存直接返回;不命中时拉取", async () => {
    mockedGetUserDetail.mockResolvedValueOnce(FIXED_DETAIL);
    const cache = await useUsersStore.getState().ensureDetail("u_001");
    expect(cache.detail).toEqual(FIXED_DETAIL);
    expect(mockedGetUserDetail).toHaveBeenCalledTimes(1);

    // 二次调用应直接命中,不再请求
    const cache2 = await useUsersStore.getState().ensureDetail("u_001");
    expect(cache2).toBe(cache);
    expect(mockedGetUserDetail).toHaveBeenCalledTimes(1);
  });

  it("较早详情请求后返回时不会覆盖较新详情", async () => {
    let resolveFirst!: (value: typeof FIXED_DETAIL) => void;
    const firstRequest = new Promise<typeof FIXED_DETAIL>((resolve) => {
      resolveFirst = resolve;
    });
    mockedGetUserDetail
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce({ ...FIXED_DETAIL, balance: 300 });

    const earlier = useUsersStore.getState().refreshDetail("u_001");
    const later = useUsersStore.getState().refreshDetail("u_001");
    await later;
    resolveFirst({ ...FIXED_DETAIL, balance: 100 });
    await earlier;

    const cache = useUsersStore.getState().detailCache["u_001"];
    expect(cache && cache !== "loading" && cache.detail.balance).toBe(300);
  });

  it("changeTier 成功后 refresh detail", async () => {
    mockedGetUserDetail.mockResolvedValue(FIXED_DETAIL);
    mockedUpdateUser.mockResolvedValueOnce({
      userId: "u_001",
      tier: "paid",
      status: "active",
    });
    await useUsersStore.getState().ensureDetail("u_001");
    await useUsersStore.getState().changeTier("u_001", "paid");
    expect(mockedUpdateUser).toHaveBeenCalledWith("u_001", "paid", undefined);
    // 至少调用过 2 次(ensureDetail 1 次 + changeTier 后 refresh 1 次)
    expect(mockedGetUserDetail.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("grant 成功后刷新详情 + 返回 newBalance", async () => {
    mockedGetUserDetail.mockResolvedValue({
      ...FIXED_DETAIL,
      balance: 250,
    });
    mockedGrantBalance.mockResolvedValueOnce({
      userId: "u_001",
      newBalance: 250,
    });
    await useUsersStore.getState().ensureDetail("u_001");
    const r = await useUsersStore.getState().grant("u_001", 150, "test");
    expect(r.newBalance).toBe(250);
    const cache = useUsersStore.getState().detailCache["u_001"];
    expect(cache).not.toBeNull();
    expect(cache !== null && cache !== "loading" && cache.detail.balance).toBe(
      250
    );
  });

  it("revokeSessions 返回 revokedCount", async () => {
    mockedGetUserDetail.mockResolvedValue(FIXED_DETAIL);
    mockedRevokeUserSessions.mockResolvedValueOnce({
      userId: "u_001",
      revokedCount: 3,
    });
    await useUsersStore.getState().ensureDetail("u_001");
    const r = await useUsersStore
      .getState()
      .revokeSessions("u_001", "manual");
    expect(r.revokedCount).toBe(3);
  });

  it("loadTab 拉取并缓存 subscriptions", async () => {
    mockedGetUserDetail.mockResolvedValue(FIXED_DETAIL);
    mockedGetUserSubscriptions.mockResolvedValueOnce([
      {
        subscriptionId: "s_1",
        planCode: "pro_monthly",
        status: "active",
        startedAt: "2026-07-01T00:00:00Z",
        currentPeriodStart: "2026-08-01T00:00:00Z",
        currentPeriodEnd: "2026-09-01T00:00:00Z",
        monthlyQuota: 100,
        autoRenew: false,
      },
    ]);
    await useUsersStore.getState().ensureDetail("u_001");
    await useUsersStore.getState().loadTab("u_001", "subscription");
    const cache = useUsersStore.getState().detailCache["u_001"];
    expect(cache && cache !== "loading" && cache.subscriptions).toEqual([
      expect.objectContaining({ subscriptionId: "s_1" }),
    ]);
  });

  it("loadTab force=true 时绕过账本缓存", async () => {
    mockedGetUserDetail.mockResolvedValue(FIXED_DETAIL);
    mockedGetUserLedger
      .mockResolvedValueOnce([
        {
          ledgerId: "l_1",
          type: "grant",
          amount: 100,
          source: "manual",
          refId: null,
          note: "first",
          createdAt: "2026-08-01T00:00:00Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          ledgerId: "l_2",
          type: "consume",
          amount: -10,
          source: "task",
          refId: null,
          note: "second",
          createdAt: "2026-08-02T00:00:00Z",
        },
      ]);
    await useUsersStore.getState().ensureDetail("u_001");
    await useUsersStore.getState().loadTab("u_001", "bills");
    await useUsersStore.getState().loadTab("u_001", "bills", true);
    expect(mockedGetUserLedger).toHaveBeenCalledTimes(2);
    const cache = useUsersStore.getState().detailCache["u_001"];
    expect(cache && cache !== "loading" && cache.ledger).toEqual([
      expect.objectContaining({ ledgerId: "l_2" }),
    ]);
  });

  it("loadTab 失败时记录 tabErrors（不抛错）", async () => {
    mockedGetUserDetail.mockResolvedValue(FIXED_DETAIL);
    mockedGetUserSubscriptions.mockRejectedValueOnce(new Error("load fail"));
    await useUsersStore.getState().ensureDetail("u_001");
    await useUsersStore.getState().loadTab("u_001", "subscription");
    const cache = useUsersStore.getState().detailCache["u_001"];
    expect(cache && cache !== "loading" && cache.tabErrors.subscription).toBe(
      "load fail"
    );
  });
});