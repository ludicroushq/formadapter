import type {
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

import type { ControlProps } from "@formadapter/react";

import {
  inputValue,
  nativeControlProps,
} from "./shared";

export function Textarea({
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
  const configured =
    nativeControlProps<TextareaHTMLAttributes<HTMLTextAreaElement>>(field);

  return (
    <textarea
      {...configured.props}
      {...inputProps}
      className={configured.className}
      disabled={disabled}
      id={id}
      maxLength={field.constraints.maxLength}
      minLength={field.constraints.minLength}
      name={name}
      onBlur={onBlur}
      onChange={(event) => {
        if (!readOnly) onValueChange(event.currentTarget.value);
      }}
      placeholder={field.config.placeholder ?? configured.props.placeholder}
      readOnly={readOnly}
      ref={controlRef}
      required={required}
      style={configured.style}
      value={inputValue(value)}
    />
  );
}
