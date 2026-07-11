import type {
  FailedSubmission,
  MaybePromise,
  StandardResult,
  SubmissionState,
  SuccessfulSubmission,
} from "@formadapter/core";

/** The structural callable shape shared by oRPC procedure clients. */
export type ORPCCallable = (...args: never[]) => unknown;

type ClientArguments<Client extends ORPCCallable> = Client extends (
  ...args: infer Arguments
) => unknown
  ? Arguments
  : never;

type SecondArgument<Arguments extends readonly unknown[]> = Arguments extends readonly [
  unknown,
  ...infer Rest,
]
  ? Rest[0]
  : never;

type ClientResult<Client extends ORPCCallable> = Client extends (
  ...args: never[]
) => infer Result
  ? Result
  : never;

type NonNever<Value, Fallback> = [Value] extends [never] ? Fallback : Value;

/** The input accepted by an oRPC procedure client. */
export type ORPCClientInput<Client extends ORPCCallable> = ClientArguments<Client>[0];

/** The resolved output returned by an oRPC procedure client. */
export type ORPCClientOutput<Client extends ORPCCallable> = Awaited<
  ClientResult<Client>
>;

/** The error recorded on oRPC's structurally typed PromiseWithError. */
export type ORPCClientError<Client extends ORPCCallable> = ClientResult<Client> extends {
  readonly __error?: { readonly type: infer ErrorType };
}
  ? ErrorType
  : unknown;

type InferredCallerOptions<Client extends ORPCCallable> = NonNullable<
  SecondArgument<ClientArguments<Client>>
>;

/** Caller options accepted by the client, excluding values controlled by this adapter. */
export type ORPCCallerOptions<Client extends ORPCCallable> = NonNever<
  InferredCallerOptions<Client> extends object
    ? Omit<InferredCallerOptions<Client>, "context" | "signal">
    : never,
  Readonly<Record<never, never>>
>;

/** The per-call oRPC client context, if the client defines one. */
export type ORPCClientContext<Client extends ORPCCallable> = NonNever<
  InferredCallerOptions<Client> extends { readonly context?: infer Context }
    ? Context
    : never,
  Readonly<Record<never, never>>
>;

type ClientRequiresContext<Client extends ORPCCallable> = [
  InferredCallerOptions<Client>,
] extends [never]
  ? false
  : InferredCallerOptions<Client> extends { readonly context: unknown }
    ? true
    : false;

/** The structural FormAdapter context supplied to an oRPC submission handler. */
export interface ORPCSubmitContext<Input> {
  /** Prepared schema input before transforms. */
  readonly input: Input;
  readonly formData: FormData;
  readonly signal: AbortSignal;
}

type DataFromSubmissionState<State> = State extends SuccessfulSubmission<infer Data>
  ? Data
  : never;

/** Unwraps procedures that already return a shared SubmissionState. */
export type ORPCSubmissionData<Output> = [Output] extends [SubmissionState]
  ? DataFromSubmissionState<Output>
  : Output;

export type ORPCSubmissionHandler<Input, Values, Data> = (
  values: Values,
  context: ORPCSubmitContext<Input>,
) => Promise<SubmissionState<Data>>;

export type ORPCValueOrFactory<Value, Values, Input> =
  | Value
  | ((
      values: Values,
      context: ORPCSubmitContext<Input>,
    ) => MaybePromise<Value>);

export interface ORPCErrorLike<Data = unknown> {
  readonly code: string;
  readonly data?: Data;
  readonly defined?: boolean;
  readonly message: string;
  readonly status: number;
}

export type ORPCErrorMapper<ErrorType, Values, Input, Data> = (
  error: ErrorType,
  values: Values,
  context: ORPCSubmitContext<Input>,
) => MaybePromise<SubmissionState<Data> | undefined>;

interface ORPCSubmissionOptionsBase<
  Client extends ORPCCallable,
  Input,
  Values,
> {
  /** Maps form values/context to the procedure input. Defaults to context.input. */
  readonly mapInput?: (
    values: Values,
    context: ORPCSubmitContext<Input>,
  ) => MaybePromise<ORPCClientInput<Client>>;
  /** Handles application-specific oRPC errors before the built-in mappings run. */
  readonly mapError?: ORPCErrorMapper<
    ORPCClientError<Client>,
    Values,
    Input,
    ORPCSubmissionData<ORPCClientOutput<Client>>
  >;
  /** Static caller options or a per-submit factory. Signal and context are managed separately. */
  readonly options?: ORPCValueOrFactory<
    ORPCCallerOptions<Client>,
    Values,
    Input
  >;
  /** Safe message used for unknown, malformed, and server-side failures. */
  readonly unknownErrorMessage?: string;
}

type ORPCContextOption<Client extends ORPCCallable, Input, Values> =
  ClientRequiresContext<Client> extends true
    ? {
        readonly context: ORPCValueOrFactory<
          ORPCClientContext<Client>,
          Values,
          Input
        >;
      }
    : {
        readonly context?: ORPCValueOrFactory<
          ORPCClientContext<Client>,
          Values,
          Input
        >;
      };

export type ORPCSubmissionOptions<
  Client extends ORPCCallable,
  Input = ORPCClientInput<Client>,
  Values = unknown,
> = ORPCSubmissionOptionsBase<Client, Input, Values> &
  ORPCContextOption<Client, Input, Values>;

export type ORPCSubmissionOptionsRest<
  Client extends ORPCCallable,
  Input,
  Values,
> = ClientRequiresContext<Client> extends true
  ? [options: ORPCSubmissionOptions<Client, Input, Values>]
  : [options?: ORPCSubmissionOptions<Client, Input, Values>];

/** JSON-safe error returned by an oRPC actionable procedure. */
export interface ORPCActionError<Data = unknown> extends ORPCErrorLike<Data> {
  readonly defined: boolean;
}

export type ORPCActionResult<Output, ErrorType extends ORPCErrorLike> =
  | readonly [error: null, data: Output]
  | readonly [error: ErrorType, data: undefined];

export type ORPCAction<Input, Output, ErrorType extends ORPCErrorLike> = (
  input: Input,
) => PromiseLike<ORPCActionResult<Output, ErrorType>>;

export interface ORPCActionSubmissionOptions<
  ActionInput,
  Output,
  ErrorType extends ORPCErrorLike,
  Input = ActionInput,
  Values = unknown,
> {
  readonly mapInput?: (
    values: Values,
    context: ORPCSubmitContext<Input>,
  ) => MaybePromise<ActionInput>;
  readonly mapError?: ORPCErrorMapper<
    ErrorType,
    Values,
    Input,
    ORPCSubmissionData<Output>
  >;
  readonly unknownErrorMessage?: string;
}

/** Minimal Standard Schema shape used by oRPC error data declarations. */
export interface ORPCStandardSchema<Input, Output = Input> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly types?: {
      readonly input: Input;
      readonly output: Output;
    };
    readonly validate: (value: unknown) => StandardResult<Output>;
  };
}

/**
 * Kept as an object type alias (rather than an interface) so it is assignable
 * to oRPC 1.x's open-ended `ErrorMap` without widening the known error code.
 */
export type FormSubmissionErrorMap = {
  readonly FORM_SUBMISSION_FAILED: {
    readonly data: ORPCStandardSchema<FailedSubmission>;
    readonly message: "Form submission failed";
    readonly status: 422;
  };
};
