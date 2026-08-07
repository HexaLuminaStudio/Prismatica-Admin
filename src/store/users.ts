/**
 * Users store(zustand,2026-08-06 P0-B M1)
 *
 * 职责:
 *  - 列表分页 + 筛选状态(status / tier / 时间范围 / 关键词)
 *  - 详情缓存(按 userId)
 *  - 写操作:改 tier / 强制下线 / 手动赠送
 *  - 详情子数据:订阅 / 设备 / 账单(独立缓存,按需加载)
 *
 * 所有 HTTP 调用通过 api/users.ts;错误抛出原样由页面层捕获并 toast。
 */

import { create } from "zustand";
import {
  AdminUserItem,
  AdminUserDetail,
  AdminUserSubscription,
  AdminUserDevice,
  AdminUserLedgerItem,
  getUserDetail,
  getUserSubscriptions,
  getUserDevices,
  getUserLedger,
  revokeUserDevice,
  updateUser,
  grantBalance,
  revokeUserSessions,
  type ListUsersParams,
  listUsers,
} from "@/api/users";

export interface UsersFilters {
  status: "" | "active" | "suspended" | "expired";
  tier: "" | "guest" | "trial" | "beta" | "beta_pro" | "paid";
  /** 注册起始日(YYYY-MM-DD),空字符串表示不限 */
  registeredAfter: string;
  /** 注册截止日(YYYY-MM-DD),空字符串表示不限 */
  registeredBefore: string;
  keyword: string;
}

export const EMPTY_FILTERS: UsersFilters = {
  status: "",
  tier: "",
  registeredAfter: "",
  registeredBefore: "",
  keyword: "",
};

export type DetailTab = "info" | "subscription" | "balance" | "devices" | "bills";

export interface UserDetailCache {
  detail: AdminUserDetail;
  subscriptions: AdminUserSubscription[] | null;
  devices: AdminUserDevice[] | null;
  ledger: AdminUserLedgerItem[] | null;
  loadingTabs: Partial<Record<DetailTab, boolean>>;
  tabErrors: Partial<Record<DetailTab, string>>;
}

export interface UsersState {
  // 列表
  items: AdminUserItem[];
  nextCursor: string | null;
  filters: UsersFilters;
  listLoading: boolean;
  listError: string | null;
  /** 已加载到内存中所有 userId 的详情缓存 */
  detailCache: Record<string, UserDetailCache | "loading" | null>;

  // actions
  setFilters: (patch: Partial<UsersFilters>) => void;
  resetFilters: () => void;
  loadList: (opts?: { reset?: boolean; cursor?: string; filters?: UsersFilters }) => Promise<void>;
  loadMore: () => Promise<void>;

  /** 拉详情(命中缓存则跳过) */
  ensureDetail: (userId: string) => Promise<UserDetailCache>;
  /** 重新拉详情(写操作后调用) */
  refreshDetail: (userId: string) => Promise<UserDetailCache>;
  /** 详情抽屉里按 tab 拉子数据(订阅/设备/账单) */
  loadTab: (
    userId: string,
    tab: Exclude<DetailTab, "info">,
    force?: boolean
  ) => Promise<void>;

  // 写操作(成功后自动 refreshDetail)
  changeTier: (userId: string, tier: string, status?: string) => Promise<void>;
  grant: (userId: string, amount: number, note: string) => Promise<{ newBalance: number }>;
  revokeSessions: (userId: string, reason?: string) => Promise<{ revokedCount: number }>;
  revokeDevice: (userId: string, deviceId: string) => Promise<void>;

  // 测试 / 调试
  reset: () => void;
}

const INITIAL: Pick<
  UsersState,
  "items" | "nextCursor" | "filters" | "listLoading" | "listError" | "detailCache"
> = {
  items: [],
  nextCursor: null,
  filters: { ...EMPTY_FILTERS },
  listLoading: false,
  listError: null,
  detailCache: {},
};

export function filtersToParams(filters: UsersFilters, cursor?: string): ListUsersParams {
  const params: ListUsersParams = { limit: 50 };
  if (cursor) params.cursor = cursor;
  if (filters.status) params.status = filters.status;
  if (filters.tier) params.tier = filters.tier;
  if (filters.registeredAfter) params.registeredAfter = filters.registeredAfter;
  if (filters.registeredBefore) params.registeredBefore = filters.registeredBefore;
  if (filters.keyword.trim()) params.q = filters.keyword.trim();
  return params;
}

const usersListGeneration = { value: 0 };
const userDetailGenerations = new Map<string, number>();

