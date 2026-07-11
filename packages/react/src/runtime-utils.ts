import {
  defaultValueForNode as coreDefaultValueForNode,
  optionForSerializedValue,
  prepareFormValues,
  resolveFieldState,
  type DeepPartial,
  type FormOption,
  type FormModel,
  type FormNode,
  type ScalarField,
} from "@formadapter/core";

/*
 * Runtime normalization lives here, but default construction belongs to core.
 * Keeping this small wrapper preserves the internal import while ensuring add
 * actions and initial forms share exactly the same absence and cloning rules.
 */
export function defaultValueForNode(
  field: FormNode<string, unknown>,
): unknown {
  return coreDefaultValueForNode(field);
}

/*
 * These aliases keep the remainder of the module focused on runtime behavior.
 */
type RuntimeValues = Record<string, unknown>;

export function valueAtPath(values: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (typeof current !== "object" || current === null) return undefined;
    return Object.prototype.hasOwnProperty.call(current, segment)
      ? (current as Readonly<Record<string, unknown>>)[segment]
      : undefined;
  }, values);
}
/*
 * Field-level state is resolved independently from inherited group state. The
 * renderers combine the two so a child can never re-enable a disabled parent.
 */
export function resolvePresentation(
  field: FormNode<string, unknown>,
  values: RuntimeValues,
  formDisabled: boolean,
): { hidden: boolean; disabled: boolean; readOnly: boolean } {
  const config = field.config;

  return {
    hidden: resolveFieldState(config.hidden, values, false),
    disabled: formDisabled || resolveFieldState(config.disabled, values, false),
    readOnly: resolveFieldState(config.readOnly, values, false),
  };
}

export function resolveRequired(
  field: FormNode<string, unknown>,
  values: RuntimeValues,
): boolean {
  return field.required || resolveFieldState(
    field.config.requiredWhenVisible,
    values,
    false,
  );
}

export function resolveFieldOptions(
  field: ScalarField<string, unknown>,
  values: RuntimeValues,
): readonly FormOption[] | undefined {
  const configured = field.config.options;
  return typeof configured === "function"
    ? configured(values as Readonly<DeepPartial<unknown>>)
    : configured ?? field.options;
}

export function readOnlyControlNeedsMirror(
  field: ScalarField<string, unknown>,
): boolean {
  return field.control === "checkbox" ||
    field.control === "file" ||
    field.control === "radio" ||
    field.control === "range" ||
    field.control === "select";
}

export function firstFocusablePath(
  field: FormNode<string, unknown>,
  path: string,
  values?: RuntimeValues,
  inheritedDisabled = false,
  inheritedReadOnly = false,
): string | undefined {
  const presentation = values
    ? resolvePresentation(field, values, inheritedDisabled)
    : { disabled: inheritedDisabled, hidden: false, readOnly: false };
  if (presentation.hidden || presentation.disabled) return undefined;
  const readOnly = inheritedReadOnly || presentation.readOnly;
  if (field.kind === "scalar") {
    if (field.control === "hidden") return undefined;
    return readOnly && readOnlyControlNeedsMirror(field) ? undefined : path;
  }
  if (field.kind === "object") {
    for (const child of field.children) {
      const childPath = path ? `${path}.${child.key}` : child.key;
      const match = firstFocusablePath(
        child,
        childPath,
        values,
        presentation.disabled,
        readOnly,
      );
      if (match) return match;
    }
  } else if (field.kind === "array") {
    if (!values) {
      return firstFocusablePath(
        field.item,
        `${path}.0`,
        undefined,
        presentation.disabled,
        readOnly,
      );
    }
    const items = valueAtPath(values, path);
    if (!Array.isArray(items)) return undefined;
    for (const index of items.keys()) {
      const match = firstFocusablePath(
        field.item,
        `${path}.${index}`,
        values,
        presentation.disabled,
        readOnly,
      );
      if (match) return match;
    }
  }
  return undefined;
}

export function normalizeControlValue(
  field: ScalarField<string, unknown>,
  value: unknown,
): unknown {
  if (value !== "") {
    if (field.options) {
      const exact = field.options.find((candidate) =>
        Object.is(candidate.value, value)
      );
      if (exact) return exact.value;

      if (typeof value === "string") {
        const serialized = optionForSerializedValue(field.options, value);
        if (serialized) return serialized.value;

        // Keep compatibility with simple adapters that emit native option
        // strings, but only when the conversion is unambiguous.
        const matches = field.options.filter(
          (candidate) => String(candidate.value) === value,
        );
        if (matches.length === 1) return matches[0]?.value;
      }
    }

    if (
      typeof value === "string" &&
      (field.dataType === "number" || field.dataType === "integer")
    ) {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? value : parsed;
    }

    return value;
  }

  if (field.nullable) return null;
  return "";
}

export function prepareValuesForValidation(
  model: FormModel<unknown, string>,
  values: RuntimeValues,
): RuntimeValues {
  const prepared = prepareFormValues(model, values);
  return typeof prepared === "object" && prepared !== null
    ? (prepared as RuntimeValues)
    : values;
}

export function errorMessage(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || !("message" in value)) {
    return undefined;
  }
  return typeof value.message === "string" ? value.message : undefined;
}

export function mergeDefaultValues(
  base: Record<string, unknown>,
  overrides: unknown,
): Record<string, unknown> {
  if (typeof overrides !== "object" || overrides === null) return base;
  const result: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(overrides)) {
    const current = Object.prototype.hasOwnProperty.call(result, key)
      ? result[key]
      : undefined;
    let nextValue = value;
    if (
      typeof current === "object" &&
      current !== null &&
      !Array.isArray(current) &&
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      nextValue = mergeDefaultValues(
        current as Record<string, unknown>,
        value,
      );
    }
    Object.defineProperty(result, key, {
      configurable: true,
      enumerable: true,
      value: nextValue,
      writable: true,
    });
  }

  return result;
}
