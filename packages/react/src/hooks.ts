"use client";

import { useController, useFormContext } from "react-hook-form";

import type {
  DeepPartial,
  FormModel,
} from "@formadapter/core";

import { type RuntimeValues, useFormRuntime } from "./form-context";
import type { ConcreteFieldPath, ConcretePathValue } from "./paths";
import { flattenHookFormErrors } from "./resolver";

export interface FormAdapterState {
  readonly values: RuntimeValues;
  readonly errors: Readonly<Record<string, readonly string[]>>;
  readonly isDirty: boolean;
  readonly isSubmitting: boolean;
  readonly isValidating: boolean;
  readonly validatingFields: Readonly<Record<string, unknown>>;
  readonly draftStatus: ReturnType<typeof useFormRuntime>["draftStatus"];
  readonly submission: ReturnType<typeof useFormRuntime>["submission"];
  readonly clearDraft: () => Promise<void>;
  readonly reset: (values?: RuntimeValues) => void;
  readonly setValue: (name: string, value: unknown) => void;
}

/** Returns the compiled model for the nearest mounted FormAdapter form. */
export function useFormModel(): FormModel<unknown, string> {
  return useFormRuntime().model;
}

export function useFormState(): FormAdapterState {
  const runtime = useFormRuntime();
  const { values } = runtime;
  const methods = useFormContext<RuntimeValues>();

  return {
    errors: flattenHookFormErrors(methods.formState.errors),
    clearDraft: runtime.clearDraft,
    draftStatus: runtime.draftStatus,
    isDirty: methods.formState.isDirty,
    isSubmitting: runtime.pending,
    isValidating: methods.formState.isValidating,
    reset: (values) => methods.reset(values),
    setValue: (name, value) => methods.setValue(name, value, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    }),
    submission: runtime.submission,
    validatingFields: methods.formState.validatingFields as Readonly<
      Record<string, unknown>
    >,
    values,
  };
}

export type BoundFormState<Values> = Omit<
  FormAdapterState,
  "reset" | "setValue" | "values"
> & {
  readonly values: Readonly<DeepPartial<Values>>;
  readonly reset: (values?: DeepPartial<Values>) => void;
  readonly setValue: <Path extends ConcreteFieldPath<Values>>(
    name: Path,
    value: ConcretePathValue<Values, Path>,
  ) => void;
};

export interface FormAdapterFieldState<TValue = unknown> {
  readonly value: TValue;
  readonly error?: string | undefined;
  readonly invalid: boolean;
  readonly isDirty: boolean;
  readonly isTouched: boolean;
  readonly onBlur: () => void;
  readonly setValue: (value: TValue) => void;
}

export function useFormField<TValue = unknown>(
  name: string,
): FormAdapterFieldState<TValue> {
  const { control } = useFormContext<RuntimeValues>();
  const { field, fieldState } = useController({ control, name });

  return {
    error: fieldState.error?.message,
    invalid: fieldState.invalid,
    isDirty: fieldState.isDirty,
    isTouched: fieldState.isTouched,
    onBlur: field.onBlur,
    setValue: (value) => field.onChange(value),
    value: field.value as TValue,
  };
}
