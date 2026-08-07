/**
 * Toast 组件测试(2026-08-06 P0-B M7)
 */

import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { ToastContainer, useToastStore, toast } from "../Toast";

describe("ToastContainer", () => {
  beforeEach(() => {
    useToastStore.getState().clear();
  });

  it("渲染空容器", () => {
    render(<ToastContainer />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("toast.push 后渲染一条 success", () => {
    render(<ToastContainer />);
    act(() => {
      toast({ kind: "success", title: "操作成功" });
    });
    expect(screen.getByRole("alert")).toHaveTextContent("操作成功");
  });

  it("error 类型有 destructive 文案", () => {
    render(<ToastContainer />);
    act(() => {
      toast({
        kind: "error",
        title: "出错了",
        description: "请稍后再试",
      });
    });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("出错了");
    expect(alert).toHaveTextContent("请稍后再试");
  });

  it("durationMs=0 不自动消失;dismiss 可手动移除", async () => {
    render(<ToastContainer />);
    let id = "";
    act(() => {
      id = useToastStore.getState().push({
        kind: "info",
        title: "持久通知",
        durationMs: 0,
      });
    });
    expect(screen.getByRole("alert")).toHaveTextContent("持久通知");
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    act(() => {
      useToastStore.getState().dismiss(id);
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("默认 duration 自动消失", async () => {
    render(<ToastContainer />);
    act(() => {
      toast({ kind: "success", title: "短暂" });
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await waitFor(
      () => {
        expect(screen.queryByRole("alert")).toBeNull();
      },
      { timeout: 4000 }
    );
  });
});