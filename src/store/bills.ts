/**
 * Bills store(zustand,2026-08-06 P0-B M1)
 *
 * 职责:
 *  - 全局账单列表分页 + 筛选(status / userId / days)
 *  - 单条账单详情(轻量,只缓存当前打开的)
 */

import { create } from "zustand";
import { AdminBillItem, listBills, getBillDetail, type ListBillsParams } from "@/api/bills";

export interface BillsFilters {
  status: "" | "pending" | "settled" | "refunded";
  days: "" | "7" | "30" | "90";
  userId: string;
}

export const EMPTY_BILLS_FILTERS: BillsFilters = {
  status: "",
  days: "",
  userId: "",
};

export interface BillsState {
  items: AdminBillItem[];
  nextCursor: string | null;
  filters: BillsFilters;
  listLoading: boolean;
  listError: string | null;
  /** 当前打开详情的账单缓存 */
  detailCache: Record<string, AdminBillItem | "loading" | null>;

  // actions
  setFilters: (patch: Partial<BillsFilters>) => void;
  resetFilters: () => void;
  loadList: (opts?: { reset?: boolean; cursor?: string; filters?: BillsFilters }) => Promise<void>;
  loadMore: () => Promise<void>;
  ensureDetail: (billId: string) => Promise<AdminBillItem>;
  reset: () => void;
}

const INITIAL: Pick<
  BillsState,
  "items" | "nextCursor" | "filters" | "listLoading" | "listError" | "detailCache"
> = {
  items: [],
  nextCursor: null,
  filters: { ...EMPTY_BILLS_FILTERS },
  listLoading: false,
  listError: null,
  detailCache: {},
};

export function filtersToParams(filters: BillsFilters, cursor?: string): ListBillsParams {
  const params: ListBillsParams = { limit: 50 };
  if (cursor) params.cursor = cursor;
  if (filters.status) params.status = filters.status;
  if (filters.days) params.days = Number(filters.days);
  if (filters.userId.trim()) params.userId = filters.userId.trim();
  return params;
}

const billsListGeneration = { value: 0 };

export const useBillsStore = create<BillsState>((set, get) => ({
  ...INITIAL,

  setFilters(patch) {
    set((s) => ({ filters: { ...s.filters, ...patch } }));
  },
  resetFilters() {
    set({ filters: { ...EMPTY_BILLS_FILTERS } });
  },

  async loadList(opts = {}) {
    const reset = opts.reset !== false;
    const requestFilters = opts.filters ? { ...opts.filters } : { ...get().filters };
    const generation = ++billsListGeneration.value;
    set({ listLoading: true, listError: null });
    try {
      const resp = await listBills(filtersToParams(requestFilters, opts.cursor));
      if (generation !== billsListGeneration.value) return;
      set((s) => ({
        items: reset ? resp.items : [...s.items, ...resp.items],
        nextCursor: resp.nextCursor,
        listLoading: false,
      }));
    } catch (e) {
      if (generation !== billsListGeneration.value) return;
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

  async ensureDetail(billId) {
    const cached = get().detailCache[billId];
    if (cached && cached !== "loading") return cached;
    set((s) => ({ detailCache: { ...s.detailCache, [billId]: "loading" } }));
    try {
      const detail = await getBillDetail(billId);
      set((s) => ({ detailCache: { ...s.detailCache, [billId]: detail } }));
      return detail;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载账单详情失败";
      set((s) => ({ detailCache: { ...s.detailCache, [billId]: null } }));
      throw new Error(msg);
    }
  },

  reset() {
    set({ ...INITIAL });
  },
}));