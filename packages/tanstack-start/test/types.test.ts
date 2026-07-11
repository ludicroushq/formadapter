import { expectTypeOf, it } from "vitest";

import type { SubmissionState } from "@formadapter/core";

import {
  useTanStackStartSubmission,
  type FormAdapterSubmissionContext,
  type TanStackStartCallOptions,
  type UseTanStackStartSubmissionOptions,
} from "../src/client";
import {
  formDataValidator,
  tanstackStartHandler,
  type TanStackStartSubmissionContext,
} from "../src/server";

it("preserves submission result and handler types structurally", () => {
  type Result = SubmissionState<{ id: string }>;
  const serverFn = Object.assign(
    async (_options: TanStackStartCallOptions): Promise<Result> => ({
      data: { id: "saved" },
      status: "success",
    }),
    { method: "POST" as const, url: "/_server/save" },
  );

  function Component(): null {
    const submit = useTanStackStartSubmission(serverFn);
    expectTypeOf(submit).parameter(0).toEqualTypeOf<unknown>();
    expectTypeOf(submit).parameter(1).toEqualTypeOf<
      FormAdapterSubmissionContext
    >();
    expectTypeOf(submit).returns.resolves.toEqualTypeOf<Result>();
    expectTypeOf(submit.url).toEqualTypeOf<string>();
    return null;
  }

  const submission = async (
    _payload: unknown,
    _context?: TanStackStartSubmissionContext,
  ): Promise<Result> => ({ status: "idle" });
  const handler = tanstackStartHandler(submission);
  expectTypeOf(handler).returns.resolves.toEqualTypeOf<Result>();
  expectTypeOf<TanStackStartSubmissionContext<{ accountId: string }>>()
    .toEqualTypeOf<{
      readonly context: { accountId: string };
      readonly method: "POST";
      readonly serverFnMeta: unknown;
    }>();
  expectTypeOf(formDataValidator).parameter(0).toEqualTypeOf<FormData>();
  expectTypeOf(Component).toBeFunction();
});

it("preserves configured form values and schema input in client callbacks", () => {
  type Result = SubmissionState<{ id: string }>;
  type Values = { readonly normalizedName: string };
  type Input = { readonly name: string };
  const serverFn = Object.assign(
    async (_options: TanStackStartCallOptions): Promise<Result> => ({
      data: { id: "saved" },
      status: "success",
    }),
    { method: "POST" as const, url: "/_server/save" },
  );
  const options: UseTanStackStartSubmissionOptions<Values, Input> = {
    getFormData: (values, context) => {
      expectTypeOf(values).toEqualTypeOf<Values>();
      expectTypeOf(context.input).toEqualTypeOf<Input>();
      // @ts-expect-error transformed values do not expose raw schema input keys
      void values.name;
      // @ts-expect-error schema input does not expose transformed output keys
      void context.input.normalizedName;
      return context.formData;
    },
    headers: (values, context) => ({
      "x-name": `${values.normalizedName}:${context.input.name}`,
    }),
  };

  function Component(): null {
    const submit = useTanStackStartSubmission(serverFn, options);
    expectTypeOf(submit).parameter(0).toEqualTypeOf<Values>();
    expectTypeOf(submit).parameter(1).toEqualTypeOf<
      FormAdapterSubmissionContext<Input>
    >();
    expectTypeOf(submit).returns.resolves.toEqualTypeOf<Result>();
    return null;
  }

  expectTypeOf(Component).toBeFunction();
});
