import {
  initialSubmissionState,
  submissionFailure,
  submissionSuccess,
} from "@formadapter/core";
import { describe, expect, it, vi } from "vitest";

import {
  createORPCActionSubmission,
  createORPCSubmission,
} from "../src";

function submitContext<Input>(input: Input, signal = new AbortController().signal) {
  return {
    formData: new FormData(),
    input,
    signal,
  };
}

describe("createORPCSubmission", () => {
  it("sends raw schema input, forwards the signal, and wraps output", async () => {
    const signal = new AbortController().signal;
    const calls: unknown[][] = [];
    const client = async (
      input: { quantity: string },
      options?: { signal?: AbortSignal },
    ) => {
      calls.push([input, options]);
      return { id: 42 };
    };

    const submit = createORPCSubmission(client);
    await expect(
      submit({ quantity: 2 }, submitContext({ quantity: "2" }, signal)),
    ).resolves.toEqual(submissionSuccess({ id: 42 }));
    expect(calls).toEqual([
      [{ quantity: "2" }, { signal }],
    ]);
  });

  it("supports async map, context, and caller-options factories", async () => {
    const signal = new AbortController().signal;
    const calls: unknown[][] = [];
    const client = async (
      input: { id: number },
      options: {
        context: { token: string };
        lastEventId?: string;
        signal?: AbortSignal;
      },
    ) => {
      calls.push([input, options]);
      return "saved";
    };
    const submit = createORPCSubmission(client, {
      context: async (values: { id: string }) => ({ token: `token-${values.id}` }),
      mapInput: async (
        values: { id: string },
        _context: {
          readonly formData: FormData;
          readonly input: { source: string };
          readonly signal: AbortSignal;
        },
      ) => ({ id: Number(values.id) }),
      options: async (_values: { id: string }, context) => ({
        lastEventId: String(context.formData.get("event")),
      }),
    });
    const context = submitContext({ source: "form" }, signal);
    context.formData.set("event", "evt-1");

    await expect(submit({ id: "7" }, context)).resolves.toEqual(
      submissionSuccess("saved"),
    );
    expect(calls).toEqual([
      [
        { id: 7 },
        {
          context: { token: "token-7" },
          lastEventId: "evt-1",
          signal,
        },
      ],
    ]);
  });

  it("accepts static context/options and protects adapter-owned options", async () => {
    const signal = new AbortController().signal;
    let received: unknown;
    const client = async (
      input: string,
      options?: {
        context?: { token: string };
        lastEventId?: string;
        signal?: AbortSignal;
      },
    ) => {
      received = [input, options];
    };
    const submit = createORPCSubmission(client, {
      context: { token: "correct" },
      options: {
        context: { token: "wrong" },
        lastEventId: "evt",
        signal: new AbortController().signal,
      } as never,
    });

    await submit("parsed", submitContext("raw", signal));
    expect(received).toEqual([
      "raw",
      {
        context: { token: "correct" },
        lastEventId: "evt",
        signal,
      },
    ]);
  });

  it("passes through a procedure SubmissionState", async () => {
    const result = submissionSuccess({ id: 1 }, "Saved");
    const submit = createORPCSubmission(async (_input: string) => result);
    await expect(submit("parsed", submitContext("raw"))).resolves.toBe(result);

    const idle = createORPCSubmission(async (_input: string) => initialSubmissionState);
    await expect(idle("parsed", submitContext("raw"))).resolves.toBe(
      initialSubmissionState,
    );
  });

  it("wraps procedure domain data that contains a status property", async () => {
    const domainResult = { id: 42, status: "success" } as const;
    const submit = createORPCSubmission(async (_input: string) => domainResult);

    await expect(submit("parsed", submitContext("raw"))).resolves.toEqual({
      data: domainResult,
      status: "success",
    });
  });

  it("maps typed FormAdapter and Standard Schema errors", async () => {
    const failure = submissionFailure({
      fieldErrors: { email: ["Already registered"] },
    });
    const formErrorClient = async (_input: string) => {
      throw {
        code: "FORM_SUBMISSION_FAILED",
        data: failure,
        message: "Form submission failed",
        status: 422,
      };
    };
    await expect(
      createORPCSubmission(formErrorClient)("parsed", submitContext("raw")),
    ).resolves.toBe(failure);

    const validationClient = async (_input: string) => {
      throw {
        code: "BAD_REQUEST",
        data: { issues: [{ message: "Required", path: ["email"] }] },
        message: "Input validation failed",
        status: 400,
      };
    };
    await expect(
      createORPCSubmission(validationClient)("parsed", submitContext("raw")),
    ).resolves.toEqual(
      submissionFailure({
        errorKind: "validation",
        fieldErrors: { email: ["Required"] },
      }),
    );
  });

  it("lets a custom mapper override built-in handling", async () => {
    const error = {
      code: "CONFLICT",
      message: "Conflict",
      status: 409,
    };
    const client = async (_input: string) => {
      throw error;
    };
    const mapError = vi.fn<(received: unknown) => Promise<ReturnType<typeof submissionFailure>>>(async (received) => {
      expect(received).toBe(error);
      return submissionFailure({ formErrors: ["Choose another name"] });
    });
    const submit = createORPCSubmission(client, { mapError });

    await expect(submit("parsed", submitContext("raw"))).resolves.toEqual(
      submissionFailure({ formErrors: ["Choose another name"] }),
    );
    expect(mapError).toHaveBeenCalledOnce();
  });

  it("falls through when a custom mapper declines and hides unknown errors", async () => {
    const client = async (_input: string) => {
      throw new Error("Internal detail");
    };
    const submit = createORPCSubmission(client, {
      mapError: () => undefined,
      unknownErrorMessage: "Try again shortly.",
    });

    await expect(submit("parsed", submitContext("raw"))).resolves.toEqual(
      submissionFailure({
        errorKind: "transport",
        formErrors: ["Try again shortly."],
      }),
    );
  });
});

