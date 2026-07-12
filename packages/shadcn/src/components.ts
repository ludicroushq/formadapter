import type {
  ComponentPropsWithRef,
  CSSProperties,
  ElementType,
  FocusEventHandler,
  ReactNode,
  Ref,
} from "react";

type ButtonProps = {
  readonly "aria-busy"?: boolean | undefined;
  readonly "aria-label"?: string | undefined;
  readonly children?: ReactNode | undefined;
  readonly "data-intent"?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly onClick?: (() => void) | undefined;
  readonly type?: "button" | "submit" | undefined;
  readonly variant:
    | "default"
    | "destructive"
    | "outline"
    | "link";
};

type InputProps = Omit<ComponentPropsWithRef<"input">, "size">;
type TextareaProps = ComponentPropsWithRef<"textarea">;
type NativeSelectProps = Omit<ComponentPropsWithRef<"select">, "size">;
type NativeSelectOptionProps = ComponentPropsWithRef<"option">;
type FieldProps = ComponentPropsWithRef<"div"> & {
  readonly orientation?: "vertical" | "horizontal";
};
type FieldContentProps = ComponentPropsWithRef<"div">;
type FieldDescriptionProps = ComponentPropsWithRef<"p">;
type FieldErrorProps = ComponentPropsWithRef<"div">;
type FieldGroupProps = ComponentPropsWithRef<"div">;
type FieldLabelProps = ComponentPropsWithRef<"label">;
type FieldLegendProps = ComponentPropsWithRef<"legend">;
type FieldSetProps = ComponentPropsWithRef<"fieldset">;
type FieldTitleProps = ComponentPropsWithRef<"div">;
type AlertProps = ComponentPropsWithRef<"div"> & {
  readonly variant?: "default" | "destructive";
};
type AlertDescriptionProps = ComponentPropsWithRef<"div">;
type AlertTitleProps = ComponentPropsWithRef<"div">;
type SpinnerProps = ComponentPropsWithRef<"svg">;
type ProgressProps = {
  readonly "aria-label"?: string | undefined;
  readonly max: number;
  readonly value: number;
};

export interface CommonShadcnComponents {
  readonly Alert: ElementType<AlertProps>;
  readonly AlertDescription: ElementType<AlertDescriptionProps>;
  readonly AlertTitle: ElementType<AlertTitleProps>;
  readonly Button: ElementType<ButtonProps>;
  readonly Field: ElementType<FieldProps>;
  readonly FieldContent: ElementType<FieldContentProps>;
  readonly FieldDescription: ElementType<FieldDescriptionProps>;
  readonly FieldError: ElementType<FieldErrorProps>;
  readonly FieldGroup: ElementType<FieldGroupProps>;
  readonly FieldLabel: ElementType<FieldLabelProps>;
  readonly FieldLegend: ElementType<FieldLegendProps>;
  readonly FieldSet: ElementType<FieldSetProps>;
  readonly FieldTitle: ElementType<FieldTitleProps>;
  readonly Input: ElementType<InputProps>;
  readonly NativeSelect: ElementType<NativeSelectProps>;
  readonly NativeSelectOption: ElementType<NativeSelectOptionProps>;
  readonly Progress: ElementType<ProgressProps>;
  readonly Spinner: ElementType<SpinnerProps>;
  readonly Textarea: ElementType<TextareaProps>;
}

type AccessiblePrimitiveProps = {
  readonly "aria-describedby"?: string | undefined;
  readonly "aria-invalid"?: true | undefined;
  readonly "aria-label"?: string | undefined;
  readonly "aria-readonly"?: boolean | undefined;
  readonly className?: string | undefined;
  readonly style?: CSSProperties | undefined;
};

type BaseUICheckboxProps = AccessiblePrimitiveProps & {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly id: string;
  readonly inputRef: Ref<HTMLInputElement>;
  readonly name: string;
  readonly onBlur: FocusEventHandler<HTMLElement>;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly readOnly: boolean;
  readonly required: boolean;
  readonly tabIndex?: number | undefined;
  readonly value: string;
};

type BaseUIRadioGroupProps = AccessiblePrimitiveProps & {
  readonly disabled: boolean;
  readonly name: string;
  readonly onBlur: FocusEventHandler<HTMLElement>;
  readonly onValueChange: (value: string) => void;
  readonly readOnly: boolean;
  readonly ref?: Ref<HTMLDivElement> | undefined;
  readonly required: boolean;
  readonly tabIndex?: number | undefined;
  readonly value: string;
};

type BaseUIRadioGroupItemProps = AccessiblePrimitiveProps & {
  readonly disabled: boolean;
  readonly id: string;
  readonly inputRef?: Ref<HTMLInputElement> | undefined;
  readonly value: string;
};

export interface BaseUIShadcnComponents extends CommonShadcnComponents {
  readonly Checkbox: ElementType<BaseUICheckboxProps>;
  readonly RadioGroup: ElementType<BaseUIRadioGroupProps>;
  readonly RadioGroupItem: ElementType<BaseUIRadioGroupItemProps>;
}

type RadixCheckboxProps = AccessiblePrimitiveProps & {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly id: string;
  readonly name: string;
  readonly onBlur: FocusEventHandler<HTMLButtonElement>;
  readonly onCheckedChange: (checked: boolean | "indeterminate") => void;
  readonly ref: Ref<HTMLButtonElement>;
  readonly required: boolean;
  readonly value: string;
};

type RadixRadioGroupProps = AccessiblePrimitiveProps & {
  readonly disabled: boolean;
  readonly name: string;
  readonly onBlur: FocusEventHandler<HTMLDivElement>;
  readonly onValueChange: (value: string) => void;
  readonly ref?: Ref<HTMLDivElement> | undefined;
  readonly required: boolean;
  readonly value: string;
};

type RadixRadioGroupItemProps = AccessiblePrimitiveProps & {
  readonly disabled: boolean;
  readonly id: string;
  readonly ref?: Ref<HTMLButtonElement> | undefined;
  readonly value: string;
};

export interface RadixShadcnComponents extends CommonShadcnComponents {
  readonly Checkbox: ElementType<RadixCheckboxProps>;
  readonly RadioGroup: ElementType<RadixRadioGroupProps>;
  readonly RadioGroupItem: ElementType<RadixRadioGroupItemProps>;
}
