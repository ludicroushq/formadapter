import type { InputHTMLAttributes, ReactNode } from "react";

import {
  nativeControlProps,
  serializedOptionValue,
} from "@formadapter/html/native";
import type { ControlProps } from "@formadapter/react";

import { cn } from "../cn";
import { RADIO_CLASS } from "../styles";

export function Radio({
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
  const options = field.options ?? [];

  return (
    <div
      {...inputProps}
      aria-invalid={invalid || undefined}
      aria-label={inputProps["aria-label"] ?? field.label}
      aria-readonly={readOnly || undefined}
      aria-required={required || undefined}
      className="grid gap-3"
      data-invalid={invalid || undefined}
      data-slot="radio-group"
      ref={options.length === 0 ? controlRef : undefined}
      role="radiogroup"
      tabIndex={options.length === 0 ? -1 : undefined}
    >
      {options.map((option, index) => {
        const optionId = index === 0 ? id : `${id}-${index}`;
        return (
          <label
            className="flex w-fit items-center gap-2 text-sm leading-none font-medium has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
            htmlFor={optionId}
            key={optionId}
          >
            <span className="relative inline-grid size-4 shrink-0 place-items-center">
              <input
                {...configured.props}
                checked={Object.is(value, option.value)}
                className={cn(RADIO_CLASS, configured.className)}
                data-invalid={invalid || undefined}
                data-slot="radio-group-item"
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
              <span className="pointer-events-none absolute size-2 rounded-full bg-primary opacity-0 peer-checked:opacity-100" />
            </span>
            <span>{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}
