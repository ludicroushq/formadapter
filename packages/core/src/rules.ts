import type { DeepPartial } from "./path";
import { ownValue } from "./record";
import type { StandardIssue } from "./standard";
import type {
  FieldState,
  FormModel,
  FormNode,
} from "./types";

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function resolveFieldState<Values>(
  state: FieldState<Values> | undefined,
  values: Readonly<DeepPartial<Values>>,
  fallback = false,
): boolean {
  if (typeof state === "function") return Boolean(state(values));
  return typeof state === "boolean" ? state : fallback;
}

export function isEmptyFieldValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (isRecord(value)) return Object.values(value).every(isEmptyFieldValue);
  return false;
}

function visitRequiredRules(
  node: FormNode<string, unknown>,
  value: unknown,
  values: Readonly<Record<string, unknown>>,
  path: readonly (number | string)[],
  inheritedHidden: boolean,
  issues: StandardIssue[],
): void {
  const hidden =
    inheritedHidden || resolveFieldState(node.config.hidden, values, false);
  const required = resolveFieldState(
    node.config.requiredWhenVisible,
    values,
    false,
  );

  if (!hidden && required && isEmptyFieldValue(value)) {
    issues.push({
      message: node.config.requiredMessage ?? `${node.label} is required`,
      path,
    });
  }

  if (node.kind === "object") {
    const record = isRecord(value) ? value : {};
    for (const child of node.children) {
      visitRequiredRules(
        child as FormNode<string, unknown>,
        ownValue(record, child.key),
        values,
        [...path, child.key],
        hidden,
        issues,
      );
    }
  } else if (node.kind === "array" && Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      visitRequiredRules(
        node.item as FormNode<string, unknown>,
        item,
        values,
        [...path, index],
        hidden,
        issues,
      );
    }
  }
}

/** Validates portable presentation rules that are intentionally outside the schema. */
export function validatePresentationRules<Input, Control extends string>(
  model: FormModel<Input, Control>,
  values: Readonly<DeepPartial<Input>>,
): readonly StandardIssue[] {
  const issues: StandardIssue[] = [];
  const record = isRecord(values) ? values : {};
  visitRequiredRules(
    model.root as FormNode<string, unknown>,
    values,
    record,
    [],
    false,
    issues,
  );
  return issues;
}
