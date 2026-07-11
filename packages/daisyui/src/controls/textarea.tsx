import type {
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

import type { ControlProps } from "@formadapter/react";
import {
  inputValue,
  nativeControlProps,
} from "@formadapter/html/native";

import { classNames } from "../class-names";
import { useDaisyUIClassNames } from "../prefix";
import { mergeControlStyle } from "./control-style";

export function Textarea({
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
  const configured =
    nativeControlProps<TextareaHTMLAttributes<HTMLTextAreaElement>>(field);
  const daisyClassName = useDaisyUIClassNames(
    "textarea",
    invalid && "textarea-error",
  );

  return (
    <textarea
      {...configured.props}
      {...inputProps}
      className={classNames(
        daisyClassName,
        configured.className,
      )}
      disabled={disabled}
      id={id}
      maxLength={field.constraints.maxLength}
      minLength={field.constraints.minLength}
      name={name}
      onBlur={onBlur}
      onChange={(event) => onValueChange(event.currentTarget.value)}
      placeholder={field.config.placeholder ?? configured.props.placeholder}
      readOnly={readOnly}
      ref={controlRef}
      required={required}
      style={mergeControlStyle(configured.style)}
      value={inputValue(value)}
    />
  );
}
