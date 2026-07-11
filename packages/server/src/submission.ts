import {
  compileForm,
  isSubmissionState,
  submissionFailure,
  submissionSuccess,
} from "@formadapter/core";
import type {
  FormSchema,
  SubmissionState,
} from "@formadapter/core";

import { FormAdapterServerError } from "./error";
import {
  parseFormDataWithModel,
  validateSubmissionValue,
} from "./form-data";
import type {
  CreatedSubmissionHandler,
  ContextualCreatedSubmissionHandler,
  CreateSubmissionHandler,
  SubmissionHandlerContext,
  SubmissionInvocationContext,
  SubmissionOptions,
  SubmissionValueHandler,
} from "./types";

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

function handlerContext<Data, InvocationContext extends object>(
  payload: unknown,
  context: InvocationContext | undefined,
): SubmissionHandlerContext<Data, InvocationContext> {
  const formData = isFormData(payload) ? payload : undefined;
  const forwarded = { ...context } as Record<string, unknown>;
  delete forwarded.formData;
  delete forwarded.payloadKind;
  return {
    ...forwarded,
    ...(formData ? { formData } : {}),
    payloadKind: formData ? "form-data" : "json",
  } as SubmissionHandlerContext<Data, InvocationContext>;
}

/** Compiles a schema once and returns a transport-neutral submission function. */
export function createSubmissionHandler<
  Schema extends FormSchema,
  Data = unknown,
>(
  schema: Schema,
  handler: SubmissionValueHandler<Schema, Data>,
  options?: SubmissionOptions<Schema>,
): CreatedSubmissionHandler<Data>;
export function createSubmissionHandler<
  Schema extends FormSchema,
  Data,
  InvocationContext extends object,
>(
  schema: Schema,
  handler: SubmissionValueHandler<Schema, Data, InvocationContext>,
  options?: SubmissionOptions<Schema>,
): ContextualCreatedSubmissionHandler<Data, InvocationContext>;
export function createSubmissionHandler<
  Schema extends FormSchema,
  Data = unknown,
  InvocationContext extends object = SubmissionInvocationContext<Data>,
>(
  schema: Schema,
  handler: SubmissionValueHandler<Schema, Data, InvocationContext>,
  options: SubmissionOptions<Schema> = {},
): CreatedSubmissionHandler<Data, InvocationContext> {
  const model = compileForm(schema, options.config ?? {});

  return async (
    payload: unknown,
    context?: InvocationContext,
  ): Promise<SubmissionState<Data>> => {
    const parsed = isFormData(payload)
      ? await parseFormDataWithModel(schema, model, payload)
      : await validateSubmissionValue(schema, model, payload);

    if (!parsed.success) {
      return submissionFailure({
        errorKind: "validation",
        fieldErrors: parsed.fieldErrors,
        formErrors: parsed.formErrors,
      });
    }

    try {
      const result = await handler(parsed.data, handlerContext(payload, context));
      if (isSubmissionState(result)) {
        return result as SubmissionState<Data>;
      }
      return submissionSuccess<Data>(result as Data);
    } catch (error) {
      if (error instanceof FormAdapterServerError) {
        return submissionFailure({
          errorKind: "business",
          fieldErrors: error.fieldErrors,
          formErrors: error.formErrors,
        });
      }
      throw error;
    }
  };
}

/** Binds a transport invocation-context type while preserving schema/data inference. */
export function createSubmissionHandlerFactory<
  InvocationContext extends object,
>(): CreateSubmissionHandler<InvocationContext> {
  return createSubmissionHandler as CreateSubmissionHandler<InvocationContext>;
}
