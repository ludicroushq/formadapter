import { createServerFn } from "@tanstack/react-start";
import { expectTypeOf } from "vitest";

import type {
  FormSchema,
  SubmissionState,
} from "@formadapter/core";
import type { SubmitHandler } from "../../react/src/types";

import {
  useTanStackStartSubmission,
  type UseTanStackStartSubmissionOptions,
} from "../src/client";
import {
  formDataValidator,
  tanstackStartHandler,
} from "../src/server";

type Result = SubmissionState<{ id: string }>;
declare const profileSchema: FormSchema<
  { readonly name: string },
  { readonly normalizedName: string }
>;

const submission = async (_payload: unknown): Promise<Result> => ({
  data: { id: "saved" },
  status: "success",
});

export const saveProfile = createServerFn({ method: "POST" })
  .validator(formDataValidator)
  .handler(tanstackStartHandler(submission));

const profileOptions: UseTanStackStartSubmissionOptions<
  { readonly normalizedName: string },
  { readonly name: string }
> = {
  headers: (values, context) => {
    // @ts-expect-error transformed values do not contain the input key
    void values.name;
    // @ts-expect-error raw input does not contain the transformed key
    void context.input.normalizedName;
    return {
      "x-profile": `${values.normalizedName}:${context.input.name}`,
    };
  },
};

function TypeProof(): null {
  const onSubmit = useTanStackStartSubmission(saveProfile, profileOptions);
  expectTypeOf(onSubmit).returns.resolves.toEqualTypeOf<Result>();
  expectTypeOf(onSubmit).parameter(0).toEqualTypeOf<{
    readonly normalizedName: string;
  }>();
  expectTypeOf(onSubmit).toMatchTypeOf<SubmitHandler<typeof profileSchema>>();
  return null;
}

expectTypeOf(TypeProof).toBeFunction();
