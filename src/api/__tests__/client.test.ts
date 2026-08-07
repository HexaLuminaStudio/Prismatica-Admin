import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError, apiRequest, setAuthFailureHandler } from "../client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiRequest", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
    setAuthFailureHandler(() => undefined);
  });

  afterEach(() => {
    setAuthFailureHandler(() => undefined);
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("GET 遇到 5xx 后按退避重试并返回成功数据", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ code: "INTERNAL_ERROR", message: "暂时失败" }, 503))
      .mockResolvedValueOnce(jsonResponse({ code: "OK", data: { value: 42 } }));

    const request = apiRequest<{ value: number }>("/v1/test");
    await vi.advanceTimersByTimeAsync(250);

    await expect(request).resolves.toEqual({ value: 42 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("GET 网络错误达到上限后抛出最后一个错误", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValue(new TypeError("network down"));

    const request = apiRequest("/v1/test");
    const assertion = expect(request).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      httpStatus: 0,
    });
    await vi.runAllTimersAsync();

    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("POST 和 noRetry GET 均不重试", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async () =>
      jsonResponse({ code: "INTERNAL_ERROR", message: "失败" }, 500)
    );

    await expect(apiRequest("/v1/test", { method: "POST" })).rejects.toBeInstanceOf(ApiClientError);
    await expect(apiRequest("/v1/test", { noRetry: true })).rejects.toBeInstanceOf(ApiClientError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("401 触发鉴权失败处理且不重试", async () => {
    const onAuthFailure = vi.fn();
    setAuthFailureHandler(onAuthFailure);
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      jsonResponse({ code: "ADMIN_LOGIN_REQUIRED", message: "登录已过期" }, 401)
    );

    await expect(apiRequest("/v1/admin/users")).rejects.toMatchObject({
      code: "ADMIN_LOGIN_REQUIRED",
      httpStatus: 401,
      message: "登录已过期",
    });
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("skipAuthRedirect 的 401 不触发鉴权失败处理", async () => {
    const onAuthFailure = vi.fn();
    setAuthFailureHandler(onAuthFailure);
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ code: "ADMIN_INVALID_CREDENTIALS", message: "凭据错误" }, 401)
    );

    await expect(apiRequest("/v1/admin/auth/login", { skipAuthRedirect: true })).rejects.toMatchObject({
      code: "ADMIN_INVALID_CREDENTIALS",
      httpStatus: 401,
    });
    expect(onAuthFailure).not.toHaveBeenCalled();
  });
});
