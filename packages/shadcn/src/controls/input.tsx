import type { InputHTMLAttributes, ReactNode } from "react";

import { nativeControlProps } from "@formadapter/html/native";
import type { ControlProps } from "@formadapter/react";
import {
  changedInputValue,
  inputType,
  inputValue,
} from "@formadapter/html/native";

import { cn } from "../cn";
import { INPUT_CLASS, RANGE_CLASS } from "../styles";

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
  const baseClassName =
    type === "hidden" ? undefined : type === "range" ? RANGE_CLASS : INPUT_CLASS;

  return (
    <input
      {...configured.props}
      {...inputProps}
      className={baseClassName ? cn(baseClassName, configured.className) : configured.className}
      data-slot="input"
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
