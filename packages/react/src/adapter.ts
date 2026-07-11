import type {
  ComponentType,
  FormHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";

import type {
  ArrayField,
  FormNode,
  ObjectField,
  ScalarField,
  UnsupportedField,
} from "@formadapter/core";

export type ButtonIntent =
  | "submit"
  | "add"
  | "remove"
  | "move-up"
  | "move-down"
  | "next"
  | "previous";

export interface AccessibleControlProps {
  readonly "aria-describedby"?: string | undefined;
  readonly "aria-invalid"?: true | undefined;
  readonly "aria-label"?: string | undefined;
}

export interface FocusableControl {
  focus: () => void;
}

export interface ControlProps<
  TField extends ScalarField<string, unknown> = ScalarField<string, unknown>,
> {
  readonly field: TField;
  readonly id: string;
  readonly name: string;
  readonly value: unknown;
  /** Attach this to the focusable element so validation can focus errors. */
  readonly controlRef: (instance: FocusableControl | null) => void;
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly required: boolean;
  readonly invalid: boolean;
  readonly validating?: boolean;
  readonly inputProps: AccessibleControlProps;
  readonly onValueChange: (value: unknown) => void;
  readonly onBlur: () => void;
}

export type ControlComponent<
  TField extends ScalarField<string, unknown> = ScalarField<string, unknown>,
> =
  ComponentType<ControlProps<TField>>;

export interface FormSlotProps
  extends Omit<FormHTMLAttributes<HTMLFormElement>, "children"> {
  readonly children: ReactNode;
}

export interface FieldSlotProps extends HTMLAttributes<HTMLDivElement> {
  readonly field: ScalarField<string, unknown>;
  readonly controlId: string;
  readonly descriptionId?: string | undefined;
  readonly errorId?: string | undefined;
  readonly error?: string | undefined;
  readonly required: boolean;
  readonly invalid: boolean;
  readonly validating?: boolean;
  readonly children: ReactNode;
}

export interface GroupSlotProps extends HTMLAttributes<HTMLFieldSetElement> {
  readonly field: ObjectField<string, unknown>;
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly required: boolean;
  readonly error?: string | undefined;
  readonly errorId?: string | undefined;
  readonly children: ReactNode;
}

export interface ArraySlotProps extends HTMLAttributes<HTMLFieldSetElement> {
  readonly field: ArrayField<string, unknown>;
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly required: boolean;
  readonly itemCount: number;
  readonly error?: string | undefined;
  readonly errorId?: string | undefined;
  readonly children: ReactNode;
  readonly actions: ReactNode;
}

export interface ArrayItemSlotProps extends HTMLAttributes<HTMLDivElement> {
  readonly field: ArrayField<string, unknown>;
  readonly index: number;
  readonly label: string;
  readonly children: ReactNode;
  readonly actions: ReactNode;
}

export interface ButtonSlotProps {
  /** Accessible action name when the visible label needs more context. */
  readonly ariaLabel?: string | undefined;
  readonly intent: ButtonIntent;
  readonly type: "button" | "submit";
  readonly disabled: boolean;
  readonly pending?: boolean | undefined;
  readonly children: ReactNode;
  readonly onClick?: (() => void) | undefined;
}

export interface ErrorSummarySlotProps {
  readonly title: string;
  readonly errors: readonly string[];
  readonly items?: readonly {
    readonly message: string;
    readonly path?: string | undefined;
    readonly focusPath?: string | undefined;
  }[] | undefined;
  readonly onSelect?: ((path: string) => void) | undefined;
}

export interface FormMessageSlotProps {
  readonly kind: "error" | "info" | "success";
  readonly message: string;
}

export interface WizardSlotProps extends HTMLAttributes<HTMLElement> {
  readonly title: string;
  readonly description?: string | undefined;
  readonly currentStep: number;
  readonly totalSteps: number;
  readonly children: ReactNode;
  readonly navigation: ReactNode;
  /** Full visible-step metadata for adapters that render named steppers. */
  readonly steps?: readonly {
    readonly id: string;
    readonly title: string;
    readonly description?: string | undefined;
    readonly current: boolean;
    readonly completed: boolean;
  }[] | undefined;
}

export interface UnsupportedSlotProps {
  readonly field:
    | UnsupportedField<string, unknown>
    | FormNode<string, unknown>;
  readonly reason: string;
}

export interface FormAdapterSlots {
  readonly Form: ComponentType<FormSlotProps>;
  readonly Field: ComponentType<FieldSlotProps>;
  readonly Group: ComponentType<GroupSlotProps>;
  readonly Array: ComponentType<ArraySlotProps>;
  readonly ArrayItem: ComponentType<ArrayItemSlotProps>;
  readonly Button: ComponentType<ButtonSlotProps>;
  readonly ErrorSummary: ComponentType<ErrorSummarySlotProps>;
  readonly FormMessage: ComponentType<FormMessageSlotProps>;
  readonly Unsupported: ComponentType<UnsupportedSlotProps>;
  readonly Wizard: ComponentType<WizardSlotProps>;
}

export interface BuiltInControls {
  readonly input: ControlComponent;
  readonly textarea: ControlComponent;
  readonly select: ControlComponent;
  readonly radio: ControlComponent;
  readonly checkbox: ControlComponent;
  readonly file: ControlComponent;
}

export type CustomControlRegistry = Readonly<Record<string, ControlComponent>>;

export interface FormAdapter<
  TCustomControls extends CustomControlRegistry = CustomControlRegistry,
> {
  readonly name: string;
  readonly controls: BuiltInControls & {
    readonly custom: TCustomControls;
  };
  readonly slots: FormAdapterSlots;
  readonly extend: <const TNext extends CustomControlRegistry = Record<never, never>>(
    overrides: FormAdapterOverrides<TNext>,
  ) => FormAdapter<TCustomControls & TNext>;
}

export interface FormAdapterOverrides<
  TCustomControls extends CustomControlRegistry = CustomControlRegistry,
> {
  readonly name?: string;
  readonly controls?: Partial<BuiltInControls> & {
    readonly custom?: TCustomControls;
  };
  readonly slots?: Partial<FormAdapterSlots>;
}

export type AnyFormAdapter = FormAdapter<CustomControlRegistry>;

export type AdapterControlName<TAdapter extends AnyFormAdapter> =
  Extract<keyof TAdapter["controls"]["custom"], string>;

function extendAdapter<
  TBase extends CustomControlRegistry,
  TNext extends CustomControlRegistry,
>(
  base: FormAdapter<TBase>,
  overrides: FormAdapterOverrides<TNext>,
): FormAdapter<TBase & TNext> {
  const custom = {
    ...base.controls.custom,
    ...overrides.controls?.custom,
  } as TBase & TNext;
  return createAdapter({
    name: overrides.name ?? base.name,
    controls: {
      ...base.controls,
      ...overrides.controls,
      custom,
    },
    slots: {
      ...base.slots,
      ...overrides.slots,
    },
  });
}

export function createAdapter<const TCustom extends CustomControlRegistry>(
  definition: {
    readonly name: string;
    readonly controls: BuiltInControls & { readonly custom: TCustom };
    readonly slots: FormAdapterSlots;
  },
): FormAdapter<TCustom> {
  const adapter: FormAdapter<TCustom> = {
    ...definition,
    extend: <const TNext extends CustomControlRegistry = Record<never, never>>(
      overrides: FormAdapterOverrides<TNext>,
    ) => extendAdapter(adapter, overrides),
  };

  return adapter;
}
