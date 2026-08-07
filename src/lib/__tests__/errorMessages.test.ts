/**
 * errorMessages 单测(2026-08-06 P0-B M7)
 *
 * 覆盖:
 *  - 已知错误码命中映射
 *  - 未知错误码回退到 message
 *  - 普通 Error / 任意对象兜底
 */

import { describe, expect, it } from "vitest";
import { classifyError } from "../errorMessages";
import { ApiClientError } from "@/api/client";

describe("classifyError", () => {
  it("命中 ADMIN_LOGIN_REQUIRED", () => {
    const e = new ApiClientError("ADMIN_LOGIN_REQUIRED", "请重新登录", 401);
    const msg = classifyError(e);
    expect(msg.title).toBe("请先登录");
    expect(msg.description).toMatch(/重新登录/);
  });

  it("命中 ADMIN_ACCOUNT_LOCKED", () => {
    const e = new ApiClientError("ADMIN_ACCOUNT_LOCKED", "locked", 423);
    const msg = classifyError(e);
    expect(msg.title).toBe("账号已锁定");
  });

  it("命中 INSUFFICIENT_BALANCE", () => {
    const e = new ApiClientError(
      "INSUFFICIENT_BALANCE",
      "余额不足,本次需要 20 点,当前可用 5 点",
      402
    );
    const msg = classifyError(e);
    expect(msg.title).toBe("余额不足");
    expect(msg.description).toMatch(/充值|赠送/);
  });

  it("命中 MAX_DEVICES_REACHED", () => {
    const e = new ApiClientError("MAX_DEVICES_REACHED", "device cap", 403);
    const msg = classifyError(e);
    expect(msg.title).toBe("已达设备上限");
  });

  it("未知 code + 有 message → 用 message 当 description", () => {
    const e = new ApiClientError("WEIRD_CODE", "自定义说明", 400);
    const msg = classifyError(e);
    expect(msg.title).toBe("错误(WEIRD_CODE)");
    expect(msg.description).toBe("自定义说明");
  });

  it("未识别 code + 503 → 用 code 优先(message),不强行退到 HTTP 兜底", () => {
    const e = new ApiClientError("UNKNOWN", "msg", 503);
    const msg = classifyError(e);
    expect(msg.title).toBe("错误(UNKNOWN)");
    expect(msg.description).toBe("msg");
  });

  it("code 为空字符串 + 503 → 走 HTTP 503 fallback", () => {
    const e = new ApiClientError("", "msg", 503);
    const msg = classifyError(e);
    expect(msg.title).toBe("服务暂不可用");
  });

  it("普通 Error → title=操作失败,description=message", () => {
    const msg = classifyError(new Error("boom"));
    expect(msg.title).toBe("操作失败");
    expect(msg.description).toBe("boom");
  });

  it("完全未知对象 → 兜底文案", () => {
    const msg = classifyError("string error");
    expect(msg.title).toBe("操作失败");
  });

  it("null → 兜底文案", () => {
    const msg = classifyError(null);
    expect(msg.title).toBe("操作失败");
  });
});