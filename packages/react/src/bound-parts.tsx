"use client";

import { Fragment, type ReactNode } from "react";
import { useFormContext } from "react-hook-form";

import type { FormNode } from "@formadapter/core";

import { useFormRuntime, type RuntimeValues } from "./form-context";
import { NodeRenderer } from "./node-renderer";
import type { BoundSubmitProps } from "./types";

function findField(
  fieldMap: Readonly<Record<string, FormNode<string, unknown>>>,
  path: string,
): FormNode<string, unknown> | undefined {
  return Object.prototype.hasOwnProperty.call(fieldMap, path)
    ? fieldMap[path]
    : undefined;
}

export interface RuntimeFieldProps {
  readonly name: string;
  readonly className?: string | undefined;
  readonly options?: unknown;
}

export function RuntimeField({ name, className, options }: RuntimeFieldProps): ReactNode {
  const { adapter, model } = useFormRuntime();
  const field = findField(model.fieldMap, name);

  if (!field) {
    const Unsupported = adapter.slots.Unsupported;
    return (
      <Unsupported
        field={model.root}
        reason={`No generated field exists at “${name}”.`}
      />
    );
  }

  if (name.includes("[]")) {
    const Unsupported = adapter.slots.Unsupported;
    return (
      <Unsupported
        field={field}
        reason={`Array item path “${name}” needs an item index and is rendered by its parent array.`}
      />
    );
  }

  const runtimeField = options === undefined
    ? field
    : {
        ...field,
        ...(field.kind === "scalar" && field.config.control === undefined
          ? { control: "select" as const }
          : {}),
        config: {
          ...field.config,
          options: options as NonNullable<FormNode<string, unknown>["config"]["options"]>,
        },
      } as FormNode<string, unknown>;
  return (
    <NodeRenderer
      className={className}
      field={runtimeField}
      path={name}
      unregisterOnUnmount
    />
  );
}

export interface RuntimeFieldsProps {
  readonly names?: readonly string[] | undefined;
  readonly className?: string | undefined;
}

export function RuntimeFields({ names, className }: RuntimeFieldsProps): ReactNode {
  const { adapter, model } = useFormRuntime();
  if (model.root.kind !== "object") {
    const Unsupported = adapter.slots.Unsupported;
    return (
      <Unsupported
        field={model.root}
        reason="Automatic form layout requires an object schema at the root."
      />
    );
  }

  const resolvedNames = names ?? model.root.children.map((field) => field.path);
  const fields = resolvedNames.map((name) => <RuntimeField key={name} name={name} />);

  if (!className) return <>{fields}</>;
  return <div className={className}>{fields}</div>;
}

export function RuntimeSubmit({ children }: BoundSubmitProps): ReactNode {
  const { adapter, disabled, pending, submitLabel } = useFormRuntime();
  const { formState } = useFormContext<RuntimeValues>();
  const Button = adapter.slots.Button;

  return (
    <Button
      disabled={disabled || pending || formState.isValidating}
      intent="submit"
      pending={pending || formState.isValidating}
      type="submit"
    >
      {children ?? submitLabel}
    </Button>
  );
}

export function RuntimeAutoLayout(): ReactNode {
  return (
    <Fragment>
      <RuntimeFields />
      <RuntimeSubmit />
    </Fragment>
  );
}
