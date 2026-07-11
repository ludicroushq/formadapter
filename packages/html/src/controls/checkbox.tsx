import type {
  InputHTMLAttributes,
  ReactNode,
} from "react";

import type { ControlProps } from "@formadapter/react";

import { nativeControlProps } from "./shared";

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

  return (
    <input
      {...configured.props}
      {...inputProps}
      aria-readonly={readOnly || undefined}
      checked={value === true}
      className={configured.className}
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
