/**
 * UserDetailDrawer 组件回归测试(2026-08-06 P0-B M3)
 *
 * 覆盖:
 *  - 5 个 tab 全部可切换且不抛异常(账本 tab 曾因 null as never 崩溃)
 *  - 余额/账本 tab 会触发 ledger 加载
 *  - 刷新按钮强制绕过缓存重新请求
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as usersApi from "@/api/users";
import { useUsersStore } from "@/store/users";
import { UserDetailDrawer } from "../UserDetailDrawer";

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

const mockedGetUserDetail = vi.mocked(usersApi.getUserDetail);
const mockedGetUserSubscriptions = vi.mocked(usersApi.getUserSubscriptions);
const mockedGetUserDevices = vi.mocked(usersApi.getUserDevices);
const mockedGetUserLedger = vi.mocked(usersApi.getUserLedger);

const FIXED_DETAIL = {
  userId: "u_001",
  displayName: "alice",
  email: "alice@example.com",
  tier: "beta",
  status: "active",
  balance: 120,
  frozenBalance: 5,
  totalSpent: 30,
  totalRecharged: 150,
  lifetimeGrant: 150,
  lifetimeConsumed: 30,
  activatedAt: "2026-08-01T00:00:00Z",
  registeredAt: "2026-07-01T00:00:00Z",
  expireAt: null,
  lastSeenAt: "2026-08-05T00:00:00Z",
  deviceCount: 1,
  deletedAt: null,
};

const SUBSCRIPTIONS = [
  {
    subscriptionId: "s_1",
    planCode: "pro_monthly",
    status: "active",
    startedAt: "2026-07-01T00:00:00Z",
    currentPeriodStart: "2026-08-01T00:00:00Z",
    currentPeriodEnd: "2026-09-01T00:00:00Z",
    monthlyQuota: 100,
    autoRenew: true,
  },
];

const DEVICES = [
  {
    deviceId: "dev_abc",
    deviceName: "desktop-01",
    platform: "windows",
    status: "active" as const,
    lastSeenAt: "2026-08-05T00:00:00Z",
    createdAt: "2026-07-01T00:00:00Z",
  },
];

const LEDGER = [
  {
    ledgerId: "l_1",
    type: "grant" as const,
    amount: 150,
    source: "manual",
    refId: null,
    note: "客服补偿",
    createdAt: "2026-08-01T00:00:00Z",
  },
  {
    ledgerId: "l_2",
    type: "consume" as const,
    amount: -30,
    source: "task",
    refId: "bill_1",
    note: "",
    createdAt: "2026-08-03T00:00:00Z",
  },
];

describe("UserDetailDrawer", () => {
  beforeEach(() => {
    useUsersStore.getState().reset();
    vi.clearAllMocks();
    mockedGetUserDetail.mockResolvedValue({ ...FIXED_DETAIL });
    mockedGetUserSubscriptions.mockResolvedValue([...SUBSCRIPTIONS]);
    mockedGetUserDevices.mockResolvedValue([...DEVICES]);
    mockedGetUserLedger.mockResolvedValue([...LEDGER]);
  });
  afterEach(() => {
    useUsersStore.getState().reset();
  });

  const clickTab = (name: string) => {
    fireEvent.click(screen.getByRole("button", { name }));
  };

  it("基本信息 tab 渲染详情字段", async () => {
    render(<UserDetailDrawer userId="u_001" onClose={() => {}} />);
    await screen.findByText("会员等级");
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
  });

  it("5 个 tab 均可切换且不抛异常", async () => {
    render(<UserDetailDrawer userId="u_001" onClose={() => {}} />);
    await screen.findByText("会员等级");

    clickTab("订阅");
    await waitFor(() => {
      expect(screen.getByText("pro_monthly")).toBeInTheDocument();
    });

    clickTab("余额");
    await waitFor(() => {
      expect(screen.getByText("客服补偿")).toBeInTheDocument();
    });

    clickTab("设备");
    await waitFor(() => {
      expect(screen.getByText("desktop-01")).toBeInTheDocument();
    });

    clickTab("账本");
    await waitFor(() => {
      expect(screen.getByText("客服补偿")).toBeInTheDocument();
    });

    clickTab("基本信息");
    expect(screen.getByText("会员等级")).toBeInTheDocument();
  });

  it("余额 tab 首次进入会触发 ledger 加载", async () => {
    render(<UserDetailDrawer userId="u_001" onClose={() => {}} />);
    await screen.findByText("会员等级");
    clickTab("余额");
    await waitFor(() => {
      expect(mockedGetUserLedger).toHaveBeenCalledWith("u_001");
    });
    await waitFor(() => {
      expect(screen.getByText("客服补偿")).toBeInTheDocument();
    });
  });

  it("账本 tab 刷新按钮会强制重新请求 ledger", async () => {
    render(<UserDetailDrawer userId="u_001" onClose={() => {}} />);
    await screen.findByText("会员等级");

    clickTab("余额");
    await waitFor(() => {
      expect(mockedGetUserLedger).toHaveBeenCalledTimes(1);
    });

    clickTab("账本");
    await waitFor(() => {
      expect(screen.getByText("客服补偿")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /刷新账本/i }));
    await waitFor(() => {
      expect(mockedGetUserLedger).toHaveBeenCalledTimes(2);
    });
  });
});
