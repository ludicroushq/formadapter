/* eslint-disable jsx-a11y/prefer-tag-over-role */

import {
  createContext,
  useContext,
  type ComponentPropsWithRef,
  type CSSProperties,
  type FocusEventHandler,
  type ReactNode,
  type Ref,
} from "react";

import type {
  BaseUIShadcnComponents,
  RadixShadcnComponents,
} from "../src/components";

function Alert({ variant, ...props }: ComponentPropsWithRef<"div"> & {
  variant?: "default" | "destructive";
}): React.JSX.Element {
  return <div data-ui="alert" data-variant={variant} {...props} />;
}

function AlertDescription(props: ComponentPropsWithRef<"div">): React.JSX.Element {
  return <div data-ui="alert-description" {...props} />;
}

function AlertTitle(props: ComponentPropsWithRef<"div">): React.JSX.Element {
  return <div data-ui="alert-title" {...props} />;
}

function Button({ variant, ...props }: ComponentPropsWithRef<"button"> & {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}): React.JSX.Element {
  return <button data-ui="button" data-variant={variant} {...props} />;
}

export { Button as TestButton };

function Field({ orientation, ...props }: ComponentPropsWithRef<"div"> & {
  orientation?: "vertical" | "horizontal" | "responsive";
}): React.JSX.Element {
  return <div data-ui="field" data-orientation={orientation} {...props} />;
}

function FieldContent(props: ComponentPropsWithRef<"div">): React.JSX.Element {
  return <div data-ui="field-content" {...props} />;
}

function FieldDescription(props: ComponentPropsWithRef<"p">): React.JSX.Element {
  return <p data-ui="field-description" {...props} />;
}

function FieldError(props: ComponentPropsWithRef<"div">): React.JSX.Element {
  return <div data-ui="field-error" role="alert" {...props} />;
}

function FieldGroup(props: ComponentPropsWithRef<"div">): React.JSX.Element {
  return <div data-ui="field-group" {...props} />;
}

function FieldLabel(props: ComponentPropsWithRef<"label">): React.JSX.Element {
  // Generic generated-style wrapper; association is supplied by each caller.
  // eslint-disable-next-line jsx-a11y/label-has-associated-control
  return <label data-ui="field-label" {...props} />;
}

function FieldLegend(props: ComponentPropsWithRef<"legend">): React.JSX.Element {
  return <legend data-ui="field-legend" {...props} />;
}

function FieldSet(props: ComponentPropsWithRef<"fieldset">): React.JSX.Element {
  return <fieldset data-ui="field-set" {...props} />;
}

function FieldTitle(props: ComponentPropsWithRef<"div">): React.JSX.Element {
  return <div data-ui="field-title" {...props} />;
}

function Input(props: Omit<ComponentPropsWithRef<"input">, "size">): React.JSX.Element {
  return <input data-ui="input" {...props} />;
}

function NativeSelect(props: Omit<ComponentPropsWithRef<"select">, "size">): React.JSX.Element {
  return <select data-ui="native-select" {...props} />;
}

function NativeSelectOption(props: ComponentPropsWithRef<"option">): React.JSX.Element {
  return <option data-ui="native-select-option" {...props} />;
}

function Progress({ value, max, ...props }: {
  readonly "aria-label"?: string;
  readonly className?: string;
  readonly max: number;
  readonly value: number | null;
}): React.JSX.Element {
  return <progress data-ui="progress" max={max} value={value ?? undefined} {...props} />;
}

function Spinner(props: ComponentPropsWithRef<"svg">): React.JSX.Element {
  return <svg data-ui="spinner" {...props} />;
}

function Textarea(props: ComponentPropsWithRef<"textarea">): React.JSX.Element {
  return <textarea data-ui="textarea" {...props} />;
}

const common = {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
  Input,
  NativeSelect,
  NativeSelectOption,
  Progress,
  Spinner,
  Textarea,
} as const;

interface RadioState {
  readonly disabled: boolean;
  readonly onValueChange: (value: string) => void;
  readonly value: string;
}

const BaseRadioContext = createContext<RadioState | null>(null);

function BaseCheckbox({
  checked,
  disabled,
  inputRef,
  onCheckedChange,
  readOnly,
  ...props
}: {
  readonly checked: boolean;
  readonly className?: string;
  readonly disabled: boolean;
  readonly id: string;
  readonly inputRef: Ref<HTMLInputElement>;
  readonly name: string;
  readonly onBlur: FocusEventHandler<HTMLElement>;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly readOnly: boolean;
  readonly required: boolean;
  readonly style?: CSSProperties;
  readonly value: string;
}): React.JSX.Element {
  return (
    <input
      {...props}
      checked={checked}
      data-ui="base-checkbox"
      disabled={disabled}
      onChange={(event) => onCheckedChange(event.currentTarget.checked)}
      readOnly={readOnly}
      ref={inputRef}
      type="checkbox"
    />
  );
}

