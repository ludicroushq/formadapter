export type ErrorMessages = readonly string[] | string;

export interface FormAdapterServerErrorOptions {
  readonly cause?: unknown;
  readonly fieldErrors?: Readonly<Record<string, ErrorMessages>>;
  readonly formErrors?: ErrorMessages;
  readonly message?: string;
}

export interface ErrorHelperOptions {
  readonly cause?: unknown;
  readonly message?: string;
}

function messages(value: ErrorMessages | undefined): readonly string[] {
  if (value === undefined) return [];
  return typeof value === "string" ? [value] : [...value];
}

function normalizedFieldErrors(
  errors: Readonly<Record<string, ErrorMessages>> | undefined,
): Readonly<Record<string, readonly string[]>> {
  if (!errors) return {};
  return Object.fromEntries(
    Object.entries(errors).map(([path, value]) => [path, messages(value)]),
  );
}

/** A deliberate, user-safe business failure raised by a submission handler. */
export class FormAdapterServerError extends Error {
  public override readonly name = "FormAdapterServerError";
  public readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  public readonly formErrors: readonly string[];

  public constructor(options: FormAdapterServerErrorOptions = {}) {
    const fieldErrors = normalizedFieldErrors(options.fieldErrors);
    const formErrors = messages(options.formErrors);
    const firstFieldMessage = Object.values(fieldErrors)[0]?.[0];
    const message =
      options.message ??
      formErrors[0] ??
      firstFieldMessage ??
      "Submission failed";
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.fieldErrors = fieldErrors;
    this.formErrors = formErrors;
  }
}

/** Creates a business error intended to be thrown from a submission handler. */
export function formError(
  errorMessages: ErrorMessages,
  options: ErrorHelperOptions = {},
): FormAdapterServerError {
  return new FormAdapterServerError({
    ...options,
    formErrors: errorMessages,
  });
}

/** Creates a field-scoped business error intended to be thrown from a handler. */
export function fieldError(
  path: string,
  errorMessages: ErrorMessages,
  options: ErrorHelperOptions = {},
): FormAdapterServerError {
  if (!path) throw new TypeError("A field error requires a non-empty path");
  return new FormAdapterServerError({
    ...options,
    fieldErrors: { [path]: errorMessages },
  });
}
