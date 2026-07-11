import { describe, expect, it, vi } from "vitest";

import { submissionFailure } from "@formadapter/core";

import { createHttpSubmission } from "../src";

function context(input: unknown) {
  return {
    formData: new FormData(),
    input,
    signal: new AbortController().signal,
  };
}

describe("HTTP submissions", () => {
  it("posts schema input as JSON and wraps successful response data", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ id: 42 }),
    );
    const submit = createHttpSubmission({ fetch: request, url: "/api/forms" });

    await expect(submit({}, context({ age: "42" }))).resolves.toEqual({
      data: { id: 42 },
      status: "success",
    });
    expect(request).toHaveBeenCalledWith("/api/forms", expect.objectContaining({
      body: JSON.stringify({ age: "42" }),
      method: "POST",
    }));
  });

  it("uses the global fetch implementation when no override is configured", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json("ok"));
    vi.stubGlobal("fetch", request);
    try {
      const submit = createHttpSubmission({ url: "/api/forms" });

      await expect(submit({}, context({}))).resolves.toEqual({
        data: "ok",
        status: "success",
      });
      expect(request).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("wraps successful domain payloads that contain a status property", async () => {
    const body = { id: 42, status: "success" };
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body));
    const submit = createHttpSubmission({ fetch: request, url: "/api/forms" });

    await expect(submit({}, context({}))).resolves.toEqual({
      data: body,
      status: "success",
    });
  });

  it("passes FormData and preserves a structured failure response", async () => {
    const failure = submissionFailure({
      errorKind: "validation",
      fieldErrors: { email: ["Already used"] },
    });
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(failure, { status: 422 }),
    );
    const submit = createHttpSubmission({
      body: "form-data",
      fetch: request,
      url: "/api/forms",
    });
    const result = await submit({}, context({}));

    expect(result).toEqual(failure);
    const init = request.mock.calls[0]?.[1];
    expect(init?.body).toBeInstanceOf(FormData);
    expect(new Headers(init?.headers).has("content-type")).toBe(false);
  });

  it("hides unstructured server failures and supports custom request init", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("Temporarily unavailable", { status: 503 }),
    );
    const submit = createHttpSubmission({
      fetch: request,
      init: () => ({ headers: { authorization: "Bearer test" }, method: "PUT" }),
      url: "/api/forms",
    });

    await expect(submit({}, context({ value: 1 }))).resolves.toMatchObject({
      errorKind: "transport",
      formErrors: ["Request failed with status 503"],
      status: "error",
    });
    expect(request).toHaveBeenCalledWith("/api/forms", expect.objectContaining({
      method: "PUT",
    }));
  });

  it("keeps intentional client error messages while hiding all 5xx bodies", async () => {
    const clientFailure = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ message: "Choose a different email" }, { status: 409 }),
    );
    const serverFailure = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ message: "database password leaked" }, { status: 500 }),
    );

    await expect(createHttpSubmission({
      fetch: clientFailure,
      url: "/api/forms",
    })({}, context({}))).resolves.toMatchObject({
      formErrors: ["Choose a different email"],
      status: "error",
    });
    await expect(createHttpSubmission({
      fetch: serverFailure,
      url: "/api/forms",
    })({}, context({}))).resolves.toMatchObject({
      formErrors: ["Request failed with status 500"],
      status: "error",
    });
  });

  it("handles text and empty 4xx responses without exposing implementation errors", async () => {
    const textFailure = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("That request conflicts", { status: 409 }),
    );
    const emptyFailure = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 400 }),
    );

    await expect(createHttpSubmission({
      fetch: textFailure,
      url: "/api/forms",
    })({}, context({}))).resolves.toMatchObject({
      formErrors: ["That request conflicts"],
      status: "error",
    });
    await expect(createHttpSubmission({
      errorMessage: "Check the request",
      fetch: emptyFailure,
      url: "/api/forms",
    })({}, context({}))).resolves.toMatchObject({
      formErrors: ["Check the request"],
      status: "error",
    });
  });

  it("never treats a structured success body on a failed response as success", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ data: { id: 42 }, status: "success" }, { status: 500 }),
    );
    const submit = createHttpSubmission({ fetch: request, url: "/api/forms" });

    await expect(submit({}, context({}))).resolves.toEqual({
      errorKind: "transport",
      fieldErrors: {},
      formErrors: ["Request failed with status 500"],
      status: "error",
    });
  });

  it("does not preserve malformed structured failures", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ message: "Invalid", status: "error" }, { status: 422 }),
    );
    const submit = createHttpSubmission({ fetch: request, url: "/api/forms" });

    await expect(submit({}, context({}))).resolves.toEqual({
      errorKind: "transport",
      fieldErrors: {},
      formErrors: ["Invalid"],
      status: "error",
    });
  });

  it("parses structured-suffix JSON response media types", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: 42 }), {
        headers: { "content-type": "application/problem+json; charset=utf-8" },
      }),
    );
    const submit = createHttpSubmission({ fetch: request, url: "/api/forms" });

    await expect(submit({}, context({}))).resolves.toEqual({
      data: { id: 42 },
      status: "success",
    });
  });

  it("preserves a structured application failure returned with a successful status", async () => {
    const failure = submissionFailure({
      fieldErrors: { email: ["Already used"] },
    });
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(failure));
    const submit = createHttpSubmission({ fetch: request, url: "/api/forms" });

    await expect(submit({}, context({}))).resolves.toEqual(failure);
  });

  it("handles no-content success responses and preserves explicit headers", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    const submit = createHttpSubmission({
      fetch: request,
      init: { headers: { "content-type": "application/custom" } },
      url: "/api/forms",
    });

    await expect(submit({}, context({}))).resolves.toEqual({ status: "success" });
    expect(request).toHaveBeenCalledWith("/api/forms", expect.objectContaining({
      headers: expect.objectContaining({}),
    }));
    const headers = new Headers(request.mock.calls[0]?.[1]?.headers);
    expect(headers.get("content-type")).toBe("application/custom");
  });

  it("uses the configured message for an empty HTTP failure", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 500 }),
    );
    const submit = createHttpSubmission({
      errorMessage: "Please try again",
      fetch: request,
      url: "/api/forms",
    });

    await expect(submit({}, context({}))).resolves.toMatchObject({
      errorKind: "transport",
      formErrors: ["Please try again"],
      status: "error",
    });
  });

  it("converts network and malformed-response failures to safe transport states", async () => {
    const networkFailure = vi.fn<typeof fetch>().mockRejectedValue(
      new TypeError("getaddrinfo ENOTFOUND internal-service.example"),
    );
    const malformedResponse = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("{broken", {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );

    await expect(createHttpSubmission({
      fetch: networkFailure,
      url: "/api/forms",
    })({}, context({}))).resolves.toEqual({
      errorKind: "transport",
      fieldErrors: {},
      formErrors: ["Unable to reach the server. Please try again."],
      status: "error",
    });
    await expect(createHttpSubmission({
      fetch: malformedResponse,
      url: "/api/forms",
    })({}, context({}))).resolves.toEqual({
      errorKind: "transport",
      fieldErrors: {},
      formErrors: ["Unable to read the server response. Please try again."],
      status: "error",
    });
  });

  it("safely handles hostile errors, hostile bodies, and blank messages", async () => {
    const networkValue = Proxy.revocable({}, {});
    networkValue.revoke();
    const networkFailure = vi.fn<typeof fetch>().mockRejectedValue(
      networkValue.proxy,
    );
    const bodyValue = new Proxy({}, {
      get: (_target, key) => {
        if (key === "then") return undefined;
        throw new Error("hostile getter");
      },
      getOwnPropertyDescriptor: () => {
        throw new Error("hostile descriptor");
      },
      ownKeys: () => {
        throw new Error("hostile keys");
      },
    });
    const hostileResponse = {
      headers: new Headers({ "content-type": "application/json" }),
      json: vi.fn<() => Promise<unknown>>().mockResolvedValue(bodyValue),
      ok: false,
      status: 400,
    } as unknown as Response;
    const bodyFailure = vi.fn<typeof fetch>().mockResolvedValue(hostileResponse);
    const blankFailure = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ message: "  " }, { status: 409 }),
    );

    await expect(createHttpSubmission({
      errorMessage: "",
      fetch: networkFailure,
      url: "/api/forms",
    })({}, context({}))).resolves.toMatchObject({
      formErrors: ["Unable to reach the server. Please try again."],
      status: "error",
    });
    await expect(createHttpSubmission({
      fetch: bodyFailure,
      url: "/api/forms",
    })({}, context({}))).resolves.toMatchObject({
      formErrors: ["Request failed with status 400"],
      status: "error",
    });
    await expect(createHttpSubmission({
      fetch: blankFailure,
      url: "/api/forms",
    })({}, context({}))).resolves.toMatchObject({
      formErrors: ["Request failed with status 409"],
      status: "error",
    });
  });

  it("preserves abort control flow instead of turning it into a form error", async () => {
    const abort = new DOMException("Aborted", "AbortError");
    const request = vi.fn<typeof fetch>().mockRejectedValue(abort);
    const submit = createHttpSubmission({ fetch: request, url: "/api/forms" });

    await expect(submit({}, context({}))).rejects.toBe(abort);
  });

  it("preserves aborts raised while decoding the response body", async () => {
    const abort = new DOMException("Aborted", "AbortError");
    const response = {
      headers: new Headers({ "content-type": "application/json" }),
      json: vi.fn<() => Promise<never>>().mockRejectedValue(abort),
      ok: true,
      status: 200,
    } as unknown as Response;
    const request = vi.fn<typeof fetch>().mockResolvedValue(response);
    const submit = createHttpSubmission({ fetch: request, url: "/api/forms" });

    await expect(submit({}, context({}))).rejects.toBe(abort);
  });
});
