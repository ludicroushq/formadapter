import { pathToName } from "./path";
import { createNullRecord, defineOwn, hasOwn } from "./record";
import type {
  FormSchema,
  InferOutput,
  StandardIssue,
} from "./standard";

export type ValidationResult<Output> =
  | { readonly success: true; readonly data: Output }
  | { readonly success: false; readonly issues: readonly StandardIssue[] };

export function issuePath(issue: StandardIssue): readonly PropertyKey[] {
  return (issue.path ?? []).map((segment) => {
    if (typeof segment !== "object" || segment === null) return segment;
    return hasOwn(segment, "key")
      ? (segment as { readonly key: PropertyKey }).key
      : String(segment);
  });
}

export function issuesToFieldErrors(
  issues: readonly StandardIssue[],
): Readonly<Record<string, readonly string[]>> {
  const errors = createNullRecord<string[]>();
  for (const issue of issues) {
    const path = pathToName(
      issuePath(issue).map((segment) =>
        typeof segment === "number" || typeof segment === "string"
          ? segment
          : String(segment),
      ),
    );
    let messages = errors[path];
    if (!messages) {
      messages = [];
      defineOwn(errors, path, messages);
    }
    messages.push(issue.message);
  }
  return errors;
}

export async function validate<Schema extends FormSchema>(
  schema: Schema,
  value: unknown,
): Promise<ValidationResult<InferOutput<Schema>>> {
  const result = await schema["~standard"].validate(value);
  if (result.issues === undefined) {
    return { success: true, data: result.value };
  }
  return {
    success: false,
    issues: result.issues.length > 0
      ? result.issues
      : [{ message: "Schema validation failed" }],
  };
}
