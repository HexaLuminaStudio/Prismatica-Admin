/**
 * session store(zustand,2026-08-05 M2)
 *
 * 职责:
 *  - 持有当前登录管理员
 *  - 提供 bootstrap / login / logout
 *  - 把 401 处理给 apiClient.client.ts(自动跳登录)
 */

import { create } from "zustand";
import * as authApi from "@/api/auth";
import { setAuthFailureHandler } from "@/api/client";
import type { AdminMe } from "@/api/auth";

interface SessionState {
  me: AdminMe | null;
  loading: boolean;
  error: string | null;
  /** 路由用:未鉴权应跳 /login */
  authorized: boolean;

  bootstrap: () => Promise<void>;
  login: (username: string, password: string) => Promise<AdminMe>;
  logout: () => Promise<void>;
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  me: null,
  loading: false,
  error: null,
  authorized: false,

  async bootstrap() {
    set({ loading: true, error: null });
    const me = await authApi.fetchMe();
    set({
      me,
      authorized: Boolean(me),
      loading: false,
    });
  },

  async login(username, password) {
    set({ loading: true, error: null });
    try {
      const me = await authApi.login(username, password);
      set({ me, authorized: true, loading: false, error: null });
      return me;
    } catch (e: unknown) {
      const msg =
        (e as { message?: string })?.message ?? "登录失败,请稍后再试";
      set({ loading: false, error: msg, authorized: false, me: null });
      throw e;
    }
  },

  async logout() {
    try {
      await authApi.logout();
    } catch {
      // best-effort
    }
    set({ me: null, authorized: false, error: null });
  },

  clear() {
    set({ me: null, authorized: false, error: null });
  },
}));

/** 安装 401 fallback:任何 401 触发后都清本地 session 状态(由 Router 守卫统一跳 /login)。 */
setAuthFailureHandler(() => {
  useSessionStore.getState().clear();
});
