/**
 * Codes store(zustand,2026-08-07 运营管理增强)
 *
 * 职责:
 *  - 列表分页 + 筛选(status)
 *  - 签发向导:仅「礼包码」一种类型(gift)
 *  - 最近一批签发的明文 codes(用于下载 TXT / 复制)
 */

import { create } from "zustand";
import {
  CodeKind,
  CodeListItem,
  IssuedCodeItem,
  IssueCodesParams,
  listCodes,
  issueCodes,
  revokeCode,
  lookupCode,
  CodeLookupResponse,
} from "@/api/codes";

export interface CodesFilters {
  status: "" | "active" | "exhausted" | "revoked" | "expired";
}

export const EMPTY_CODES_FILTERS: CodesFilters = { status: "" };

/** 向导草稿(serialize 友好,便于将来持久化) */
export interface CodesWizardDraft {
  count: number;
  expireDays: number;
  note: string;
  grantedBalance: number;
  grantedDays: number;
  tier: string;
}

export const DEFAULT_CODES_WIZARD: CodesWizardDraft = {
  count: 10,
  expireDays: 30,
  note: "",
  grantedBalance: 100,
  grantedDays: 30,
  tier: "beta",
};

export interface CodesState {
  items: CodeListItem[];
  nextCursor: string | null;
  filters: CodesFilters;
  listLoading: boolean;
  listError: string | null;
  /** 最近签发批次(明文 codes 仅在此处可见,前端用于 TXT 下载 / 单码复制) */
  lastIssuedBatch: IssuedCodeItem[] | null;

  // 写操作
  setFilters: (patch: Partial<CodesFilters>) => void;
  resetFilters: () => void;
  loadList: (opts?: { reset?: boolean; cursor?: string; filters?: CodesFilters }) => Promise<void>;
  loadMore: () => Promise<void>;
  issue: (draft: CodesWizardDraft) => Promise<IssuedCodeItem[]>;
  revoke: (codeHash: string) => Promise<{ status: string }>;
  lookup: (code: string) => Promise<CodeLookupResponse>;
  clearIssuedBatch: () => void;
  reset: () => void;
}

const INITIAL: Pick<
  CodesState,
  "items" | "nextCursor" | "filters" | "listLoading" | "listError" | "lastIssuedBatch"
> = {
  items: [],
  nextCursor: null,
  filters: { ...EMPTY_CODES_FILTERS },
  listLoading: false,
  listError: null,
  lastIssuedBatch: null,
};

const codesListGeneration = { value: 0 };

export const useCodesStore = create<CodesState>((set, get) => ({
  ...INITIAL,

  setFilters(patch) {
    set((s) => ({ filters: { ...s.filters, ...patch } }));
  },
  resetFilters() {
    set({ filters: { ...EMPTY_CODES_FILTERS } });
  },

  async loadList(opts = {}) {
    const reset = opts.reset !== false;
    const requestFilters = opts.filters ? { ...opts.filters } : { ...get().filters };
    const generation = ++codesListGeneration.value;
    set({ listLoading: true, listError: null });
    try {
      const resp = await listCodes({
        limit: 50,
        ...(requestFilters.status ? { status: requestFilters.status } : {}),
        ...(opts.cursor ? { cursor: opts.cursor } : {}),
      });
      if (generation !== codesListGeneration.value) return;
      set((s) => ({
        items: reset ? resp.items : [...s.items, ...resp.items],
        nextCursor: resp.nextCursor,
        listLoading: false,
      }));
    } catch (e) {
      if (generation !== codesListGeneration.value) return;
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

  async issue(draft) {
    const params: IssueCodesParams = {
      kind: "gift",
      count: draft.count,
      expireDays: draft.expireDays,
      grantedBalance: draft.grantedBalance,
      grantedDays: draft.grantedDays,
      tier: draft.tier,
      ...(draft.note ? { note: draft.note } : {}),
    };
    const resp = await issueCodes(params);
    set({ lastIssuedBatch: resp.items });
    try {
      await get().loadList({ reset: true });
    } catch {
      // 列表刷新失败不影响主流程
    }
    return resp.items;
  },

  async revoke(codeHash) {
    const r = await revokeCode(codeHash);
    await get().loadList({ reset: true });
    return r;
  },

  async lookup(code) {
    return lookupCode(code);
  },

  clearIssuedBatch() {
    set({ lastIssuedBatch: null });
  },

  reset() {
    set({ ...INITIAL });
  },
}));