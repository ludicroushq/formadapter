import { createNullRecord, defineOwn, hasOwn } from "./record";

export type SubmissionErrorKind = "business" | "transport" | "validation";

export interface IdleSubmission {
  readonly status: "idle";
}

export interface SuccessfulSubmission<Data = unknown> {
  readonly status: "success";
  readonly data?: Data;
  readonly message?: string;
}

export interface FailedSubmission {
  readonly status: "error";
  readonly errorKind: SubmissionErrorKind;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  readonly formErrors: readonly string[];
}

export type SubmissionState<Data = unknown> =
  | FailedSubmission
  | IdleSubmission
  | SuccessfulSubmission<Data>;

export type SubmissionAction<Payload, Data = unknown> = (
  previousState: SubmissionState<Data>,
  payload: Payload,
) => Promise<SubmissionState<Data>>;

export const initialSubmissionState: IdleSubmission = { status: "idle" };

const SUCCESS_KEYS = new Set(["data", "message", "status"]);
const ERROR_KEYS = new Set(["errorKind", "fieldErrors", "formErrors", "status"]);

export function submissionFailure(
  options: {
    readonly errorKind?: SubmissionErrorKind;
    readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
    readonly formErrors?: readonly string[];
  } = {},
): FailedSubmission {
  const fieldErrors = createNullRecord<readonly string[]>();
  for (const [path, messages] of Object.entries(options.fieldErrors ?? {})) {
    defineOwn(fieldErrors, path, messages);
  }
  return {
    errorKind: options.errorKind ?? "business",
    fieldErrors,
    formErrors: options.formErrors ?? [],
    status: "error",
  };
}

export function submissionSuccess<Data = undefined>(
  data?: Data,
  message?: string,
): SuccessfulSubmission<Data> {
  return {
    ...(data !== undefined ? { data } : {}),
    ...(message ? { message } : {}),
    status: "success",
  };
}

export function isSubmissionState(value: unknown): value is SubmissionState {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return false;
    }
    const state = value as Readonly<Record<string, unknown>>;
    if (!hasOwn(state, "status") || Object.getOwnPropertySymbols(state).length > 0) {
      return false;
    }
    const keys = Object.keys(state);
    const hasOnly = (allowed: ReadonlySet<string>): boolean =>
      keys.every((key) => allowed.has(key));

    if (state.status === "idle") {
      return keys.length === 1 && keys[0] === "status";
    }
    if (state.status === "success") {
      return hasOnly(SUCCESS_KEYS) &&
        (!hasOwn(state, "message") || typeof state.message === "string");
    }
    if (state.status !== "error") return false;
    if (!hasOnly(ERROR_KEYS)) {
      return false;
    }
    if (
      !hasOwn(state, "errorKind") ||
      !hasOwn(state, "fieldErrors") ||
      !hasOwn(state, "formErrors")
    ) {
      return false;
    }
    if (
      state.errorKind !== "business" &&
      state.errorKind !== "transport" &&
      state.errorKind !== "validation"
    ) {
      return false;
    }
    if (
      !Array.isArray(state.formErrors) ||
      !state.formErrors.every((message) => typeof message === "string")
    ) {
      return false;
    }
    if (
      typeof state.fieldErrors !== "object" ||
      state.fieldErrors === null ||
      Array.isArray(state.fieldErrors)
    ) {
      return false;
    }
    return Object.values(state.fieldErrors).every(
      (messages) =>
        Array.isArray(messages) &&
        messages.every((message) => typeof message === "string"),
    );
  } catch {
    return false;
  }
}
