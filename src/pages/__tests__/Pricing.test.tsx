import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPricingDraft,
  getPricingOverview,
  publishPricingVersion,
} from "@/api/pricing";
import { useSessionStore } from "@/store/session";
import { PricingPage } from "../Pricing";

vi.mock("@/api/pricing", () => ({
  getPricingOverview: vi.fn(),
  createPricingDraft: vi.fn(),
  publishPricingVersion: vi.fn(),
}));

vi.mock("@/components/Toast", () => ({ toast: vi.fn() }));

const overview = {
  activeVersion: "2026.08.10-initial",
  rules: [
    {
      featureCode: "analysis_export",
      displayName: "语料分析导出",
      billingMode: "fixed" as const,
      unitName: "次",
      unitSize: 1,
      fixedCost: 5,
      baseCost: 0,
      perUnitCost: 0,
      inputTokenCostPerUnit: 0,
      outputTokenCostPerUnit: 0,
      minCost: 5,
      maxCost: 5,
      enabled: true,
    },
    {
      featureCode: "hsk_download",
      displayName: "HSK 语料下载",
      billingMode: "metered" as const,
      unitName: "千条",
      unitSize: 1000,
      fixedCost: 0,
      baseCost: 0,
      perUnitCost: 3,
      inputTokenCostPerUnit: 0,
      outputTokenCostPerUnit: 0,
      minCost: 3,
      maxCost: 1_000_000,
      enabled: true,
    },
    {
      featureCode: "ai_chat",
      displayName: "AI 聊天",
      billingMode: "token" as const,
      unitName: "Token",
      unitSize: 1_000_000,
      fixedCost: 0,
      baseCost: 0,
      perUnitCost: 0,
      inputTokenCostPerUnit: 1,
      outputTokenCostPerUnit: 2,
      minCost: 1,
      maxCost: 100_000,
      enabled: true,
    },
  ],
  versions: [],
};

describe("PricingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPricingOverview).mockResolvedValue(overview);
    useSessionStore.setState({
      me: { userId: "1", username: "root", role: "owner", status: "active" },
      authorized: true,
    });
  });

  it("非 owner 只能查看价格", async () => {
    useSessionStore.setState({
      me: { userId: "2", username: "operator", role: "admin", status: "active" },
    });
    render(<PricingPage />);
    expect(await screen.findByText("语料分析导出")).toBeInTheDocument();
    expect(screen.getByText(/只有 owner 能创建并发布/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /发布新价格/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("固定价")).toBeDisabled();
    expect(screen.getByText(/每 1,000 条为一档/)).toBeInTheDocument();
  });

  it("owner 修改后确认发布完整的新价格版本", async () => {
    vi.mocked(createPricingDraft).mockResolvedValue({
      versionCode: "20260810220000-test",
      status: "draft",
      rules: overview.rules,
    });
    vi.mocked(publishPricingVersion).mockResolvedValue({
      versionCode: "20260810220000-test",
      status: "published",
      publishedAt: "2026-08-10T22:00:00Z",
    });
    render(<PricingPage />);
    const fixedInput = await screen.findByLabelText("固定价");
    fireEvent.change(fixedInput, { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: /发布新价格/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent("正在执行的任务不会改变");
    fireEvent.click(screen.getByRole("button", { name: "确认发布" }));

    await waitFor(() => expect(createPricingDraft).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createPricingDraft).mock.calls[0][0][0]).toMatchObject({
      fixedCost: 8,
      minCost: 8,
      maxCost: 8,
    });
    await waitFor(() =>
      expect(publishPricingVersion).toHaveBeenCalledWith("20260810220000-test")
    );
  });

  it("owner 可以调整按量下载单价", async () => {
    render(<PricingPage />);
    const meteredInput = await screen.findByLabelText("千条单价");
    fireEvent.change(meteredInput, { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: /发布新价格/ }));
    vi.mocked(createPricingDraft).mockResolvedValue({
      versionCode: "20260810221000-metered",
      status: "draft",
      rules: overview.rules,
    });
    vi.mocked(publishPricingVersion).mockResolvedValue({
      versionCode: "20260810221000-metered",
      status: "published",
      publishedAt: "2026-08-10T22:10:00Z",
    });
    fireEvent.click(screen.getByRole("button", { name: "确认发布" }));
    await waitFor(() => expect(createPricingDraft).toHaveBeenCalled());
    expect(vi.mocked(createPricingDraft).mock.calls[0][0][1]).toMatchObject({
      featureCode: "hsk_download",
      unitSize: 1000,
      perUnitCost: 4,
    });
  });

  it("owner 可以按更大的 Token 单位调整 AI 定价", async () => {
    render(<PricingPage />);
    expect(await screen.findByText("AI 聊天")).toBeInTheDocument();
    expect(screen.getByText(/每 1,000,000 Token 为计价单位/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Token 计量单位"), { target: { value: "500000" } });
    fireEvent.change(screen.getByLabelText("输出 / 单位"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /发布新价格/ }));
    vi.mocked(createPricingDraft).mockResolvedValue({
      versionCode: "20260817120000-ai",
      status: "draft",
      rules: overview.rules,
    });
    vi.mocked(publishPricingVersion).mockResolvedValue({
      versionCode: "20260817120000-ai",
      status: "published",
      publishedAt: "2026-08-17T12:00:00Z",
    });
    fireEvent.click(screen.getByRole("button", { name: "确认发布" }));
    await waitFor(() => expect(createPricingDraft).toHaveBeenCalled());
    expect(vi.mocked(createPricingDraft).mock.calls[0][0][2]).toMatchObject({
      featureCode: "ai_chat",
      unitSize: 500_000,
      inputTokenCostPerUnit: 1,
      outputTokenCostPerUnit: 3,
    });
  });
});
