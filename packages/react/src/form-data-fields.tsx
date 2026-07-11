"use client";

import type { ReactNode } from "react";

import {
  pathToConfigPath,
  serializeOptionValue,
  type FormModel,
  type FormNode,
  type JsonPrimitive,
  type ScalarField,
} from "@formadapter/core";

import type { RuntimeValues } from "./form-context";
import { resolveFieldOptions } from "./runtime-utils";

export const ARRAY_MARKER = "__formadapter_array";
export const BOOLEAN_MARKER = "__formadapter_boolean";
export const VALUE_MARKER = "__formadapter_value";

function isJsonPrimitive(value: unknown): value is JsonPrimitive {
  return value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean";
}

function concretePath(name: string): readonly (number | string)[] | undefined {
  if (!name || name.startsWith("$ACTION_")) return undefined;
  const parts = name.split(".");
  if (parts.some((part) => part === "")) return undefined;
  return parts.map((part) => /^(?:0|[1-9]\d*)$/.test(part) ? Number(part) : part);
}

function clearModelEntries(
  formData: FormData,
  model: FormModel<unknown, string>,
): void {
  formData.delete(ARRAY_MARKER);
  formData.delete(BOOLEAN_MARKER);
  formData.delete(VALUE_MARKER);
  for (const name of new Set(formData.keys())) {
    const path = concretePath(name);
    if (
      path &&
      Object.prototype.hasOwnProperty.call(
        model.fieldMap,
        pathToConfigPath(path),
      )
    ) {
      formData.delete(name);
    }
  }
}

function appendBlob(formData: FormData, path: string, value: Blob): void {
  if (typeof File !== "undefined" && value instanceof File) {
    if (value.name || value.size > 0) formData.append(path, value, value.name);
    return;
  }
  formData.append(path, value);
}

function appendScalar(
  formData: FormData,
  field: ScalarField<string, unknown>,
  path: string,
  value: unknown,
): void {
  if (value === undefined) return;

  if (typeof FileList !== "undefined" && value instanceof FileList) {
    for (const file of value) appendBlob(formData, path, file);
    return;
  }
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    appendBlob(formData, path, value);
    return;
  }
  formData.append(VALUE_MARKER, path);
  if (field.dataType === "boolean") formData.append(BOOLEAN_MARKER, path);
  const primitive = value instanceof Date ? value.toISOString() : value;
  if (isJsonPrimitive(primitive)) {
    formData.append(path, serializeOptionValue(primitive));
  }
}

function appendNode(
  formData: FormData,
  field: FormNode<string, unknown>,
  path: string,
  value: unknown,
): void {
  if (field.kind === "scalar") {
    appendScalar(formData, field, path, value);
    return;
  }
  if (field.kind === "array") {
    if (!Array.isArray(value)) return;
    formData.append(ARRAY_MARKER, path);
    for (const [index, item] of value.entries()) {
      appendNode(formData, field.item, `${path}.${index}`, item);
    }
    return;
  }
  if (field.kind !== "object" || typeof value !== "object" || value === null) {
    return;
  }
  const record = value as Readonly<Record<string, unknown>>;
  for (const child of field.children) {
    appendNode(
      formData,
      child,
      path ? `${path}.${child.key}` : child.key,
      record[child.key],
    );
  }
}

/**
 * Rebuilds model-owned entries from React Hook Form's prepared input while
 * preserving unrelated submitter/framework fields from the browser payload.
 */
export function buildFormData(
  model: FormModel<unknown, string>,
  values: unknown,
  browserFormData: FormData,
): FormData {
  clearModelEntries(browserFormData, model);
  appendNode(browserFormData, model.root, "", values);
  return browserFormData;
}

function hiddenScalarValue(
  field: ScalarField<string, unknown>,
  value: unknown,
  values: RuntimeValues,
): string | undefined {
  if (value === undefined || field.dataType === "file") return undefined;
  const option = resolveFieldOptions(field, values)?.find((candidate) =>
    Object.is(candidate.value, value)
  );
  if (option) return serializeOptionValue(option.value);
  if (value === null) return "";
  if (value === false && field.dataType === "boolean") return undefined;
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" || typeof value === "number" || value === true
    ? String(value)
    : undefined;
}

export interface TypedValueFieldProps {
  readonly path: string;
}

/** Marks an option control whose native value uses the canonical typed codec. */
export function TypedValueField({ path }: TypedValueFieldProps): ReactNode {
  return <input name={VALUE_MARKER} type="hidden" value={path} />;
}

export interface HiddenNodeFieldsProps {
  readonly field: ScalarField<string, unknown>;
  readonly path: string;
  readonly value: unknown;
  readonly values: RuntimeValues;
}

export function HiddenNodeFields({
  field,
  path,
  value,
  values,
}: HiddenNodeFieldsProps): ReactNode {
  const serialized = hiddenScalarValue(field, value, values);
  return (
    <>
      {field.dataType === "boolean" && (field.required || value !== undefined) ? (
        <input name={BOOLEAN_MARKER} type="hidden" value={path} />
      ) : null}
      {serialized !== undefined ? (
        <input name={path} type="hidden" value={serialized} />
      ) : null}
    </>
  );
}
