import { useId, type ReactNode } from "react";

import type { ArraySlotProps } from "@formadapter/react";

import { cn } from "../cn";

export function Array({
  actions,
  children,
  className,
  disabled,
  error,
  errorId,
  field,
  itemCount,
  readOnly,
  required,
  ...props
}: ArraySlotProps): ReactNode {
  const descriptionId = useId();
  const describedBy = [
    props["aria-describedby"],
    field.description ? descriptionId : undefined,
    error ? errorId : undefined,
  ].filter(Boolean).join(" ") || undefined;

  return (
    <fieldset
      {...props}
      aria-describedby={describedBy}
      aria-disabled={disabled || undefined}
      aria-invalid={error ? true : undefined}
      className={cn(
        "flex w-full flex-col gap-4 rounded-xl border bg-card p-6 text-card-foreground shadow-sm",
        className,
      )}
      data-field-path={field.path}
      data-invalid={error ? true : undefined}
      data-item-count={itemCount}
      data-readonly={readOnly || undefined}
      data-slot="field-set"
    >
      <legend
        className="px-1 text-base font-semibold"
        data-slot="field-legend"
      >
        {field.label}
        {required ? (
          <span aria-hidden="true" className="text-destructive">
            {" "}*
          </span>
        ) : null}
      </legend>
      {field.description ? (
        <p
          className="-mt-1 text-sm text-muted-foreground"
          data-slot="field-description"
          id={descriptionId}
        >
          {field.description}
        </p>
      ) : null}
      <div className="grid gap-4" data-slot="array-items">
        {children}
      </div>
      <div data-slot="array-actions">{actions}</div>
      {error ? (
        <p
          className="text-sm font-normal text-destructive"
          data-slot="field-error"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
