import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { initialSubmissionState } from "@formadapter/core";
import { submissionFailure } from "@formadapter/core";

import {
  createRequestHandler,
  createServerAction,
  createSubmissionHandler,
  fieldError,
  toRequestHandler,
  toServerAction,
} from "../src";

async function responseState(response: Response): Promise<unknown> {
  expect(response.headers.get("content-type")).toContain("application/json");
  return response.json();
}

describe("server action transport", () => {
  it("adapts one reusable submission to the native action signature", async () => {
    const submission = createSubmissionHandler(
      z.object({ count: z.number() }),
      (value, context) => ({
        count: value.count,
        previous: context.previousState?.status,
      }),
    );
    const action = toServerAction(submission);
    const formData = new FormData();
    formData.set("count", "5");

    await expect(action(initialSubmissionState, formData)).resolves.toEqual({
      status: "success",
      data: { count: 5, previous: "idle" },
    });
  });

  it("provides a direct schema factory", async () => {
    const action = createServerAction(
      z.object({ name: z.string() }),
      ({ name }) => ({ greeting: `Hello, ${name}` }),
    );
    const formData = new FormData();
    formData.set("name", "Ada");

    await expect(action(initialSubmissionState, formData)).resolves.toEqual({
      status: "success",
      data: { greeting: "Hello, Ada" },
    });
  });
});

describe("HTTP request transport", () => {
  const schema = z.object({ count: z.number().int().positive() });

  it("accepts JSON and exposes the original Request", async () => {
    const handler = createRequestHandler(schema, (value, context) => ({
      count: value.count,
      requestUrl: context.request?.url,
    }));
    const request = new Request("https://example.test/submissions", {
      body: JSON.stringify({ count: 2 }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const response = await handler(request);
    expect(response.status).toBe(200);
    await expect(responseState(response)).resolves.toEqual({
      status: "success",
      data: { count: 2, requestUrl: request.url },
    });
  });

  it("does not sanitize arbitrary JSON before strict schema validation", async () => {
    const businessHandler = vi.fn<() => void>();
    const handler = createRequestHandler(
      z.object({ count: z.number() }).strict(),
      businessHandler,
    );
    const request = new Request("https://example.test/submissions", {
      body: JSON.stringify({ count: 2, unexpected: true }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const response = await handler(request);

    expect(response.status).toBe(422);
    expect(await responseState(response)).toMatchObject({
      errorKind: "validation",
      status: "error",
    });
    expect(businessHandler).not.toHaveBeenCalled();
  });

  it("accepts multipart and URL-encoded FormData", async () => {
    const handler = toRequestHandler(
      createSubmissionHandler(schema, ({ count }) => ({ count })),
    );
    const multipart = new FormData();
    multipart.set("count", "3");
    const multipartResponse = await handler(new Request("https://example.test", {
      body: multipart,
      method: "POST",
    }));
    const encodedResponse = await handler(new Request("https://example.test", {
      body: new URLSearchParams({ count: "4" }),
      method: "POST",
    }));

    expect(multipartResponse.status).toBe(200);
    await expect(responseState(multipartResponse)).resolves.toEqual({
      status: "success",
      data: { count: 3 },
    });
    expect(encodedResponse.status).toBe(200);
    await expect(responseState(encodedResponse)).resolves.toEqual({
      status: "success",
      data: { count: 4 },
    });
  });

  it("returns 422 for validation and business failures", async () => {
    const validationHandler = createRequestHandler(schema, () => undefined);
    const businessHandler = createRequestHandler(schema, () => {
      throw fieldError("count", "That count is unavailable");
    });
    const invalidRequest = new Request("https://example.test", {
      body: JSON.stringify({ count: -1 }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const businessRequest = new Request("https://example.test", {
      body: JSON.stringify({ count: 1 }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const validationResponse = await validationHandler(invalidRequest);
    expect(validationResponse.status).toBe(422);
    expect(await responseState(validationResponse)).toMatchObject({
      status: "error",
      errorKind: "validation",
      fieldErrors: { count: expect.any(Array) },
    });
    const businessResponse = await businessHandler(businessRequest);
    expect(businessResponse.status).toBe(422);
    await expect(responseState(businessResponse)).resolves.toEqual({
      status: "error",
      errorKind: "business",
      fieldErrors: { count: ["That count is unavailable"] },
      formErrors: [],
    });
  });

  it("returns transport states for unsupported methods and media types", async () => {
    const handler = createRequestHandler(schema, () => undefined);
    const methodResponse = await handler(new Request("https://example.test", {
      method: "GET",
    }));
    const mediaResponse = await handler(new Request("https://example.test", {
      body: "count=1",
      headers: { "content-type": "text/plain" },
      method: "POST",
    }));

    expect(methodResponse.status).toBe(405);
    expect(methodResponse.headers.get("allow")).toBe("POST");
    expect(await responseState(methodResponse)).toMatchObject({
      status: "error",
      errorKind: "transport",
    });
    expect(mediaResponse.status).toBe(415);
    expect(await responseState(mediaResponse)).toMatchObject({
      status: "error",
      errorKind: "transport",
    });
  });

  it("returns a 400 transport state for malformed bodies", async () => {
    const handler = createRequestHandler(schema, () => undefined);
    const response = await handler(new Request("https://example.test", {
      body: "{not-json",
      headers: { "content-type": "application/problem+json" },
      method: "POST",
    }));

    expect(response.status).toBe(400);
    await expect(responseState(response)).resolves.toEqual({
      status: "error",
      errorKind: "transport",
      fieldErrors: {},
      formErrors: ["Unable to read the request body."],
    });
  });

  it("maps transport states returned by a submission and missing content types", async () => {
    const transportHandler = createRequestHandler(schema, () =>
      submissionFailure({ errorKind: "transport", formErrors: ["Upstream failed"] }));
    const transportResponse = await transportHandler(new Request("https://example.test", {
      body: JSON.stringify({ count: 1 }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }));
    const missingTypeHandler = createRequestHandler(schema, () => undefined);
    const missingTypeResponse = await missingTypeHandler(new Request("https://example.test", {
      body: "count=1",
      method: "POST",
    }));

    expect(transportResponse.status).toBe(400);
    await expect(responseState(transportResponse)).resolves.toMatchObject({
      status: "error",
      errorKind: "transport",
    });
    expect(missingTypeResponse.status).toBe(415);
  });

  it("rethrows unexpected business errors", async () => {
    const unexpected = new Error("database unavailable");
    const handler = createRequestHandler(schema, () => {
      throw unexpected;
    });
    const request = new Request("https://example.test", {
      body: JSON.stringify({ count: 1 }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    await expect(handler(request)).rejects.toBe(unexpected);
  });
});
