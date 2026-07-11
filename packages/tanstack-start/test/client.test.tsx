import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SubmissionState } from "@formadapter/core";

import {
  getTanStackStartSubmissionMetadata,
  useTanStackStartSubmission,
  type FormAdapterSubmissionContext,
  type TanStackStartCallOptions,
} from "../src/client";

const success = {
  data: { id: "saved" },
  status: "success",
} as const satisfies SubmissionState<{ id: string }>;

function submissionContext(
  formData: FormData,
  signal: AbortSignal,
): FormAdapterSubmissionContext {
  return { formData, input: {}, signal };
}

describe("TanStack Start client submission", () => {
  it("uses FormData and AbortSignal while preserving original URL metadata", async () => {
    const serverFn = Object.assign(
      vi.fn(async (_options: TanStackStartCallOptions) => success),
      { method: "POST" as const, url: "/_server/save-profile" },
    );
    const { result } = renderHook(() =>
      useTanStackStartSubmission(serverFn),
    );
    const formData = new FormData();
    formData.set("name", "Ada");
    const controller = new AbortController();

    let state: SubmissionState | undefined;
    await act(async () => {
      state = await result.current(
        { ignored: true },
        submissionContext(formData, controller.signal),
      );
    });

    expect(state).toBe(success);
    expect(serverFn).toHaveBeenCalledWith({
      data: formData,
      signal: controller.signal,
    });
    expect(result.current.url).toBe(serverFn.url);
    expect(result.current.metadata).toEqual({
      encType: "multipart/form-data",
      method: "post",
      url: serverFn.url,
    });
  });

  it("supports alternate FormData, dynamic headers, and a custom fetch", async () => {
    const serverFn = Object.assign(
      vi.fn(async (_options: TanStackStartCallOptions) => success),
      { method: "POST" as const, url: "/_server/save" },
    );
    const replacement = new FormData();
    replacement.set("source", "replacement");
    const customFetch = vi.fn<typeof fetch>();
    const headers = vi.fn<(
      values: unknown,
      context: FormAdapterSubmissionContext,
    ) => HeadersInit>(() => ({ "x-form-source": "profile" }));
    const { result } = renderHook(() =>
      useTanStackStartSubmission(serverFn, {
        fetch: customFetch,
        getFormData: () => replacement,
        headers,
      }),
    );
    const context = submissionContext(
      new FormData(),
      new AbortController().signal,
    );

    await act(async () => {
      await result.current({}, context);
    });

    expect(headers).toHaveBeenCalledWith({}, context);
    expect(serverFn).toHaveBeenCalledWith({
      data: replacement,
      fetch: customFetch,
      headers: { "x-form-source": "profile" },
      signal: context.signal,
    });
  });

  it("rejects GET server functions and reads metadata without wrapping", () => {
    const getServerFn = Object.assign(
      async (_options: TanStackStartCallOptions) => success,
      { method: "GET" as const, url: "/_server/read" },
    );

    expect(() =>
      renderHook(() => useTanStackStartSubmission(getServerFn)),
    ).toThrow(/POST server function/);
    expect(getTanStackStartSubmissionMetadata(getServerFn).url).toBe(
      getServerFn.url,
    );
  });
});
