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
} from "@formadapter/html/native";

import { classNames } from "../class-names";
import { useDaisyUIClassNames } from "../prefix";
import { mergeControlStyle } from "./control-style";

export function Input({
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
  const type = inputType(field);
  const baseClassName =
    type === "hidden" ? undefined : type === "range" ? "range" : "input";
  const invalidClassName =
    type === "range"
      ? "range-error"
      : type === "hidden"
        ? undefined
        : "input-error";
  const daisyClassName = useDaisyUIClassNames(
    baseClassName,
    invalid && invalidClassName,
  );

  return (
    <input
      {...configured.props}
      {...inputProps}
      className={classNames(
        daisyClassName,
        configured.className,
      )}
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
      style={mergeControlStyle(configured.style)}
      type={type}
      value={inputValue(value, type)}
    />
  );
}
