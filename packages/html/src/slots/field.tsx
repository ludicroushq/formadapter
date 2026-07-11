import type { ReactNode } from "react";

import type { FieldSlotProps } from "@formadapter/react";

interface FieldLabelProps {
  readonly label: string;
  readonly required: boolean;
}

function FieldLabel({ label, required }: FieldLabelProps): ReactNode {
  return (
    <span>
      {label}
      {required ? <span aria-hidden="true"> *</span> : null}
    </span>
  );
}

export function Field({
  children,
  controlId,
  descriptionId,
  error,
  errorId,
  field,
  invalid,
  required,
  validating,
  ...props
}: FieldSlotProps): ReactNode {
  if (field.control === "hidden" || field.inputType === "hidden") {
    return children;
  }

  const label = <FieldLabel label={field.label} required={required} />;

  return (
    <div
      {...props}
      data-field-path={field.path}
      data-invalid={invalid || undefined}
      data-validating={validating || undefined}
    >
      {field.control === "checkbox" ? (
        <label htmlFor={controlId}>
          {children}
          {label}
        </label>
      ) : (
        <>
          {field.control === "radio" ? (
            <div>{label}</div>
          ) : (
            <label htmlFor={controlId}>{label}</label>
          )}
          {children}
        </>
      )}
      {field.description ? (
        <p id={descriptionId}>{field.description}</p>
      ) : null}
      {validating ? <output aria-live="polite">Checking…</output> : null}
      {error ? <p id={errorId} role="alert">{error}</p> : null}
    </div>
  );
}
