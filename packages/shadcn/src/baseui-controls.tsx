import {
  nativeControlProps,
  optionForValue,
  selectedOptionValue,
  serializedOptionValue,
} from "@formadapter/html/native";
import type { ControlProps } from "@formadapter/react";

import type { BaseUIShadcnComponents } from "./components";
import type { ChoiceControls } from "./factory";

function requiresCheckedValue(field: ControlProps["field"]): boolean {
  return typeof field.source === "object" && field.source !== null &&
    field.source.const === true;
}

export function createBaseUIChoiceControls(
  components: BaseUIShadcnComponents,
): ChoiceControls {
  const {
    Checkbox,
    Field,
    FieldLabel,
    RadioGroup,
    RadioGroupItem,
  } = components;

  function CheckboxControl({
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
  }: ControlProps): React.JSX.Element {
    const configured = nativeControlProps<Record<string, unknown>>(field);

    return (
      <Checkbox
        {...configured.props}
        {...inputProps}
        aria-invalid={invalid || undefined}
        aria-readonly={readOnly || undefined}
        checked={value === true}
        className={configured.className}
        disabled={disabled}
        id={id}
        inputRef={controlRef}
        name={name}
        onBlur={onBlur}
        onCheckedChange={(checked) => {
          if (!readOnly) onValueChange(checked);
        }}
        readOnly={readOnly}
        required={required && requiresCheckedValue(field)}
        style={configured.style}
        value="true"
      />
    );
  }

  function RadioControl({
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
  }: ControlProps): React.JSX.Element {
    const options = field.options ?? [];
    const configured = nativeControlProps<Record<string, unknown>>(field);

    return (
      <RadioGroup
        {...configured.props}
        {...inputProps}
        aria-invalid={invalid || undefined}
        aria-label={inputProps["aria-label"] ?? field.label}
        aria-readonly={readOnly || undefined}
        className={configured.className}
        disabled={disabled}
        name={name}
        onBlur={onBlur}
        onValueChange={(nextValue) => {
          if (readOnly) return;
          const selected = optionForValue(options, nextValue);
          if (selected) onValueChange(selected.value);
        }}
        readOnly={readOnly}
        ref={options.length === 0 ? controlRef : undefined}
        required={required}
        style={configured.style}
        tabIndex={options.length === 0 ? -1 : undefined}
        value={selectedOptionValue(options, value)}
      >
        {options.map((option, index) => {
          const optionId = index === 0 ? id : `${id}-${index}`;
          return (
            <Field key={optionId} orientation="horizontal">
              <RadioGroupItem
                aria-invalid={invalid || undefined}
                disabled={disabled}
                id={optionId}
                inputRef={index === 0 ? controlRef : undefined}
                value={serializedOptionValue(option.value)}
              />
              <FieldLabel htmlFor={optionId}>{option.label}</FieldLabel>
            </Field>
          );
        })}
      </RadioGroup>
    );
  }

  return { checkbox: CheckboxControl, radio: RadioControl };
}
