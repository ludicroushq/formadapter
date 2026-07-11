import { submissionFailure } from "@formadapter/core";
import { os } from "@orpc/server";
import { expectTypeOf } from "vitest";

import { FORM_SUBMISSION_ERROR_MAP } from "../src";

const formProcedure = os.errors(FORM_SUBMISSION_ERROR_MAP);

export const actualFormProcedure = formProcedure.handler(({ errors }) => {
  // @ts-expect-error the compatibility type must not widen every string to an error
  errors.NOT_A_DECLARED_ERROR();
  // @ts-expect-error the generated constructor must retain failed-submission data
  errors.FORM_SUBMISSION_FAILED({ data: { nope: true } });
  throw errors.FORM_SUBMISSION_FAILED({
    data: submissionFailure({
      fieldErrors: { email: ["That email is already registered."] },
    }),
  });
});

expectTypeOf(actualFormProcedure).toBeObject();
