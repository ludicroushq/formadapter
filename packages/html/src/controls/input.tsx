import type {
  InputHTMLAttributes,
  ReactNode,
} from "react";

import type { ControlProps } from "@formadapter/react";

import {
  changedInputValue,
  inputType,
  inputValue,
  nativeControlProps,
} from "./shared";

export function Input({
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
  const type = inputType(field);

  return (
    <input
      {...configured.props}
      {...inputProps}
      className={configured.className}
      disabled={disabled || (readOnly && type === "range")}
      id={id}
      max={field.constraints.maximum}
      maxLength={field.constraints.maxLength}
      min={field.constraints.minimum}
      minLength={field.constraints.minLength}
      name={name}
      onBlur={onBlur}
      onChange={(event) => {
        if (readOnly) return;
        onValueChange(
          changedInputValue(
            field,
            event.currentTarget.value,
            event.currentTarget.valueAsNumber,
          ),
        );
      }}
      pattern={field.constraints.pattern}
      placeholder={field.config.placeholder ?? configured.props.placeholder}
      readOnly={readOnly}
      ref={controlRef}
      required={required}
      step={
        field.constraints.multipleOf ??
        (field.dataType === "integer"
          ? 1
          : field.dataType === "number"
            ? "any"
            : undefined)
      }
      style={configured.style}
      type={type}
      value={inputValue(value, type)}
    />
  );
}
