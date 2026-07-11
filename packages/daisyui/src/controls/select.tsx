import type {
  ReactNode,
  SelectHTMLAttributes,
} from "react";

import type { ControlProps } from "@formadapter/react";
import {
  nativeControlProps,
  optionForValue,
  selectedOptionValue,
  serializedOptionValue,
} from "@formadapter/html/native";

import { classNames } from "../class-names";
import { useDaisyUIClassNames } from "../prefix";
import { mergeControlStyle } from "./control-style";

export function Select({
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
    nativeControlProps<SelectHTMLAttributes<HTMLSelectElement>>(field);
  const options = field.options ?? [];
  const placeholder = field.config.placeholder ?? "Select an option";
  const daisyClassName = useDaisyUIClassNames(
    "select",
    invalid && "select-error",
  );

  return (
    <select
      {...configured.props}
      {...inputProps}
      aria-readonly={readOnly || undefined}
      className={classNames(
        daisyClassName,
        configured.className,
      )}
      disabled={disabled || readOnly}
      id={id}
      name={name}
      onBlur={onBlur}
      onChange={(event) => {
        if (readOnly) return;
        const selected = optionForValue(options, event.currentTarget.value);
        onValueChange(selected ? selected.value : "");
      }}
      required={required}
      ref={controlRef}
      style={mergeControlStyle(configured.style)}
      value={selectedOptionValue(options, value)}
    >
      <option disabled={required} value="">
        {placeholder}
      </option>
      {options.map((option, index) => (
        <option
          key={`${serializedOptionValue(option.value)}-${index}`}
          value={serializedOptionValue(option.value)}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
}
