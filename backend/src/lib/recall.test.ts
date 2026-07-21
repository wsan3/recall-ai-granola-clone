import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

describe("recall.ts", () => {
  beforeEach(() => {
    // recall.ts reads RECALL_REGION/RECALL_API_KEY into module-level
    // constants at import time, so each test needs a fresh module instance
    // to observe its own env var changes.
    vi.resetModules();
    process.env.RECALL_REGION = "us-west-2";
    process.env.RECALL_API_KEY = "test-api-key";
    vi.useFakeTimers();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("recallBaseUrl builds the URL from RECALL_REGION", async () => {
    const { recallBaseUrl } = await import("./recall");
    expect(recallBaseUrl()).toBe("https://us-west-2.recall.ai");
  });

  it("throws a clear error when RECALL_REGION/RECALL_API_KEY are not set", async () => {
    delete process.env.RECALL_REGION;
    delete process.env.RECALL_API_KEY;
    const { recallBaseUrl } = await import("./recall");
    expect(() => recallBaseUrl()).toThrow(/RECALL_REGION and RECALL_API_KEY/);
  });

  it("returns immediately on a 200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const { recallFetch } = await import("./recall");
    const response = await recallFetch("/api/v1/sdk_upload/");

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://us-west-2.recall.ai/api/v1/sdk_upload/",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Token test-api-key" }),
      })
    );
  });

  it("retries a 429 after the Retry-After delay, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { error: "rate limited" }, { "Retry-After": "1" }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Math, "random").mockReturnValue(0); // no jitter, deterministic delay

    const { recallFetch } = await import("./recall");
    const promise = recallFetch("/api/v1/sdk_upload/");

    await vi.advanceTimersByTimeAsync(1000);
    const response = await promise;

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("backs off 10s on a 503 and 30s on a 507", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(jsonResponse(507, {}))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Math, "random").mockReturnValue(0);

    const { recallFetch } = await import("./recall");
    const promise = recallFetch("/api/v1/sdk_upload/");

    await vi.advanceTimersByTimeAsync(10_000);
    await vi.advanceTimersByTimeAsync(30_000);
    const response = await promise;

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gives up and returns the last response after maxAttempts is exhausted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(503, {}));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Math, "random").mockReturnValue(0);

    const { recallFetch } = await import("./recall");
    const promise = recallFetch("/api/v1/sdk_upload/", { maxAttempts: 2 });

    await vi.advanceTimersByTimeAsync(10_000);
    const response = await promise;

    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("createSdkUpload configures desktop_sdk_callback with the expected realtime events", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { id: "up_1", upload_token: "tok_1" }));
    vi.stubGlobal("fetch", fetchMock);

    const { createSdkUpload } = await import("./recall");
    const result = await createSdkUpload();

    expect(result).toEqual({ id: "up_1", upload_token: "tok_1" });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.recording_config.transcript.provider).toEqual({ recallai_streaming: {} });
    expect(body.recording_config.realtime_endpoints).toEqual([
      expect.objectContaining({
        type: "desktop_sdk_callback",
        events: expect.arrayContaining(["transcript.data", "transcript.partial_data"]),
      }),
    ]);
  });

  it("retrieveRecording throws with response details on failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("not found", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const { retrieveRecording } = await import("./recall");
    await expect(retrieveRecording("rec_1")).rejects.toThrow(/404/);
  });
});
