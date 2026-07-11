import type {
  FormSchema,
  SubmissionState,
} from "@formadapter/core";
import type { SubmitHandler } from "@formadapter/react";
import type { Client as OfficialORPCClient } from "@orpc/client";
import { describe, expectTypeOf, it, vi } from "vitest";

import {
  createORPCActionSubmission,
  createORPCSubmission,
} from "../src";
import type {
  ORPCClientContext,
  ORPCClientError,
  ORPCClientInput,
  ORPCClientOutput,
  ORPCSubmissionData,
} from "../src";

type PromiseWithError<Output, ErrorType> = Promise<Output> & {
  readonly __error?: { readonly type: ErrorType };
};

type Schema = FormSchema<
  { quantity: string },
  { quantity: number }
>;

type ConflictError = {
  readonly code: "CONFLICT";
  readonly message: string;
  readonly status: 409;
};

type Client = (
  input: { quantity: string },
  options?: {
    readonly context?: { readonly tenant?: string };
    readonly signal?: AbortSignal;
  },
) => PromiseWithError<{ id: number }, ConflictError>;

describe("oRPC adapter types", () => {
  it("infers structural client inputs, outputs, errors, and context", () => {
    expectTypeOf<ORPCClientInput<Client>>().toEqualTypeOf<{
      quantity: string;
    }>();
    expectTypeOf<ORPCClientOutput<Client>>().toEqualTypeOf<{ id: number }>();
    expectTypeOf<ORPCClientError<Client>>().toEqualTypeOf<ConflictError>();
    expectTypeOf<ORPCClientContext<Client>>().toEqualTypeOf<{
      readonly tenant?: string;
    }>();
    expectTypeOf<ORPCSubmissionData<SubmissionState<string>>>().toEqualTypeOf<string>();
  });

  it("creates a handler compatible with the form schema", () => {
    const client = vi.fn<Client>();
    const submit = createORPCSubmission(client);
    expectTypeOf(submit).toMatchTypeOf<SubmitHandler<Schema>>();
  });

  it("accepts the official oRPC Client type", () => {
    type OfficialClient = OfficialORPCClient<
      Record<never, never>,
      { quantity: string },
      { id: number },
      ConflictError
    >;
    const client: OfficialClient = async () => ({ id: 1 });
    const submit = createORPCSubmission(client);

    expectTypeOf(submit).toMatchTypeOf<SubmitHandler<Schema>>();
  });

  it("requires required oRPC context", () => {
    type RequiredClient = (
      input: { quantity: string },
      options: {
        readonly context: { readonly token: string };
        readonly signal?: AbortSignal;
      },
    ) => Promise<{ id: number }>;
    const client = vi.fn<RequiredClient>();

    // @ts-expect-error a required oRPC context needs a value or factory
    createORPCSubmission(client);
    createORPCSubmission(client, { context: { token: "secret" } });
    createORPCSubmission(client, {
      context: (_values, context) => {
        expectTypeOf(context.input).toEqualTypeOf<{ quantity: string }>();
        return { token: "secret" };
      },
    });
  });

  it("infers mapped form input and validated values", () => {
    const client = vi.fn<
      (input: { count: number }) => Promise<{ saved: true }>
    >();
    const submit = createORPCSubmission(client, {
      mapInput: (
        values: { count: string },
        context: {
          readonly formData: FormData;
          readonly input: { rawCount: string };
          readonly signal: AbortSignal;
        },
      ) => ({ count: Number(values.count || context.input.rawCount) }),
    });
    type MappedSchema = FormSchema<
      { rawCount: string },
      { count: string }
    >;
    expectTypeOf(submit).toMatchTypeOf<SubmitHandler<MappedSchema>>();
  });

  it("creates an actionable handler compatible with the form schema", () => {
    const action = async (input: { quantity: string }) =>
      [null, { received: input.quantity }] as const;
    const submit = createORPCActionSubmission(action);
    expectTypeOf(submit).toMatchTypeOf<SubmitHandler<Schema>>();
  });
});