describe("createORPCActionSubmission", () => {
  it("adapts successful actionable tuples", async () => {
    const calls: unknown[] = [];
    const action = async (input: { name: string }) => {
      calls.push(input);
      return [null, { id: 1 }] as const;
    };
    const submit = createORPCActionSubmission(action);

    await expect(
      submit({ name: "parsed" }, submitContext({ name: "raw" })),
    ).resolves.toEqual(submissionSuccess({ id: 1 }));
    expect(calls).toEqual([{ name: "raw" }]);
  });

  it("maps actionable JSON errors and custom input/error mappings", async () => {
    const action = async (input: number) => {
      expect(input).toBe(9);
      return [
        {
          code: "CONFLICT",
          data: undefined,
          defined: true,
          message: "Conflict",
          status: 409,
        },
        undefined,
      ] as const;
    };
    const submit = createORPCActionSubmission(action, {
      mapError: () =>
        submissionFailure({ formErrors: ["Custom actionable error"] }),
      mapInput: (
        values: { id: string },
        _context: {
          readonly formData: FormData;
          readonly input: { source: string };
          readonly signal: AbortSignal;
        },
      ) => Number(values.id),
    });

    await expect(
      submit({ id: "9" }, submitContext({ source: "raw" })),
    ).resolves.toEqual(
      submissionFailure({ formErrors: ["Custom actionable error"] }),
    );
  });

  it("uses built-in error mapping and passes through submission output", async () => {
    const failure = submissionFailure({ formErrors: ["No access"] });
    const failedAction = async (_input: string) =>
      [
        {
          code: "FORM_SUBMISSION_FAILED",
          data: failure,
          defined: true,
          message: "Form submission failed",
          status: 422,
        },
        undefined,
      ] as const;
    await expect(
      createORPCActionSubmission(failedAction)("parsed", submitContext("raw")),
    ).resolves.toBe(failure);

    const successAction = async (_input: string) =>
      [null, submissionSuccess("done")] as const;
    await expect(
      createORPCActionSubmission(successAction)("parsed", submitContext("raw")),
    ).resolves.toEqual(submissionSuccess("done"));
  });

  it("preserves thrown framework control-flow values", async () => {
    const redirect = new Error("redirect");
    Object.assign(redirect, { digest: "NEXT_REDIRECT;/done" });
    const action = async (_input: string): Promise<never> => {
      throw redirect;
    };
    const submit = createORPCActionSubmission(action);

    await expect(submit("parsed", submitContext("raw"))).rejects.toBe(redirect);
  });
});
