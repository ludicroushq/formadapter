import type {
  FormHTMLAttributes,
  ReactNode,
} from "react";

import type {
  DeepPartial,
  FieldPredicate,
  FormConfig,
  FormModel,
  FormSchema,
  InferInput,
  InferOutput,
  JsonPrimitive,
  MaybePromise,
  PathValue,
  SubmissionAction,
  SubmissionState,
} from "@formadapter/core";

import type {
  AdapterControlName,
  AnyFormAdapter,
} from "./adapter";
import type {
  BoundFormState,
  FormAdapterFieldState,
} from "./hooks";
import type {
  ConcreteFieldPath,
  ConcretePathValue,
  RenderableFieldPath,
} from "./paths";

export type ValidationMode = "onSubmit" | "onBlur" | "onChange";

export interface SubmitContext<TSchema extends FormSchema> {
  /** Prepared schema input before transforms. Useful as a wire payload. */
  readonly input: InferInput<TSchema>;
  readonly formData: FormData;
  readonly signal: AbortSignal;
}

export type SubmitHandler<
  TSchema extends FormSchema,
  Data = unknown,
> = (
  values: InferOutput<TSchema>,
  context: SubmitContext<TSchema>,
) => MaybePromise<SubmissionState<Data> | void>;

export type FormSubmissionAction<Data = unknown> = SubmissionAction<FormData, Data>;

export type InvalidSubmitHandler = (
  errors: Readonly<Record<string, readonly string[]>>,
) => MaybePromise<void>;

export interface DraftAdapter<Values> {
  readonly load: (key: string) => MaybePromise<DeepPartial<Values> | null>;
  readonly save: (key: string, values: DeepPartial<Values>) => MaybePromise<void>;
  readonly clear: (key: string) => MaybePromise<void>;
}

/** A JSON-like adapter whose methods specialize to each form's value type. */
export interface StorageDraftAdapter {
  readonly load: <Values>(
    key: string,
  ) => MaybePromise<DeepPartial<Values> | null>;
  readonly save: <Values>(
    key: string,
    values: DeepPartial<Values>,
  ) => MaybePromise<void>;
  readonly clear: (key: string) => MaybePromise<void>;
}

export interface DraftConfig<Values> {
  readonly key: string;
  readonly adapter?: DraftAdapter<Values> | StorageDraftAdapter;
  readonly debounceMs?: number;
  readonly clearOnSuccess?: boolean;
  readonly onError?: (error: unknown) => void;
}

interface BoundFormBaseProps<
  TSchema extends FormSchema,
  Data,
> extends Omit<
  FormHTMLAttributes<HTMLFormElement>,
  "action" | "children" | "defaultValue" | "onInvalid" | "onSubmit"
> {
  /** Complete form-local replacement. Prefer adapter.extend(...) for partial changes. */
  readonly adapter?: AnyFormAdapter;
  readonly children?: ReactNode;
  /** Initial values read when this form mounts. Use `useFormState().reset` for later changes. */
  readonly defaultValues?: DeepPartial<InferInput<TSchema>>;
  readonly disabled?: boolean;
  readonly draft?: DraftConfig<InferInput<TSchema>>;
  readonly initialSubmissionState?: SubmissionState<Data>;
  readonly mode?: ValidationMode;
  readonly onInvalid?: InvalidSubmitHandler;
  readonly onResult?: (result: SubmissionState<Data>) => void;
  readonly permalink?: string;
  readonly resetOnSuccess?: boolean;
  readonly submitLabel?: string;
}

export type BoundFormProps<
  TSchema extends FormSchema,
  Data = unknown,
> = BoundFormBaseProps<TSchema, Data> & (
    | {
        readonly action: FormSubmissionAction<Data>;
        readonly onSubmit?: never;
      }
    | {
        readonly action?: never;
        readonly onSubmit?: SubmitHandler<TSchema, Data>;
      }
  );

type BoundFieldOption<Value> = {
  readonly label: string;
  readonly value: Extract<Exclude<Value, undefined>, JsonPrimitive>;
};

type BoundFieldOptions<Input, Path extends RenderableFieldPath<Input>> =
  | readonly BoundFieldOption<PathValue<Input, Path>>[]
  | ((
      values: Readonly<DeepPartial<Input>>,
    ) => readonly BoundFieldOption<PathValue<Input, Path>>[]);

