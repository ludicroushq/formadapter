import type { ReactNode } from "react";

import type { FieldSlotProps } from "@formadapter/react";

import { cn } from "../cn";

function FieldLabel({
  label,
  required,
}: {
  readonly label: string;
  readonly required: boolean;
}): ReactNode {
  return (
    <span>
      {label}
      {required ? (
        <span aria-hidden="true" className="text-destructive">
          {" "}*
        </span>
      ) : null}
    </span>
  );
}

export function Field({
  children,
  className,
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

  const isCheckbox = field.control === "checkbox";
  const isRadio = field.control === "radio";
  const label = <FieldLabel label={field.label} required={required} />;
  const labelClassName =
    "flex w-fit items-center gap-2 text-sm leading-none font-medium select-none has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50";

  return (
    <div
      {...props}
      className={cn(
        "group/field flex w-full flex-col gap-3 data-[invalid=true]:text-destructive [&>*]:w-full [&:has(:disabled)>[data-slot=field-label]]:cursor-not-allowed [&:has(:disabled)>[data-slot=field-label]]:opacity-50",
        className,
      )}
      data-field-path={field.path}
      data-invalid={invalid || undefined}
      data-slot="field"
      data-validating={validating || undefined}
    >
      {isCheckbox ? (
        <label
          className={cn(labelClassName, "w-full")}
          data-slot="field-label"
          htmlFor={controlId}
        >
          {children}
          {label}
        </label>
      ) : (
        <>
          {isRadio ? (
            <div className={labelClassName} data-slot="field-label">
              {label}
            </div>
          ) : (
            <label
              className={labelClassName}
              data-slot="field-label"
              htmlFor={controlId}
            >
              {label}
            </label>
          )}
          {children}
        </>
      )}
      {field.description ? (
        <p
          className="text-sm leading-normal font-normal text-muted-foreground"
          data-slot="field-description"
          id={descriptionId}
        >
          {field.description}
        </p>
      ) : null}
      {validating ? (
        <output
          className="text-sm text-muted-foreground"
          data-slot="field-validating"
        >
          Checking…
        </output>
      ) : null}
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
    </div>
  );
}
