import type {
  FormConfig,
  FormSchema,
  InferInput,
  InferOutput,
  MaybePromise,
  SubmissionAction,
  SubmissionState,
} from "@formadapter/core";

export interface ParseFormDataSuccess<Output> {
  readonly success: true;
  readonly data: Output;
}

export interface ParseFormDataFailure {
  readonly success: false;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  readonly formErrors: readonly string[];
}

export type ParseFormDataResult<Output> =
  | ParseFormDataFailure
  | ParseFormDataSuccess<Output>;

export interface SubmissionOptions<Schema extends FormSchema> {
  readonly config?: FormConfig<InferInput<Schema>, string>;
}

export interface SubmissionInvocationContext<Data = unknown> {
  /** Transport-specific values (for example TanStack Start middleware context). */
  readonly [key: string]: unknown;
  readonly previousState?: SubmissionState<Data>;
  readonly request?: Request;
}

export type SubmissionHandlerContext<
  Data = unknown,
  InvocationContext extends object = SubmissionInvocationContext<Data>,
> = InvocationContext & {
  readonly payloadKind: "form-data" | "json";
  readonly formData?: FormData;
};

export type SubmissionHandlerResult<Data> =
  | Data
  | SubmissionState<Data>
  | void;

export type SubmissionValueHandler<
  Schema extends FormSchema,
  Data = unknown,
  InvocationContext extends object = SubmissionInvocationContext<Data>,
> = (
  value: InferOutput<Schema>,
  context: SubmissionHandlerContext<Data, InvocationContext>,
) => MaybePromise<SubmissionHandlerResult<Data>>;

export interface CreatedSubmissionHandler<
  Data = unknown,
  InvocationContext extends object = SubmissionInvocationContext<Data>,
> {
  (
    payload: unknown,
    context?: InvocationContext,
  ): Promise<SubmissionState<Data>>;
}

export interface ContextualCreatedSubmissionHandler<
  Data,
  InvocationContext extends object,
> {
  (
    payload: unknown,
    context: InvocationContext,
  ): Promise<SubmissionState<Data>>;
}

type DataFromResolvedHandlerResult<Result> =
  Result extends SubmissionState<infer Data>
    ? Data
    : Result extends void
      ? unknown
      : Result;

export type SubmissionDataFromHandlerResult<Result> =
  DataFromResolvedHandlerResult<Awaited<Result>>;

export interface CreateSubmissionHandler<InvocationContext extends object> {
  <Schema extends FormSchema, Result>(
    schema: Schema,
    handler: (
      value: InferOutput<Schema>,
      context: SubmissionHandlerContext<unknown, InvocationContext>,
    ) => MaybePromise<Result>,
    options?: SubmissionOptions<Schema>,
  ): ContextualCreatedSubmissionHandler<
    SubmissionDataFromHandlerResult<Result>,
    InvocationContext
  >;
}

export type ServerAction<Data = unknown> = SubmissionAction<FormData, Data>;

export type RequestHandler = (request: Request) => Promise<Response>;
