import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { auditSummary, listAudit } from "@/api/audit";
import {
  fetchCodesKpi,
  fetchMetricsSummary,
  fetchSubscriptionDistribution,
} from "@/api/metrics";
import { DashboardPage } from "../Dashboard";

vi.mock("@/api/metrics", () => ({
  fetchMetricsSummary: vi.fn(),
  fetchSubscriptionDistribution: vi.fn(),
  fetchCodesKpi: vi.fn(),
}));

vi.mock("@/api/audit", () => ({
  auditSummary: vi.fn(),
  listAudit: vi.fn(),
}));

vi.mock("recharts", () => ({
  Bar: () => null,
  BarChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  Cell: () => null,
  Pie: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const metricsMock = vi.mocked(fetchMetricsSummary);
const distributionMock = vi.mocked(fetchSubscriptionDistribution);
const codesMock = vi.mocked(fetchCodesKpi);
const summaryMock = vi.mocked(auditSummary);
const auditMock = vi.mocked(listAudit);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function mockSuccessfulModules() {
  distributionMock.mockResolvedValue({ items: [], total: 0 });
  codesMock.mockResolvedValue({
    activeCount: 3,
    consumedLast7Days: 1,
    issuedLast7Days: 2,
    revokedLast7Days: 0,
  });
  summaryMock.mockResolvedValue({ items: [], days: 7, total: 0 });
  auditMock.mockResolvedValue({ items: [], nextCursor: null });
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("单个模块失败时仍展示其他模块数据", async () => {
    metricsMock.mockRejectedValue(new Error("指标服务不可用"));
    mockSuccessfulModules();

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("部分仪表盘模块加载失败")).toBeInTheDocument();
    expect(screen.getByText("指标服务不可用")).toBeInTheDocument();
    expect(screen.getAllByText("3")).not.toHaveLength(0);
  });

  it("较早刷新后返回时不会覆盖较新的数据", async () => {
    const firstMetrics = deferred<Awaited<ReturnType<typeof fetchMetricsSummary>>>();
    const secondMetrics = deferred<Awaited<ReturnType<typeof fetchMetricsSummary>>>();
    metricsMock
      .mockReturnValueOnce(firstMetrics.promise)
      .mockReturnValueOnce(secondMetrics.promise);
    mockSuccessfulModules();

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await screen.findByRole("button", { name: "刷新" });
    fireEvent.click(screen.getByRole("button", { name: "刷新" }));

    secondMetrics.resolve({
      userCount: 22,
      sevenDayActive: 2,
      sevenDayGrantTotal: 2,
      billsPending: 2,
      billsSettledLast7Days: 2,
      billsRefundedLast7Days: 0,
    });

    expect(await screen.findByText("22")).toBeInTheDocument();

    firstMetrics.resolve({
      userCount: 11,
      sevenDayActive: 1,
      sevenDayGrantTotal: 1,
      billsPending: 1,
      billsSettledLast7Days: 1,
      billsRefundedLast7Days: 0,
    });

    await Promise.resolve();
    expect(screen.getByText("22")).toBeInTheDocument();
    expect(screen.queryByText("11")).toBeNull();
  });
});
