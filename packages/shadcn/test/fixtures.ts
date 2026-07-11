import type {
  ArrayField,
  ObjectField,
  ResolvedFieldConfig,
  ScalarConstraints,
  ScalarField,
  UnsupportedField,
} from "@formadapter/core";
import type { ControlProps } from "@formadapter/react";
import { vi } from "vitest";

export type TestScalarOverrides = Partial<
  Omit<ScalarField, "config" | "constraints">
> & {
  readonly config?: Partial<ResolvedFieldConfig>;
  readonly constraints?: Partial<ScalarConstraints>;
};

export function scalar(
  overrides: TestScalarOverrides = {},
): ScalarField {
  const baseConfig: ResolvedFieldConfig = {
    asyncValidationDebounceMs: 250,
    disabled: false,
    extensions: {},
    hidden: false,
    multiple: false,
    readOnly: false,
    requiredWhenVisible: false,
  };
  const baseConstraints: ScalarConstraints = {
    multiple: false,
  };

  return {
    config: { ...baseConfig, ...overrides.config },
    constraints: { ...baseConstraints, ...overrides.constraints },
    control: "text",
    dataType: "string",
    key: "name",
    kind: "scalar",
    label: "Name",
    nullable: false,
    path: "name",
    required: true,
    source: { type: "string" },
    ...overrides,
  } as ScalarField;
}

export function controlProps(
  field: ScalarField,
  overrides: Partial<ControlProps> = {},
): ControlProps {
  return {
    controlRef: vi.fn<ControlProps["controlRef"]>(),
    disabled: false,
    field,
    id: `control-${field.key}`,
    inputProps: {},
    invalid: false,
    name: field.path,
    onBlur: vi.fn<() => void>(),
    onValueChange: vi.fn<(value: unknown) => void>(),
    readOnly: false,
    required: field.required,
    validating: false,
    value: field.defaultValue,
    ...overrides,
  };
}

export function objectField(): ObjectField {
  return {
    children: [scalar()],
    config: {
      asyncValidationDebounceMs: 250,
      disabled: false,
      extensions: {},
      hidden: false,
      multiple: false,
      readOnly: false,
      requiredWhenVisible: false,
    },
    description: "Tell us who you are.",
    key: "profile",
    kind: "object",
    label: "Profile",
    nullable: false,
    path: "profile",
    required: true,
    source: { type: "object" },
  };
}

export function arrayField(): ArrayField {
  return {
    config: {
      asyncValidationDebounceMs: 250,
      disabled: false,
      extensions: {},
      hidden: false,
      multiple: false,
      readOnly: false,
      requiredWhenVisible: false,
    },
    description: "Add at least one teammate.",
    item: scalar(),
    key: "teammates",
    kind: "array",
    label: "Teammates",
    maxItems: 4,
    minItems: 1,
    nullable: false,
    path: "teammates",
    required: true,
    source: { type: "array" },
    uniqueItems: false,
  };
}

export function unsupportedField(): UnsupportedField {
  return {
    config: {
      asyncValidationDebounceMs: 250,
      disabled: false,
      extensions: {},
      hidden: false,
      multiple: false,
      readOnly: false,
      requiredWhenVisible: false,
    },
    key: "metadata",
    kind: "unsupported",
    label: "Metadata",
    nullable: false,
    path: "metadata",
    reason: "Records need a custom control.",
    required: false,
    source: {},
  };
}
