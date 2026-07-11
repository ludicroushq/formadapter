import type {
  InputHTMLAttributes,
  ReactNode,
} from "react";

import type { ControlProps } from "@formadapter/react";

import {
  nativeControlProps,
  serializedOptionValue,
} from "./shared";

export function Radio({
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
  const options = field.options ?? [];

  return (
    <div
      {...inputProps}
      aria-label={inputProps["aria-label"] ?? field.label}
      aria-readonly={readOnly || undefined}
      aria-required={required || undefined}
      ref={options.length === 0 ? controlRef : undefined}
      role="radiogroup"
      tabIndex={options.length === 0 ? -1 : undefined}
    >
      {options.map((option, index) => {
        const optionId = index === 0 ? id : `${id}-${index}`;
        return (
          <label htmlFor={optionId} key={optionId}>
            <input
              {...configured.props}
              checked={Object.is(value, option.value)}
              className={configured.className}
              disabled={disabled || readOnly}
              id={optionId}
              name={name}
              onBlur={onBlur}
              onChange={() => {
                if (!readOnly) onValueChange(option.value);
              }}
              readOnly={readOnly}
              ref={index === 0 ? controlRef : undefined}
              required={required}
              style={configured.style}
              type="radio"
              value={serializedOptionValue(option.value)}
            />
            <span>{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}
