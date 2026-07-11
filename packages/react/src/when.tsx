"use client";

import type { ReactNode } from "react";

import { useFormRuntime } from "./form-context";
import { valueAtPath } from "./runtime-utils";

export interface RuntimeWhenProps<Values> {
  readonly children?: ReactNode;
  readonly equals?: unknown;
  readonly fallback?: ReactNode;
  readonly field?: string;
  readonly matches?: ((values: Values) => boolean);
}

export function isWhenVisible<Values>(
  props: RuntimeWhenProps<Values>,
  values: Values,
): boolean {
  return props.matches
    ? props.matches(values)
    : props.field !== undefined &&
      Object.is(valueAtPath(values, props.field), props.equals);
}

export function RuntimeWhen<Values>(props: RuntimeWhenProps<Values>): ReactNode {
  const { values } = useFormRuntime();
  const visible = isWhenVisible(props, values as Values);
  return visible ? props.children : props.fallback;
}