function BaseRadioGroup({
  children,
  disabled,
  onValueChange,
  value,
  ...props
}: {
  readonly children?: ReactNode;
  readonly disabled: boolean;
  readonly name: string;
  readonly onBlur: FocusEventHandler<HTMLElement>;
  readonly onValueChange: (value: string) => void;
  readonly readOnly: boolean;
  readonly ref?: Ref<HTMLDivElement>;
  readonly required: boolean;
  readonly value: string;
}): React.JSX.Element {
  return (
    <BaseRadioContext.Provider value={{ disabled, onValueChange, value }}>
      <div data-ui="base-radio-group" role="radiogroup" {...props}>{children}</div>
    </BaseRadioContext.Provider>
  );
}

function BaseRadioGroupItem({
  disabled,
  inputRef,
  value,
  ...props
}: {
  readonly disabled: boolean;
  readonly id: string;
  readonly inputRef?: Ref<HTMLInputElement>;
  readonly value: string;
}): React.JSX.Element {
  const group = useContext(BaseRadioContext);
  if (!group) throw new Error("Missing radio group");
  return (
    <input
      {...props}
      checked={group.value === value}
      data-ui="base-radio-item"
      disabled={disabled || group.disabled}
      onChange={() => group.onValueChange(value)}
      ref={inputRef}
      type="radio"
      value={value}
    />
  );
}

export const baseComponents = {
  ...common,
  Checkbox: BaseCheckbox,
  RadioGroup: BaseRadioGroup,
  RadioGroupItem: BaseRadioGroupItem,
} as unknown as BaseUIShadcnComponents;

const RadixRadioContext = createContext<RadioState | null>(null);

function RadixCheckbox({
  checked,
  disabled,
  onCheckedChange,
  ...props
}: {
  readonly checked: boolean | "indeterminate";
  readonly className?: string;
  readonly disabled: boolean;
  readonly id: string;
  readonly name: string;
  readonly onBlur: FocusEventHandler<HTMLButtonElement>;
  readonly onCheckedChange: (checked: boolean | "indeterminate") => void;
  readonly ref: Ref<HTMLButtonElement>;
  readonly required: boolean;
  readonly style?: CSSProperties;
  readonly value: string;
}): React.JSX.Element {
  return (
    // Deliberately mirrors the Radix button-based checkbox primitive.
    // eslint-disable-next-line jsx-a11y/prefer-tag-over-role
    <button
      {...props}
      aria-checked={checked === "indeterminate" ? "mixed" : checked}
      data-ui="radix-checkbox"
      disabled={disabled}
      onClick={() => onCheckedChange(checked !== true)}
      role="checkbox"
      type="button"
    />
  );
}

function RadixRadioGroup({
  children,
  disabled,
  onValueChange,
  value,
  ...props
}: {
  readonly children?: ReactNode;
  readonly disabled: boolean;
  readonly name: string;
  readonly onBlur: FocusEventHandler<HTMLDivElement>;
  readonly onValueChange: (value: string) => void;
  readonly ref?: Ref<HTMLDivElement>;
  readonly required: boolean;
  readonly value: string;
}): React.JSX.Element {
  return (
    <RadixRadioContext.Provider value={{ disabled, onValueChange, value }}>
      <div data-ui="radix-radio-group" role="radiogroup" {...props}>{children}</div>
    </RadixRadioContext.Provider>
  );
}

function RadixRadioGroupItem({ disabled, value, ...props }: {
  readonly disabled: boolean;
  readonly id: string;
  readonly ref?: Ref<HTMLButtonElement>;
  readonly value: string;
}): React.JSX.Element {
  const group = useContext(RadixRadioContext);
  if (!group) throw new Error("Missing radio group");
  return (
    // Deliberately mirrors the Radix button-based radio primitive.
    // eslint-disable-next-line jsx-a11y/prefer-tag-over-role
    <button
      {...props}
      aria-checked={group.value === value}
      data-ui="radix-radio-item"
      disabled={disabled || group.disabled}
      onClick={() => group.onValueChange(value)}
      role="radio"
      type="button"
      value={value}
    />
  );
}

export const radixComponents = {
  ...common,
  Checkbox: RadixCheckbox,
  RadioGroup: RadixRadioGroup,
  RadioGroupItem: RadixRadioGroupItem,
} as unknown as RadixShadcnComponents;
