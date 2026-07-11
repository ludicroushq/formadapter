"use client";

import {
  createContext,
  useContext,
  type Context,
} from "react";

import type { FormModel } from "@formadapter/core";
import type { SubmissionState } from "@formadapter/core";

import type { AnyFormAdapter } from "./adapter";
import type { DraftStatus } from "./use-draft";

export type RuntimeValues = Record<string, unknown>;
export type RuntimeValidator = (values: RuntimeValues) => string | undefined;

export interface FormRuntimeContextValue {
  readonly adapter: AnyFormAdapter;
  readonly disabled: boolean;
  readonly draftStatus: DraftStatus;
  readonly model: FormModel<unknown, string>;
  readonly pending: boolean;
  readonly submission: SubmissionState;
  readonly submitLabel: string;
  readonly values: RuntimeValues;
  readonly clearDraft: () => Promise<void>;
  readonly focusError: (path: string) => void;
  readonly registerErrorFocus: (
    handler: (path: string) => void,
  ) => () => void;
  readonly registerRuntimeValidator: (
    path: string,
    validator: RuntimeValidator,
  ) => () => void;
}

export const FormRuntimeContext: Context<FormRuntimeContextValue | undefined> =
  createContext<FormRuntimeContextValue | undefined>(undefined);

export function useFormRuntime(): FormRuntimeContextValue {
  const value = useContext(FormRuntimeContext);
  if (!value) {
    throw new Error(
      "FormAdapter components must be rendered inside their bound Form component.",
    );
  }
  return value;
}
