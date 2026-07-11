import { useId, type ReactNode } from "react";

import type { ArraySlotProps } from "@formadapter/react";

export function Array({
  actions,
  children,
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
      data-field-path={field.path}
      data-invalid={error ? true : undefined}
      data-item-count={itemCount}
      data-readonly={readOnly || undefined}
    >
      <legend>
        {field.label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </legend>
      {field.description ? <p id={descriptionId}>{field.description}</p> : null}
      {children}
      {actions}
      {error ? <p id={errorId} role="alert">{error}</p> : null}
    </fieldset>
  );
}
