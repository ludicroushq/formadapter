"use client";

import { useId, type ReactNode } from "react";
import { useFormContext, useFormState } from "react-hook-form";

import type { ObjectField } from "@formadapter/core";

import { useFormRuntime, type RuntimeValues } from "./form-context";
import { NodeRenderer } from "./node-renderer";
import { ownHookFormErrorMessage } from "./resolver";
import {
  resolvePresentation,
  resolveRequired,
  valueAtPath,
} from "./runtime-utils";

export interface ObjectFieldRendererProps {
  readonly field: ObjectField<string, unknown>;
  readonly path: string;
  readonly className?: string | undefined;
  readonly inheritedDisabled?: boolean | undefined;
  readonly inheritedReadOnly?: boolean | undefined;
  readonly unregisterOnUnmount?: boolean | undefined;
}

export function ObjectFieldRenderer({
  field,
  path,
  className,
  inheritedDisabled = false,
  inheritedReadOnly = false,
  unregisterOnUnmount = false,
}: ObjectFieldRendererProps): ReactNode {
  const generatedId = useId();
  const { adapter, disabled: formDisabled, values } = useFormRuntime();
  const { control } = useFormContext<RuntimeValues>();
  const { errors } = useFormState({ control, exact: false, name: path });
  const presentation = resolvePresentation(
    field,
    values,
    formDisabled || inheritedDisabled,
  );
  const readOnly = inheritedReadOnly || presentation.readOnly;
  const error = ownHookFormErrorMessage(valueAtPath(errors, path));
  const errorId = error
    ? `formadapter-${generatedId.replaceAll(":", "")}-error`
    : undefined;

  if (presentation.hidden) return null;

  const Group = adapter.slots.Group;
  return (
    <Group
      className={className ?? field.config.className}
      disabled={presentation.disabled}
      error={error}
      errorId={errorId}
      field={field}
      readOnly={readOnly}
      required={resolveRequired(field, values)}
    >
      {field.children.map((child) => (
        <NodeRenderer
          field={child}
          inheritedDisabled={presentation.disabled}
          inheritedReadOnly={readOnly}
          key={child.path}
          path={path ? `${path}.${child.key}` : child.key}
          unregisterOnUnmount={unregisterOnUnmount}
        />
      ))}
    </Group>
  );
}
