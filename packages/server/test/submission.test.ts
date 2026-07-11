import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  initialSubmissionState,
  submissionFailure,
} from "@formadapter/core";

import {
  createSubmissionHandler,
  createSubmissionHandlerFactory,
  fieldError,
  formError,
  type SubmissionHandlerContext,
} from "../src";

describe("createSubmissionHandler", () => {
  it("validates FormData, passes transformed output and context, and wraps data", async () => {
    const schema = z.object({ count: z.number() }).transform(({ count }) => ({
      doubled: count * 2,
    }));
    const request = new Request("https://example.test/submit", { method: "POST" });
    const handler = vi.fn<(
      value: { doubled: number },
      context: SubmissionHandlerContext<{ id: string }>,
    ) => { id: string }>((value, context) => {
      expect(context.payloadKind).toBe("form-data");
      expect(context.formData).toBeInstanceOf(FormData);
      expect(context.request).toBe(request);
      return { id: String(value.doubled) };
    });
    const submission = createSubmissionHandler(schema, handler);
    const formData = new FormData();
    formData.set("count", "4");

    await expect(submission(formData, { request })).resolves.toEqual({
      status: "success",
      data: { id: "8" },
    });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("validates JSON payloads without FormData decoding", async () => {
    const schema = z.object({ count: z.number() });
    const submission = createSubmissionHandler(schema, (value, context) => ({
      count: value.count,
      kind: context.payloadKind,
    }));

    await expect(submission({ count: 3 })).resolves.toEqual({
      status: "success",
      data: { count: 3, kind: "json" },
    });
  });

  it("keeps transport-reserved names available to JSON-only submissions", async () => {
    const schema = z.object({
      profile: z.object({ ["__formadapter_value"]: z.string() }),
      $ACTION_ID_profile: z.string(),
    });
    const submission = createSubmissionHandler(schema, (value) => value);
    const payload = {
      profile: { __formadapter_value: "nested marker" },
      $ACTION_ID_profile: "action value",
    };

    await expect(submission(payload)).resolves.toEqual({
      data: payload,
      status: "success",
    });
  });

  it("validates the exact JSON payload without pruning unknown keys", async () => {
    const handler = vi.fn<() => void>();
    const submission = createSubmissionHandler(
      z.object({ count: z.number() }).strict(),
      handler,
    );

    const result = await submission({ count: 3, unexpected: "not allowed" });

    expect(result).toMatchObject({
      status: "error",
      errorKind: "validation",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not turn malformed JSON objects into absent optional values", async () => {
    const handler = vi.fn<() => void>();
    const submission = createSubmissionHandler(
      z.object({ profile: z.object({ name: z.string() }).optional() }),
      handler,
    );

    const result = await submission({ profile: "not-an-object" });

    expect(result).toMatchObject({
      status: "error",
      errorKind: "validation",
      fieldErrors: { profile: expect.any(Array) },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns validation errors without invoking the business handler", async () => {
    const handler = vi.fn<() => void>();
    const submission = createSubmissionHandler(
      z.object({ email: z.email() }),
      handler,
    );

    await expect(submission({ email: "not-an-email" })).resolves.toMatchObject({
      status: "error",
      errorKind: "validation",
      fieldErrors: { email: expect.any(Array) },
      formErrors: [],
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("converts known form and field business errors", async () => {
    const schema = z.object({ email: z.email() });
    const fieldSubmission = createSubmissionHandler(schema, () => {
      throw fieldError("email", "Already registered");
    });
    const formSubmission = createSubmissionHandler(schema, () => {
      throw formError("Service temporarily unavailable");
    });
    const payload = { email: "ada@example.com" };

    await expect(fieldSubmission(payload)).resolves.toEqual({
      status: "error",
      errorKind: "business",
      fieldErrors: { email: ["Already registered"] },
      formErrors: [],
    });
    await expect(formSubmission(payload)).resolves.toEqual({
      status: "error",
      errorKind: "business",
      fieldErrors: {},
      formErrors: ["Service temporarily unavailable"],
    });
  });

  it("passes through explicit submission states and supports void success", async () => {
    const schema = z.object({ value: z.string() });
    const failed = createSubmissionHandler(schema, () =>
      submissionFailure({ formErrors: ["Nope"] }));
    const succeeded = createSubmissionHandler(schema, () => undefined);

    await expect(failed({ value: "x" })).resolves.toEqual({
      status: "error",
      errorKind: "business",
      fieldErrors: {},
      formErrors: ["Nope"],
    });
    await expect(succeeded({ value: "x" })).resolves.toEqual({ status: "success" });
  });

  it("wraps domain data that happens to contain a status property", async () => {
    const domainResult = { id: 42, status: "success" } as const;
    const submission = createSubmissionHandler(
      z.object({ value: z.string() }),
      () => domainResult,
    );

    await expect(submission({ value: "x" })).resolves.toEqual({
      data: domainResult,
      status: "success",
    });
  });

  it("exposes the previous action state to the business handler", async () => {
    const submission = createSubmissionHandler(
      z.object({ value: z.string() }),
      (_value, context) => ({ previous: context.previousState?.status }),
    );

    await expect(
      submission({ value: "x" }, { previousState: initialSubmissionState }),
    ).resolves.toEqual({
      status: "success",
      data: { previous: "idle" },
    });
  });

  it("forwards transport context without allowing adapter fields to be spoofed", async () => {
    const frameworkContext = { accountId: "account-1" };
    const serverFnMeta = { id: "save-profile" };
    const formData = new FormData();
    formData.set("value", "x");
    const submission = createSubmissionHandler(
      z.object({ value: z.string() }),
      (_value, context) => ({
        accountId: (context.context as typeof frameworkContext).accountId,
        formData: context.formData,
        method: context.method,
        payloadKind: context.payloadKind,
        serverFnMeta: context.serverFnMeta,
      }),
    );

    await expect(submission(formData, {
      context: frameworkContext,
      formData: "spoofed",
      method: "POST",
      payloadKind: "json",
      serverFnMeta,
    })).resolves.toEqual({
      status: "success",
      data: {
        accountId: "account-1",
        formData,
        method: "POST",
        payloadKind: "form-data",
        serverFnMeta,
      },
    });
  });

  it("creates context-bound handlers without changing runtime behavior", async () => {
    type InvocationContext = {
      readonly context: { readonly accountId: string };
      readonly method: "POST";
      readonly serverFnMeta: unknown;
    };
    const createContextualSubmission =
      createSubmissionHandlerFactory<InvocationContext>();
    const submission = createContextualSubmission(
      z.object({ value: z.string() }),
      (value, context) => ({
        accountId: context.context.accountId,
        method: context.method,
        value: value.value,
      }),
    );

    await expect(submission({ value: "x" }, {
      context: { accountId: "account-1" },
      method: "POST",
      serverFnMeta: { id: "save" },
    })).resolves.toEqual({
      data: { accountId: "account-1", method: "POST", value: "x" },
      status: "success",
    });
  });

  it("rethrows unexpected validation and business errors", async () => {
    const validationError = new Error("validator crashed");
    const schema = z.object({ value: z.string() });
    const badSchema = {
      ...schema,
      "~standard": {
        ...schema["~standard"],
        validate: () => {
          throw validationError;
        },
      },
    };
    const businessError = new Error("database crashed");
    const validationSubmission = createSubmissionHandler(badSchema, () => undefined);
    const businessSubmission = createSubmissionHandler(schema, () => {
      throw businessError;
    });

    await expect(validationSubmission({ value: "x" })).rejects.toBe(validationError);
    await expect(businessSubmission({ value: "x" })).rejects.toBe(businessError);
  });
});
