import type {
  CSSProperties,
  HTMLInputTypeAttribute,
} from "react";

import type {
  FormOption,
  ScalarField,
} from "@formadapter/core";
import {
  optionForSerializedValue,
  serializeOptionValue,
} from "@formadapter/core";

type NativeScalarField = ScalarField<string, unknown>;

const RESERVED_CONTROL_PROPS = new Set([
  "aria-describedby",
  "aria-invalid",
  "aria-label",
  "checked",
  "children",
  "className",
  "constructor",
  "controlRef",
  "dangerouslySetInnerHTML",
  "defaultChecked",
  "defaultValue",
  "disabled",
  "id",
  "key",
  "multiple",
  "name",
  "onBlur",
  "onChange",
  "onInput",
  "__proto__",
  "prototype",
  "readOnly",
  "ref",
  "required",
  "style",
  "type",
  "value",
]);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface NativeControlProps<TProps extends object> {
  readonly className?: string | undefined;
  readonly props: TProps;
  readonly style?: CSSProperties | undefined;
}

/** Keeps runtime-owned form props authoritative while allowing native options. */
export function nativeControlProps<TProps extends object>(
  field: NativeScalarField,
): NativeControlProps<TProps> {
  const configured = field.config.controlProps;
  if (!isRecord(configured)) return { props: {} as TProps };

  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(configured)) {
    if (!RESERVED_CONTROL_PROPS.has(key) && value !== undefined) {
      props[key] = value;
    }
  }

  return {
    ...(typeof configured.className === "string"
      ? { className: configured.className }
      : {}),
    props: props as TProps,
    ...(isRecord(configured.style)
      ? { style: configured.style as CSSProperties }
      : {}),
  };
}

export function inputType(field: NativeScalarField): HTMLInputTypeAttribute {
  if (field.inputType) return field.inputType;

  switch (field.control) {
    case "date":
    case "datetime-local":
    case "email":
    case "hidden":
    case "number":
    case "password":
    case "range":
    case "search":
    case "tel":
    case "text":
    case "time":
    case "url":
      return field.control;
  }

  if (field.dataType === "number" || field.dataType === "integer") {
    return "number";
  }

  switch (field.constraints.format) {
    case "date":
      return "date";
    case "date-time":
      return "text";
    case "email":
      return "email";
    case "password":
      return "password";
    case "tel":
      return "tel";
    case "time":
      return "time";
    case "uri":
    case "url":
      return "url";
    default:
      return "text";
  }
}

function formatDate(value: Date, type: HTMLInputTypeAttribute): string {
  const pad = (part: number): string => String(part).padStart(2, "0");
  const date = `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  const time = `${pad(value.getHours())}:${pad(value.getMinutes())}`;
  if (type === "date") return date;
  if (type === "datetime-local") return `${date}T${time}`;
  if (type === "time") return time;
  return value.toISOString();
}

export function inputValue(
  value: unknown,
  type: HTMLInputTypeAttribute = "text",
): string | number {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number") return value;
  if (value instanceof Date) return formatDate(value, type);
  return String(value);
}

export function changedInputValue(
  field: NativeScalarField,
  rawValue: string,
  valueAsNumber: number,
): unknown {
  if (rawValue === "") return "";
  if (field.dataType === "number" || field.dataType === "integer") {
    return Number.isNaN(valueAsNumber) ? rawValue : valueAsNumber;
  }
  return rawValue;
}

export function serializedOptionValue(value: FormOption["value"]): string {
  return serializeOptionValue(value);
}

export function optionForValue(
  options: readonly FormOption[],
  rawValue: string,
): FormOption | undefined {
  return optionForSerializedValue(options, rawValue);
}

export function selectedOptionValue(
  options: readonly FormOption[],
  value: unknown,
): string {
  const selected = options.find((option) => Object.is(option.value, value));
  return selected ? serializedOptionValue(selected.value) : "";
}