export type BoundFieldProps<TSchema extends FormSchema> = {
  [Path in RenderableFieldPath<InferInput<TSchema>>]: {
    readonly name: Path;
    readonly className?: string;
    /** Per-render options are convenient for query-backed selects. */
    readonly options?: BoundFieldOptions<InferInput<TSchema>, Path>;
  };
}[RenderableFieldPath<InferInput<TSchema>>];

export interface BoundFieldsProps<TSchema extends FormSchema> {
  readonly names?: readonly RenderableFieldPath<InferInput<TSchema>>[];
  readonly className?: string;
}

export interface BoundSubmitProps {
  readonly children?: ReactNode;
}

interface BoundWhenBaseProps {
  readonly children?: ReactNode;
  readonly fallback?: ReactNode;
}

type FieldWhenCondition<Input> = {
  readonly [Path in RenderableFieldPath<Input>]: {
    readonly field: Path;
    readonly equals: PathValue<Input, Path>;
    readonly matches?: never;
  };
}[RenderableFieldPath<Input>];

export type BoundWhenProps<TSchema extends FormSchema> = BoundWhenBaseProps & (
  | FieldWhenCondition<InferInput<TSchema>>
  | {
      readonly field?: never;
      readonly equals?: never;
      readonly matches: FieldPredicate<InferInput<TSchema>>;
    }
);

export interface BoundStepProps<TSchema extends FormSchema> {
  readonly id?: string;
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
  /**
   * Adds ownership for fields hidden behind an opaque component.
   * Field, Fields, and When descendants in native markup are inferred separately.
   * Pass an empty array to explicitly create a content-only step.
   */
  readonly fields?: readonly RenderableFieldPath<InferInput<TSchema>>[];
  readonly when?: FieldPredicate<InferInput<TSchema>>;
  readonly nextLabel?: string;
  readonly previousLabel?: string;
}

export type BoundWizardProps<
  TSchema extends FormSchema,
  Data = unknown,
> = Omit<
  BoundFormProps<TSchema, Data>,
  "children"
> & {
  readonly children: ReactNode;
  readonly includeRemaining?: boolean;
  readonly nextLabel?: string;
  readonly previousLabel?: string;
  readonly remainingTitle?: string;
};

export interface CreatedForm<
  TSchema extends FormSchema,
  TAdapter extends AnyFormAdapter,
> {
  readonly schema: TSchema;
  readonly config: FormConfig<
    InferInput<TSchema>,
    AdapterControlName<TAdapter>
  >;
  /** Adds or overrides contextually typed configuration on this schema. */
  readonly configure: (
    config: FormConfig<
      InferInput<TSchema>,
      AdapterControlName<TAdapter>
    >,
  ) => CreatedForm<TSchema, TAdapter>;
  readonly Form: <Data = unknown>(props: BoundFormProps<TSchema, Data>) => ReactNode;
  readonly Field: (props: BoundFieldProps<TSchema>) => ReactNode;
  readonly Fields: (props: BoundFieldsProps<TSchema>) => ReactNode;
  readonly Submit: (props: BoundSubmitProps) => ReactNode;
  readonly Step: (props: BoundStepProps<TSchema>) => ReactNode;
  readonly When: (props: BoundWhenProps<TSchema>) => ReactNode;
  readonly Wizard: <Data = unknown>(props: BoundWizardProps<TSchema, Data>) => ReactNode;
  readonly useField: <TPath extends ConcreteFieldPath<InferInput<TSchema>>>(
    name: TPath,
  ) => FormAdapterFieldState<ConcretePathValue<InferInput<TSchema>, TPath>>;
  readonly useFormModel: () => FormModel<
    InferInput<TSchema>,
    AdapterControlName<TAdapter>
  >;
  readonly useFormState: () => BoundFormState<InferInput<TSchema>>;
}

export interface CreateForm<TAdapter extends AnyFormAdapter> {
  <const TSchema extends FormSchema>(
    schema: TSchema,
  ): CreatedForm<TSchema, TAdapter>;
  <const TSchema extends FormSchema>(
    schema: TSchema,
    config: FormConfig<
      InferInput<TSchema>,
      AdapterControlName<TAdapter>
    >,
  ): CreatedForm<TSchema, TAdapter>;
}
