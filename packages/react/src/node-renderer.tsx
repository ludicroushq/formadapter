"use client";

import type { ReactNode } from "react";

import type { FormNode } from "@formadapter/core";

import { ArrayFieldRenderer } from "./array-field";
import { useFormRuntime } from "./form-context";
import { ObjectFieldRenderer } from "./object-field";
import { ScalarFieldRenderer } from "./scalar-field";

export interface NodeRendererProps {
  readonly field: FormNode<string, unknown>;
  readonly path: string;
  readonly className?: string | undefined;
  readonly inheritedDisabled?: boolean | undefined;
  readonly inheritedReadOnly?: boolean | undefined;
  readonly unregisterOnUnmount?: boolean | undefined;
}

export function NodeRenderer({
  field,
  path,
  className,
  inheritedDisabled = false,
  inheritedReadOnly = false,
  unregisterOnUnmount = false,
}: NodeRendererProps): ReactNode {
  const { adapter } = useFormRuntime();

  switch (field.kind) {
    case "scalar":
      return (
        <ScalarFieldRenderer
          className={className}
          field={field}
          inheritedDisabled={inheritedDisabled}
          inheritedReadOnly={inheritedReadOnly}
          path={path}
          unregisterOnUnmount={unregisterOnUnmount}
        />
      );
    case "object":
      return (
        <ObjectFieldRenderer
          className={className}
          field={field}
          inheritedDisabled={inheritedDisabled}
          inheritedReadOnly={inheritedReadOnly}
          path={path}
          unregisterOnUnmount={unregisterOnUnmount}
        />
      );
    case "array":
      return (
        <ArrayFieldRenderer
          className={className}
          field={field}
          inheritedDisabled={inheritedDisabled}
          inheritedReadOnly={inheritedReadOnly}
          path={path}
          unregisterOnUnmount={unregisterOnUnmount}
        />
      );
    case "unsupported": {
      const Unsupported = adapter.slots.Unsupported;
      return <Unsupported field={field} reason={field.reason} />;
    }
  }
}
