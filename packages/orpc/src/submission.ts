import {
  isSubmissionState,
  submissionSuccess,
} from "@formadapter/core";
import type {
  SubmissionState,
} from "@formadapter/core";

import { unknownErrorToSubmission } from "./errors";
import type {
  ORPCAction,
  ORPCActionSubmissionOptions,
  ORPCCallable,
  ORPCClientInput,
  ORPCClientOutput,
  ORPCErrorLike,
  ORPCSubmissionData,
  ORPCSubmissionHandler,
  ORPCSubmissionOptionsRest,
  ORPCSubmitContext,
  ORPCValueOrFactory,
} from "./types";

async function resolveValue<Value, Values, Input>(
  value: ORPCValueOrFactory<Value, Values, Input> | undefined,
  values: Values,
  context: ORPCSubmitContext<Input>,
): Promise<Value | undefined> {
  if (typeof value === "function") {
    return await (
      value as (
        currentValues: Values,
        currentContext: typeof context,
      ) => Value | PromiseLike<Value>
    )(values, context);
  }
  return value;
}

function normalizeOutput<Output>(
  output: Output,
): SubmissionState<ORPCSubmissionData<Output>> {
  return isSubmissionState(output)
    ? (output as SubmissionState<ORPCSubmissionData<Output>>)
    : submissionSuccess(output as ORPCSubmissionData<Output>);
}

function safeCallerOptions(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const result = { ...(value as Readonly<Record<string, unknown>>) };
  delete result.context;
  delete result.signal;
  return result;
}

/** Adapts a normal oRPC procedure client to a FormAdapter onSubmit handler. */
export function createORPCSubmission<
  Client extends ORPCCallable,
  Input = ORPCClientInput<Client>,
  Values = unknown,
>(
  client: Client,
  ...[options]: ORPCSubmissionOptionsRest<Client, Input, Values>
): ORPCSubmissionHandler<
  Input,
  Values,
  ORPCSubmissionData<ORPCClientOutput<Client>>
> {
  return async (values, context) => {
    const input = options?.mapInput
      ? await options.mapInput(values, context)
      : context.input;
    const suppliedOptions = await resolveValue(
      options?.options,
      values,
      context,
    );
    const suppliedContext = await resolveValue(
      options?.context,
      values,
      context,
    );
    const callerOptions = safeCallerOptions(suppliedOptions);
    if (suppliedContext !== undefined) {
      callerOptions.context = suppliedContext;
    }
    callerOptions.signal = context.signal;

    try {
      const call = client as unknown as (
        procedureInput: ORPCClientInput<Client>,
        procedureOptions: Readonly<Record<string, unknown>>,
      ) => unknown;
      const output = (await call(
        input as ORPCClientInput<Client>,
        callerOptions,
      )) as ORPCClientOutput<Client>;
      return normalizeOutput(output);
    } catch (error) {
      const custom = options?.mapError
        ? await options.mapError(
            error as Parameters<NonNullable<typeof options.mapError>>[0],
            values,
            context,
          )
        : undefined;
      return (
        custom ??
        (unknownErrorToSubmission(
          error,
          options?.unknownErrorMessage,
        ) as SubmissionState<ORPCSubmissionData<ORPCClientOutput<Client>>>)
      );
    }
  };
}

/**
 * Adapts an oRPC `.actionable()` tuple to FormAdapter.
 * Unexpected throws are intentionally preserved for framework redirects/not-found control flow.
 */
export function createORPCActionSubmission<
  ActionInput,
  Output,
  ErrorType extends ORPCErrorLike,
  Input = ActionInput,
  Values = unknown,
>(
  action: ORPCAction<ActionInput, Output, ErrorType>,
  options: ORPCActionSubmissionOptions<
    ActionInput,
    Output,
    ErrorType,
    Input,
    Values
  > = {},
): ORPCSubmissionHandler<Input, Values, ORPCSubmissionData<Output>> {
  return async (values, context) => {
    const input = options.mapInput
      ? await options.mapInput(values, context)
      : context.input;
    const [error, output] = await action(input as ActionInput);

    if (error !== null) {
      const custom = options.mapError
        ? await options.mapError(error, values, context)
        : undefined;
      return (
        custom ??
        (unknownErrorToSubmission(
          error,
          options.unknownErrorMessage,
        ) as SubmissionState<ORPCSubmissionData<Output>>)
      );
    }

    return normalizeOutput(output as Output);
  };
}
