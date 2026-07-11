import {
  issuePath,
  issuesToFieldErrors,
  submissionFailure,
} from "@formadapter/core";
import type {
  StandardIssue,
  SubmissionState,
} from "@formadapter/core";

import {
  FORM_SUBMISSION_FAILED_CODE,
  isFormSubmissionFailureData,
} from "./error-data";
import type { ORPCErrorLike } from "./types";

export const DEFAULT_ORPC_ERROR_MESSAGE =
  "Unable to submit the form. Please try again.";

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function isPathSegment(value: unknown): boolean {
  try {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "symbol"
    ) {
      return true;
    }
    return (
      isRecord(value) &&
      "key" in value &&
      (typeof value.key === "string" ||
        typeof value.key === "number" ||
        typeof value.key === "symbol")
    );
  } catch {
    return false;
  }
}

function isStandardIssue(value: unknown): value is StandardIssue {
  try {
    if (!isRecord(value) || typeof value.message !== "string") return false;
    return (
      value.path === undefined ||
      (Array.isArray(value.path) && value.path.every(isPathSegment))
    );
  } catch {
    return false;
  }
}

export function isORPCErrorLike(value: unknown): value is ORPCErrorLike {
  try {
    return (
      isRecord(value) &&
      typeof value.code === "string" &&
      typeof value.message === "string" &&
      typeof value.status === "number" &&
      Number.isFinite(value.status)
    );
  } catch {
    return false;
  }
}

function validationFailure(
  issues: readonly StandardIssue[],
  fallbackMessage: string,
): SubmissionState {
  const fieldIssues = issues.filter((issue) => issuePath(issue).length > 0);
  const formErrors = issues
    .filter((issue) => issuePath(issue).length === 0)
    .map((issue) => issue.message);

  return submissionFailure({
    errorKind: "validation",
    fieldErrors: issuesToFieldErrors(fieldIssues),
    formErrors:
      fieldIssues.length === 0 && formErrors.length === 0
        ? [fallbackMessage]
        : formErrors,
  });
}

function issuesFromError(error: ORPCErrorLike): readonly StandardIssue[] | undefined {
  if (!isRecord(error.data) || !Array.isArray(error.data.issues)) {
    return undefined;
  }
  return error.data.issues.filter(isStandardIssue);
}

export function orpcErrorToSubmission(
  error: unknown,
  unknownErrorMessage: string = DEFAULT_ORPC_ERROR_MESSAGE,
): SubmissionState | undefined {
  try {
    if (!isORPCErrorLike(error)) return undefined;

    if (
      error.code === FORM_SUBMISSION_FAILED_CODE &&
      isFormSubmissionFailureData(error.data)
    ) {
      return error.data;
    }

    const issues = error.code === "BAD_REQUEST"
      ? issuesFromError(error)
      : undefined;
    if (issues) {
      return validationFailure(issues, error.message || unknownErrorMessage);
    }

    if (
      error.status >= 400 &&
      error.status < 500 &&
      error.message.trim().length > 0
    ) {
      return submissionFailure({
        errorKind: "business",
        formErrors: [error.message],
      });
    }

    return submissionFailure({
      errorKind: "transport",
      formErrors: [unknownErrorMessage],
    });
  } catch {
    return undefined;
  }
}

export function unknownErrorToSubmission(
  error: unknown,
  unknownErrorMessage: string = DEFAULT_ORPC_ERROR_MESSAGE,
): SubmissionState {
  return (
    orpcErrorToSubmission(error, unknownErrorMessage) ??
    submissionFailure({
      errorKind: "transport",
      formErrors: [unknownErrorMessage],
    })
  );
}
