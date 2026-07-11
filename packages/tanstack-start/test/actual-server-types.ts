import {
  createMiddleware,
  createServerFn,
} from "@tanstack/react-start";
import { expectTypeOf } from "vitest";

import type { FormSchema, SubmissionState } from "@formadapter/core";
import { createSubmissionHandlerFactory } from "../../server/src";

import {
  formDataValidator,
  tanstackStartHandler,
  type TanStackStartSubmissionContext,
} from "../src/server";

type Result = SubmissionState<{ id: string }>;
type AuthContext = { readonly accountId: string };
type InvocationContext = TanStackStartSubmissionContext<AuthContext>;

const authMiddleware = createMiddleware().server(async ({ next }) =>
  next({ context: { accountId: "account-1" } as const }));

const schema: FormSchema<{ readonly name: string }> = {
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
    validate: (value) => ({ value: value as { readonly name: string } }),
    vendor: "fixture",
    version: 1,
  },
};

const createAuthenticatedSubmission =
  createSubmissionHandlerFactory<InvocationContext>();
const submission = createAuthenticatedSubmission(
  schema,
  (value, invocation) => {
    expectTypeOf(value).toEqualTypeOf<{ readonly name: string }>();
    expectTypeOf(invocation.context).toEqualTypeOf<AuthContext>();
    expectTypeOf(invocation.method).toEqualTypeOf<"POST">();
    // @ts-expect-error middleware context does not define userId
    void invocation.context.userId;
    return { id: `${invocation.context.accountId}:${value.name}` };
  },
);

export const actualAuthenticatedServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(formDataValidator)
  .handler(tanstackStartHandler(submission));

expectTypeOf(actualAuthenticatedServerFn).returns.resolves.toEqualTypeOf<Result>();
expectTypeOf(submission).parameter(1).toEqualTypeOf<InvocationContext>();

const invalidContext: InvocationContext = {
  // @ts-expect-error accountId is required by the middleware context
  context: {},
  method: "POST",
  serverFnMeta: {},
};
expectTypeOf(invalidContext).toEqualTypeOf<InvocationContext>();
const callWithoutContext = (): void => {
  // @ts-expect-error context-bound submissions require invocation context
  void submission({ name: "Ada" });
};
expectTypeOf(callWithoutContext).toBeFunction();
