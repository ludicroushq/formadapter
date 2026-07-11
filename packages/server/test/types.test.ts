import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";

import type { SubmissionState } from "@formadapter/core";

import {
  createServerAction,
  createSubmissionHandler,
  createSubmissionHandlerFactory,
  parseFormData,
  toRequestHandler,
  toServerAction,
  type ContextualCreatedSubmissionHandler,
  type CreatedSubmissionHandler,
  type ParseFormDataResult,
  type RequestHandler,
  type ServerAction,
} from "../src";

describe("public type inference", () => {
  it("infers transformed schema output and submission result data", () => {
    const schema = z.object({ age: z.number() }).transform(({ age }) => ({
      adult: age >= 18,
    }));
    const submission = createSubmissionHandler(schema, ({ adult }) => ({ adult }));
    const action = toServerAction(submission);
    const directAction = createServerAction(schema, ({ adult }) => ({ adult }));
    const requestHandler = toRequestHandler(submission);
    const parsed = parseFormData(schema, new FormData());

    expectTypeOf(submission).toEqualTypeOf<
      CreatedSubmissionHandler<{ adult: boolean }>
    >();
    expectTypeOf(action).toEqualTypeOf<ServerAction<{ adult: boolean }>>();
    expectTypeOf(directAction).toEqualTypeOf<ServerAction<{ adult: boolean }>>();
    expectTypeOf(requestHandler).toEqualTypeOf<RequestHandler>();
    expectTypeOf(parsed).toEqualTypeOf<
      Promise<ParseFormDataResult<{ adult: boolean }>>
    >();
  });

  it("keeps action state data correlated with the handler result", () => {
    const action = createServerAction(
      z.object({ name: z.string() }),
      ({ name }) => ({ id: name.length }),
    );
    expectTypeOf(action).returns.resolves.toEqualTypeOf<
      SubmissionState<{ id: number }>
    >();
  });

  it("binds a transport context without losing schema or result inference", () => {
    type InvocationContext = {
      readonly context: { readonly accountId: string };
      readonly method: "POST";
      readonly serverFnMeta: unknown;
    };
    const schema = z.object({ name: z.string() }).transform(({ name }) => ({
      normalizedName: name.trim(),
    }));
    const createContextualSubmission =
      createSubmissionHandlerFactory<InvocationContext>();
    const submission = createContextualSubmission(
      schema,
      (value, context) => {
        expectTypeOf(value).toEqualTypeOf<{ normalizedName: string }>();
        expectTypeOf(context.context).toEqualTypeOf<{
          readonly accountId: string;
        }>();
        expectTypeOf(context.method).toEqualTypeOf<"POST">();
        // @ts-expect-error the bound context has no userId
        void context.context.userId;
        return { accountId: context.context.accountId };
      },
    );

    const typedSubmission: ContextualCreatedSubmissionHandler<
      { accountId: string },
      InvocationContext
    > = submission;
    expectTypeOf(typedSubmission).toBeFunction();
    expectTypeOf(submission).parameter(1).toEqualTypeOf<InvocationContext>();

    const invalidContext: InvocationContext = {
      // @ts-expect-error accountId is required by the bound invocation context
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
  });
});
