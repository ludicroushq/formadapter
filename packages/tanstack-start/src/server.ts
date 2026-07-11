import type { SubmissionState } from "@formadapter/core";

export interface TanStackStartHandlerContext<Context = unknown> {
  readonly data: FormData;
  readonly context: Context;
  readonly method: "POST";
  readonly serverFnMeta: unknown;
}

export type TanStackStartSubmissionContext<Context = unknown> = Omit<
  TanStackStartHandlerContext<Context>,
  "data"
>;

/** Structural shape of a prebuilt `@formadapter/server` submission. */
export type FormAdapterSubmission<
  Result extends SubmissionState = SubmissionState,
  Context = unknown,
> = (
  payload: unknown,
  context: TanStackStartSubmissionContext<Context>,
) => Promise<Result>;

export type TanStackStartHandler<
  Result extends SubmissionState = SubmissionState,
  Context = unknown,
> = (context: TanStackStartHandlerContext<Context>) => Promise<Result>;

/** A canonical TanStack Start `.validator(...)` for POSTed FormData. */
export function formDataValidator(data: FormData): FormData {
  if (typeof FormData === "undefined" || !(data instanceof FormData)) {
    throw new TypeError("Expected FormData from a TanStack Start POST server function.");
  }
  return data;
}

/**
 * Adapts a prebuilt FormAdapter submission to a TanStack Start `.handler(...)`.
 * The remaining TanStack handler context is forwarded structurally as the
 * submission's optional second argument.
 */
export function tanstackStartHandler<
  Result extends SubmissionState,
  Context = unknown,
>(
  submission: FormAdapterSubmission<Result, Context>,
): TanStackStartHandler<Result, Context> {
  return async ({ data, ...context }): Promise<Result> =>
    submission(data, context);
}
