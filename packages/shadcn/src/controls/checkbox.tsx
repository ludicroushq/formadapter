import type { InputHTMLAttributes, ReactNode } from "react";

import { nativeControlProps } from "@formadapter/html/native";
import type { ControlProps } from "@formadapter/react";

import { cn } from "../cn";
import { CheckIcon } from "../icons";
import { CHECKBOX_CLASS } from "../styles";

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

  return (
    <span
      className="relative inline-grid size-4 shrink-0 place-items-center"
      data-invalid={invalid || undefined}
      data-slot="checkbox-wrapper"
    >
      <input
        {...configured.props}
        {...inputProps}
        aria-readonly={readOnly || undefined}
        checked={value === true}
        className={cn(CHECKBOX_CLASS, configured.className)}
        data-slot="checkbox"
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
      <span className="pointer-events-none absolute hidden text-primary-foreground peer-checked:grid">
        <CheckIcon />
      </span>
    </span>
  );
}
