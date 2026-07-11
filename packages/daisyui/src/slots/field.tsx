import type { ReactNode } from "react";

import type { FieldSlotProps } from "@formadapter/react";

import { classNames } from "../class-names";
import { useDaisyUIClassNames } from "../prefix";

function FieldLabel({
  label,
  required,
}: {
  readonly label: string;
  readonly required: boolean;
}): ReactNode {
  const errorClassName = useDaisyUIClassNames("text-error");
  return (
    <span>
      {label}
      {required ? (
        <span aria-hidden="true" className={errorClassName}>
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
  style,
  validating,
  ...props
}: FieldSlotProps): ReactNode {
  const fieldsetClassName = useDaisyUIClassNames("fieldset");
  const legendClassName = useDaisyUIClassNames("fieldset-legend");
  const labelClassName = useDaisyUIClassNames("label");
  const errorClassName = useDaisyUIClassNames("text-error");

  if (field.control === "hidden" || field.inputType === "hidden") {
    return children;
  }

  const isCheckbox = field.control === "checkbox";
  const isRadio = field.control === "radio";
  const label = <FieldLabel label={field.label} required={required} />;

  return (
    <div
      {...props}
      className={classNames(fieldsetClassName, className)}
      data-field-path={field.path}
      data-invalid={invalid || undefined}
      data-validating={validating || undefined}
      style={{ width: "100%", ...style }}
    >
      {isCheckbox ? (
        <label className={labelClassName} htmlFor={controlId}>
          {children}
          {label}
        </label>
      ) : (
        <>
          {isRadio ? (
            <div className={legendClassName}>{label}</div>
          ) : (
            <label className={labelClassName} htmlFor={controlId}>
              {label}
            </label>
          )}
          {children}
        </>
      )}
      {field.description ? (
        <p className={labelClassName} id={descriptionId}>
          {field.description}
        </p>
      ) : null}
      {validating ? (
        <output className={labelClassName}>Checking…</output>
      ) : null}
      {error ? (
        <p className={classNames(labelClassName, errorClassName)} id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
