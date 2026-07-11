import { isSubmissionState } from "@formadapter/core";
import type { FailedSubmission, StandardResult } from "@formadapter/core";

import type {
  FormSubmissionErrorMap,
  ORPCStandardSchema,
} from "./types";

export const FORM_SUBMISSION_FAILED_CODE = "FORM_SUBMISSION_FAILED" as const;

/** Runtime guard for error data sent through FORM_SUBMISSION_FAILED. */
export function isFormSubmissionFailureData(
  value: unknown,
): value is FailedSubmission {
  try {
    return isSubmissionState(value) && value.status === "error";
  } catch {
    return false;
  }
}

function validateFailureData(value: unknown): StandardResult<FailedSubmission> {
  return isFormSubmissionFailureData(value)
    ? { value }
    : {
        issues: [
          {
            message: "Expected a FormAdapter failed submission.",
          },
        ],
      };
}

/** Standard Schema used for a typed oRPC FORM_SUBMISSION_FAILED error. */
export const formSubmissionFailureSchema: ORPCStandardSchema<FailedSubmission> = {
  "~standard": {
    validate: validateFailureData,
    vendor: "formadapter",
    version: 1,
  },
};

/** Reusable argument for `os.errors(FORM_SUBMISSION_ERROR_MAP)`. */
export const FORM_SUBMISSION_ERROR_MAP: FormSubmissionErrorMap = {
  FORM_SUBMISSION_FAILED: {
    data: formSubmissionFailureSchema,
    message: "Form submission failed",
    status: 422,
  },
};
