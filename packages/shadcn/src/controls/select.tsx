import type { ReactNode, SelectHTMLAttributes } from "react";

import {
  nativeControlProps,
  optionForValue,
  selectedOptionValue,
  serializedOptionValue,
} from "@formadapter/html/native";
import type { ControlProps } from "@formadapter/react";

import { cn } from "../cn";
import { ChevronDownIcon } from "../icons";
import { SELECT_CLASS } from "../styles";

export function Select({
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
    nativeControlProps<SelectHTMLAttributes<HTMLSelectElement>>(field);
  const options = field.options ?? [];
  const placeholder = field.config.placeholder ?? "Select an option";

  return (
    <div
      className="group/native-select relative w-full has-[select:disabled]:opacity-50"
      data-slot="native-select-wrapper"
    >
      <select
        {...configured.props}
        {...inputProps}
        aria-readonly={readOnly || undefined}
        className={cn(SELECT_CLASS, configured.className)}
        data-slot="native-select"
        disabled={disabled || readOnly}
        id={id}
        name={name}
        onBlur={onBlur}
        onChange={(event) => {
          if (readOnly) return;
          const selected = optionForValue(options, event.currentTarget.value);
          onValueChange(selected ? selected.value : "");
        }}
        ref={controlRef}
        required={required}
        style={configured.style}
        value={selectedOptionValue(options, value)}
      >
        <option disabled={required} value="">
          {placeholder}
        </option>
        {options.map((option, index) => (
          <option
            className="bg-[Canvas] text-[CanvasText]"
            key={`${serializedOptionValue(option.value)}-${index}`}
            value={serializedOptionValue(option.value)}
          >
            {option.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-muted-foreground opacity-50 select-none"
        data-slot="native-select-icon"
      >
        <ChevronDownIcon />
      </span>
    </div>
  );
}
