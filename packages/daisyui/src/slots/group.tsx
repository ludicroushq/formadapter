import { useId, type ReactNode } from "react";

import type { GroupSlotProps } from "@formadapter/react";

import { classNames } from "../class-names";
import { useDaisyUIClassNames } from "../prefix";

export function Group({
  children,
  className,
  disabled,
  error,
  errorId,
  field,
  readOnly,
  required,
  style,
  ...props
}: GroupSlotProps): ReactNode {
  const descriptionId = useId();
  const fieldsetClassName = useDaisyUIClassNames("fieldset rounded-box");
  const legendClassName = useDaisyUIClassNames("fieldset-legend");
  const labelClassName = useDaisyUIClassNames("label");
  const surfaceClassName = useDaisyUIClassNames("bg-base-200 border-base-300");
  const errorClassName = useDaisyUIClassNames("text-error");
  const describedBy = [
    props["aria-describedby"],
    field.description ? descriptionId : undefined,
    error ? errorId : undefined,
  ].filter(Boolean).join(" ") || undefined;

  return (
    <fieldset
      {...props}
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
      className={classNames(
        fieldsetClassName,
        surfaceClassName,
        "border p-4",
        className,
      )}
      data-readonly={readOnly || undefined}
      data-invalid={error ? true : undefined}
      data-field-path={field.path}
      aria-disabled={disabled || undefined}
      style={{ width: "100%", ...style }}
    >
      <legend className={legendClassName}>
        {field.label}
        {required ? (
          <span aria-hidden="true" className={errorClassName}>
            {" "}*
          </span>
        ) : null}
      </legend>
      {field.description ? (
        <p className={labelClassName} id={descriptionId}>{field.description}</p>
      ) : null}
      {children}
      {error ? (
        <p
          className={classNames(labelClassName, errorClassName)}
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
