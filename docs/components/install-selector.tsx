"use client";

import { useId } from "react";

interface InstallSelectorOption<TValue extends string> {
  readonly label: string;
  readonly value: TValue;
}

interface InstallSelectorProps<TValue extends string> {
  readonly disabled?: boolean;
  readonly label: string;
  readonly onChange: (value: TValue) => void;
  readonly options: readonly InstallSelectorOption<TValue>[];
  readonly value: TValue;
}

export function InstallSelector<TValue extends string>({
  disabled = false,
  label,
  onChange,
  options,
  value,
}: InstallSelectorProps<TValue>): React.JSX.Element {
  const groupId = useId();

  return (
    <fieldset className="install-selector" disabled={disabled}>
      <legend className="sr-only">{label}</legend>
      <div className="install-mini-tabs">
        {options.map((option) => {
          const optionId = `${groupId}-${option.value}`;

          return (
            <label htmlFor={optionId} key={option.value}>
              <input
                checked={option.value === value}
                className="sr-only"
                id={optionId}
                name={groupId}
                onChange={() => onChange(option.value)}
                type="radio"
                value={option.value}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
