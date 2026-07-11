import type { ReactNode, TextareaHTMLAttributes } from "react";

import { inputValue, nativeControlProps } from "@formadapter/html/native";
import type { ControlProps } from "@formadapter/react";

import { cn } from "../cn";
import { TEXTAREA_CLASS } from "../styles";

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
      className={cn(TEXTAREA_CLASS, configured.className)}
      data-slot="textarea"
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