export const useUsersStore = create<UsersState>((set, get) => ({
  ...INITIAL,

  setFilters(patch) {
    set((s) => ({ filters: { ...s.filters, ...patch } }));
  },
  resetFilters() {
    set({ filters: { ...EMPTY_FILTERS } });
  },

  async loadList(opts = {}) {
    const reset = opts.reset !== false;
    const requestFilters = opts.filters ? { ...opts.filters } : { ...get().filters };
    const generation = ++usersListGeneration.value;
    set({ listLoading: true, listError: null });
    try {
      const params = filtersToParams(requestFilters, opts.cursor);
      const resp = await listUsers(params);
      if (generation !== usersListGeneration.value) return;
      set((s) => ({
        items: reset ? resp.items : [...s.items, ...resp.items],
        nextCursor: resp.nextCursor,
        listLoading: false,
      }));
    } catch (e) {
      if (generation !== usersListGeneration.value) return;
      const msg = e instanceof Error ? e.message : "加载失败";
      set({ listLoading: false, listError: msg });
      throw e;
    }
  },

  async loadMore() {
    const { nextCursor } = get();
    if (!nextCursor || get().listLoading) return;
    await get().loadList({ reset: false, cursor: nextCursor });
  },

  async ensureDetail(userId) {
    const cached = get().detailCache[userId];
    if (cached && cached !== "loading") return cached;
    return get().refreshDetail(userId);
  },

  async refreshDetail(userId) {
    const generation = (userDetailGenerations.get(userId) ?? 0) + 1;
    userDetailGenerations.set(userId, generation);
    set((s) => ({ detailCache: { ...s.detailCache, [userId]: "loading" } }));
    try {
      const detail = await getUserDetail(userId);
      const cache: UserDetailCache = {
        detail,
        subscriptions: null,
        devices: null,
        ledger: null,
        loadingTabs: {},
        tabErrors: {},
      };
      if (generation !== userDetailGenerations.get(userId)) return cache;
      set((s) => ({ detailCache: { ...s.detailCache, [userId]: cache } }));
      // 列表里的 summary 数据用最新覆盖
      set((s) => ({
        items: s.items.map((it) =>
          it.userId === userId
            ? {
                ...it,
                tier: detail.tier,
                status: detail.status,
                balance: detail.balance,
              }
            : it
        ),
      }));
      return cache;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载详情失败";
      if (generation === userDetailGenerations.get(userId)) {
        set((s) => ({ detailCache: { ...s.detailCache, [userId]: null } }));
      }
      throw new Error(msg);
    }
  },

  async loadTab(userId, tab, force = false) {
    const cache = get().detailCache[userId];
    if (!cache || cache === "loading") return;
    if (!force) {
      if (tab === "subscription" && cache.subscriptions) return;
      if (tab === "devices" && cache.devices) return;
      if (tab === "bills" && cache.ledger) return;
    }

    const patch = {
      loadingTabs: { ...cache.loadingTabs, [tab]: true },
      tabErrors: { ...cache.tabErrors, [tab]: undefined },
    };
    set((s) => ({
      detailCache: { ...s.detailCache, [userId]: { ...cache, ...patch } },
    }));
    try {
      let payload: unknown = null;
      if (tab === "subscription") payload = await getUserSubscriptions(userId);
      else if (tab === "devices") payload = await getUserDevices(userId);
      else if (tab === "bills") payload = await getUserLedger(userId);

      const after = get().detailCache[userId];
      if (!after || after === "loading") return;
      const next: UserDetailCache = {
        ...after,
        loadingTabs: { ...after.loadingTabs, [tab]: false },
        tabErrors: { ...after.tabErrors, [tab]: undefined },
      };
      if (tab === "subscription") next.subscriptions = payload as AdminUserSubscription[];
      else if (tab === "devices") next.devices = payload as AdminUserDevice[];
      else if (tab === "bills") next.ledger = payload as AdminUserLedgerItem[];
      set((s) => ({ detailCache: { ...s.detailCache, [userId]: next } }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载失败";
      const after = get().detailCache[userId];
      if (!after || after === "loading") return;
      set((s) => ({
        detailCache: {
          ...s.detailCache,
          [userId]: {
            ...after,
            loadingTabs: { ...after.loadingTabs, [tab]: false },
            tabErrors: { ...after.tabErrors, [tab]: msg },
          },
        },
      }));
    }
  },

  async changeTier(userId, tier, status) {
    await updateUser(userId, tier, status);
    await get().refreshDetail(userId);
  },

  async grant(userId, amount, note) {
    const r = await grantBalance(userId, amount, note);
    await get().refreshDetail(userId);
    // grant 后余额/账本变化,重新拉账本
    const cache = get().detailCache[userId];
    if (cache && cache !== "loading") {
      cache.ledger = null;
      set((s) => ({ detailCache: { ...s.detailCache, [userId]: { ...cache } } }));
    }
    return { newBalance: r.newBalance };
  },

  async revokeSessions(userId, reason) {
    const r = await revokeUserSessions(userId, reason);
    await get().refreshDetail(userId);
    return r;
  },

  async revokeDevice(userId, deviceId) {
    await revokeUserDevice(userId, deviceId);
    // 设备列表缓存失效,下次切到 devices tab 时重拉
    const cache = get().detailCache[userId];
    if (cache && cache !== "loading") {
      cache.devices = null;
      set((s) => ({ detailCache: { ...s.detailCache, [userId]: { ...cache } } }));
    }
  },

  reset() {
    set({ ...INITIAL });
  },
}));