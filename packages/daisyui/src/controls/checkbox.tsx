import type {
  InputHTMLAttributes,
  ReactNode,
} from "react";

import type { ControlProps } from "@formadapter/react";

import { classNames } from "../class-names";
import { useDaisyUIClassNames } from "../prefix";
import { nativeControlProps } from "@formadapter/html/native";

function requiresCheckedValue(field: ControlProps["field"]): boolean {
  return typeof field.source === "object" &&
    field.source !== null &&
    field.source.const === true;
}

export function Checkbox({
  controlRef,
  disabled,
  field,
  id,
  inputProps,
  invalid,
  name,
  onBlur,
  onValueChange,
  readOnly,
  required,
  value,
}: ControlProps): ReactNode {
  const configured = nativeControlProps<InputHTMLAttributes<HTMLInputElement>>(
    field,
  );
  const daisyClassName = useDaisyUIClassNames(
    "checkbox",
    invalid && "checkbox-error",
  );

  return (
    <input
      {...configured.props}
      {...inputProps}
      aria-readonly={readOnly || undefined}
      checked={value === true}
      className={classNames(
        daisyClassName,
        configured.className,
      )}
      disabled={disabled || readOnly}
      id={id}
      name={name}
      onBlur={onBlur}
      onChange={(event) => {
        if (!readOnly) onValueChange(event.currentTarget.checked);
      }}
      readOnly={readOnly}
      ref={controlRef}
      required={required && requiresCheckedValue(field)}
      style={configured.style}
      type="checkbox"
      value="true"
    />
  );
}
