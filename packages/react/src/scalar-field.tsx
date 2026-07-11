"use client";

import { useEffect, useId, type ReactNode } from "react";
import { useController, useFormContext } from "react-hook-form";

import type { ScalarField } from "@formadapter/core";

import type { ControlComponent } from "./adapter";
import {
  BOOLEAN_MARKER,
  HiddenNodeFields,
  TypedValueField,
} from "./form-data-fields";
import { useFormRuntime, type RuntimeValues } from "./form-context";
import {
  normalizeControlValue,
  readOnlyControlNeedsMirror,
  resolveFieldOptions,
  resolvePresentation,
  resolveRequired,
  valueAtPath,
} from "./runtime-utils";

export interface ScalarFieldRendererProps {
  readonly field: ScalarField<string, unknown>;
  readonly path: string;
  readonly className?: string | undefined;
  readonly inheritedDisabled?: boolean | undefined;
  readonly inheritedReadOnly?: boolean | undefined;
  readonly unregisterOnUnmount?: boolean | undefined;
}

function resolveControl(
  field: ScalarField<string, unknown>,
  controls: ReturnType<typeof useFormRuntime>["adapter"]["controls"],
): ControlComponent | undefined {
  switch (field.control) {
    case "textarea":
    case "select":
    case "radio":
    case "checkbox":
    case "file":
      return controls[field.control];
    case "text":
    case "email":
    case "url":
    case "tel":
    case "password":
    case "search":
    case "date":
    case "datetime-local":
    case "time":
    case "number":
    case "range":
    case "hidden":
      return controls.input;
    default:
      return Object.prototype.hasOwnProperty.call(
        controls.custom,
        field.control,
      )
        ? controls.custom[field.control]
        : undefined;
  }
}

export function ScalarFieldRenderer({
  field,
  path,
  className,
  inheritedDisabled = false,
  inheritedReadOnly = false,
  unregisterOnUnmount = false,
}: ScalarFieldRendererProps): ReactNode {
  const generatedId = useId();
  const {
    adapter,
    disabled: formDisabled,
    registerRuntimeValidator,
    values,
  } = useFormRuntime();
  const { control, formState } = useFormContext<RuntimeValues>();
  const { field: controlled, fieldState } = useController({
    control,
    name: path,
    shouldUnregister: unregisterOnUnmount,
  });
  const presentation = resolvePresentation(
    field,
    values,
    formDisabled || inheritedDisabled,
  );
  const readOnly = inheritedReadOnly || presentation.readOnly;
  const options = resolveFieldOptions(field, values);
  let runtimeField: ScalarField<string, unknown> = field;
  if (options !== field.options) {
    if (options) runtimeField = { ...field, options };
    else {
      const { options: _options, ...fieldWithoutOptions } = field;
      runtimeField = fieldWithoutOptions;
    }
  }
  const required = resolveRequired(field, values);
  const validating = Boolean(path.split(".").reduce<unknown>((current, segment) => {
    if (typeof current !== "object" || current === null) return undefined;
    return Object.prototype.hasOwnProperty.call(current, segment)
      ? (current as Readonly<Record<string, unknown>>)[segment]
      : undefined;
  }, formState.validatingFields));

  const controlId = `formadapter-${generatedId.replaceAll(":", "")}`;
  const descriptionId = field.description ? `${controlId}-description` : undefined;
  const error = fieldState.error?.message;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
  const Control = resolveControl(runtimeField, adapter.controls);
  const mirrorValue = presentation.disabled ||
    (readOnly && readOnlyControlNeedsMirror(runtimeField));

  useEffect(() => {
    const hasOptionSource = field.config.options !== undefined ||
      field.options !== undefined;
    if (!hasOptionSource) return;
    return registerRuntimeValidator(path, (currentValues) => {
      const currentPresentation = resolvePresentation(
        field,
        currentValues,
        formDisabled || inheritedDisabled,
      );
      if (currentPresentation.hidden) return undefined;
      const runtimeOptions = resolveFieldOptions(field, currentValues);
      if (runtimeOptions === undefined) return undefined;
      const currentValue = valueAtPath(currentValues, path);
      if (currentValue === undefined || currentValue === "") return undefined;
      return runtimeOptions.some((option) =>
        Object.is(option.value, currentValue)
      )
        ? undefined
        : `Choose a valid ${field.label.toLocaleLowerCase()}`;
    });
  }, [
    field,
    field.label,
    formDisabled,
    inheritedDisabled,
    path,
    registerRuntimeValidator,
  ]);

  if (presentation.hidden) return null;

  if (!Control) {
    const Unsupported = adapter.slots.Unsupported;
    return (
      <Unsupported
        field={runtimeField}
        reason={`The ${adapter.name} adapter does not provide the “${field.control}” control.`}
      />
    );
  }

  const Field = adapter.slots.Field;

  return (
    <Field
      className={className ?? field.config.className}
      controlId={controlId}
      descriptionId={descriptionId}
      error={error}
      errorId={errorId}
      field={runtimeField}
      invalid={Boolean(error)}
      required={required}
      validating={validating}
    >
      {!mirrorValue &&
      field.dataType === "boolean" &&
      (field.required || controlled.value !== undefined) ? (
        <input name={BOOLEAN_MARKER} type="hidden" value={path} />
      ) : null}
      {runtimeField.options ? (
        <TypedValueField path={path} />
      ) : null}
      <Control
        controlRef={controlled.ref}
        disabled={presentation.disabled}
        field={runtimeField}
        id={controlId}
        inputProps={{
          "aria-describedby": describedBy,
          "aria-invalid": error ? true : undefined,
        }}
        invalid={Boolean(error)}
        name={path}
        onBlur={controlled.onBlur}
        onValueChange={(value) => {
          controlled.onChange(normalizeControlValue(runtimeField, value));
        }}
        readOnly={readOnly}
        required={required}
        validating={validating}
        value={controlled.value}
      />
      {mirrorValue ? (
        <HiddenNodeFields
          field={runtimeField}
          path={path}
          value={controlled.value}
          values={values}
        />
      ) : null}
    </Field>
  );
}
