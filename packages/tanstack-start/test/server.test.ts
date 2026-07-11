import { describe, expect, it, vi } from "vitest";

import type { FormSchema, SubmissionState } from "@formadapter/core";
import { createSubmissionHandler } from "../../server/src";

import {
  formDataValidator,
  tanstackStartHandler,
} from "../src/server";

describe("TanStack Start server submission", () => {
  it("accepts only FormData", () => {
    const formData = new FormData();
    expect(formDataValidator(formData)).toBe(formData);
    expect(() => formDataValidator("wrong" as never)).toThrow(TypeError);
  });

  it("forwards FormData and the structural handler context", async () => {
    const state = {
      data: { id: "saved" },
      status: "success",
    } as const satisfies SubmissionState<{ id: string }>;
    const submission = vi.fn<
      (payload: unknown) => Promise<typeof state>
    >(async (_payload) => state);
    const handler = tanstackStartHandler(submission);
    const formData = new FormData();
    const serverFnMeta = { id: "save-profile" };

    await expect(handler({
      context: { accountId: "account-1" },
      data: formData,
      method: "POST",
      serverFnMeta,
    })).resolves.toBe(state);
    expect(submission).toHaveBeenCalledWith(formData, {
      context: { accountId: "account-1" },
      method: "POST",
      serverFnMeta,
    });
  });

  it("preserves TanStack middleware context through a real server submission", async () => {
    const schema: FormSchema<{ name: string }> = {
      "~standard": {
        jsonSchema: {
          input: () => ({
            properties: { name: { type: "string" } },
            required: ["name"],
            type: "object",
          }),
          output: () => ({ type: "object" }),
        },
        types: undefined,
        validate: (value) => ({ value: value as { name: string } }),
        vendor: "fixture",
        version: 1,
      },
    };
    const submission = createSubmissionHandler(
      schema,
      (value, context) => ({
        accountId: (context.context as { accountId: string }).accountId,
        method: context.method,
        name: value.name,
      }),
    );
    const handler = tanstackStartHandler(submission);
    const formData = new FormData();
    formData.set("name", "Ada");

    await expect(handler({
      context: { accountId: "account-1" },
      data: formData,
      method: "POST",
      serverFnMeta: { id: "save-profile" },
    })).resolves.toEqual({
      data: {
        accountId: "account-1",
        method: "POST",
        name: "Ada",
      },
      status: "success",
    });
  });
});
