import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError, setAuthFailureHandler } from "@/api/client";
import { downloadCsv } from "../utils";

const fetchMock = vi.fn<typeof fetch>();

describe("downloadCsv", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:test"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    setAuthFailureHandler(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("通过统一客户端下载 CSV Blob", async () => {
    const blob = new Blob(["id,name\n1,test"], { type: "text/csv" });
    fetchMock.mockResolvedValue(new Response(blob, { status: 200 }));

    await downloadCsv("/v1/admin/export/users.csv", "users.csv");

    expect(fetchMock).toHaveBeenCalledWith(
      "/v1/admin/export/users.csv",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({ Accept: "text/csv" }),
      })
    );
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ size: 13 }));
  });

  it("认证失败时触发统一处理并抛出 ApiClientError", async () => {
    const authFailure = vi.fn();
    setAuthFailureHandler(authFailure);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: "ADMIN_LOGIN_REQUIRED", message: "登录已失效" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(downloadCsv("/v1/admin/export/users.csv", "users.csv")).rejects.toMatchObject({
      code: "ADMIN_LOGIN_REQUIRED",
      message: "登录已失效",
      httpStatus: 401,
    });
    expect(authFailure).toHaveBeenCalledTimes(1);
  });

  it("解析嵌套错误 envelope", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "EXPORT_FORBIDDEN",
            message: "无权导出",
            requestId: "request-1",
          },
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      )
    );

    const error = await downloadCsv("/v1/admin/export/users.csv", "users.csv").catch(
      (caughtError: unknown) => caughtError
    );

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      code: "EXPORT_FORBIDDEN",
      message: "无权导出",
      httpStatus: 403,
      requestId: "request-1",
    });
  });
});
