import { resolveFieldState } from "./rules";
import { defineOwn, ownValue } from "./record";
import type {
  FormModel,
  FormNode,
} from "./types";

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function prepareNodeValue(
  field: FormNode<string, unknown>,
  value: unknown,
  rootValues: Readonly<Record<string, unknown>>,
): unknown {
  const hidden = field.path !== "" &&
    resolveFieldState(field.config.hidden, rootValues, false);
  if (hidden) return undefined;

  if (field.kind === "scalar") {
    if (value !== "") return value;
    if (field.nullable) return null;
    if (!field.required) return undefined;
    if (field.dataType === "number" || field.dataType === "integer") {
      return undefined;
    }
    return "";
  }

  if (field.kind === "array") {
    return Array.isArray(value)
      ? value.map((item) =>
          prepareNodeValue(field.item, item, rootValues)
        )
      : value;
  }

  if (field.kind === "object") {
    const source = isRecord(value) ? value : {};
    const prepared: Record<string, unknown> = {};
    for (const child of field.children) {
      const next = prepareNodeValue(
        child as FormNode<string, unknown>,
        ownValue(source, child.key),
        rootValues,
      );
      if (next !== undefined) defineOwn(prepared, child.key, next);
    }
    if (!field.required && Object.keys(prepared).length === 0) return undefined;
    return prepared;
  }

  return value;
}

/**
 * Converts browser form values to schema input: optional blanks become absent,
 * nullable blanks become null, and presentation-hidden branches are pruned.
 */
export function prepareFormValues<Input, Control extends string>(
  model: FormModel<Input, Control>,
  values: unknown,
): unknown {
  const rootValues = isRecord(values) ? values : {};
  return prepareNodeValue(
    model.root as FormNode<string, unknown>,
    values,
    rootValues,
  );
}
