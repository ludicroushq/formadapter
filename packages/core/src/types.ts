import type {
  DeepPartial,
  FieldPath,
  PathValue,
} from "./path";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type JsonSchema = boolean | JsonSchemaObject;

export interface JsonSchemaObject {
  readonly $ref?: string;
  readonly $defs?: Readonly<Record<string, JsonSchema>>;
  readonly definitions?: Readonly<Record<string, JsonSchema>>;
  readonly type?: string | readonly string[];
  readonly title?: string;
  readonly description?: string;
  readonly default?: unknown;
  readonly readOnly?: boolean;
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly additionalProperties?: JsonSchema;
  readonly patternProperties?: Readonly<Record<string, JsonSchema>>;
  readonly propertyNames?: JsonSchema;
  readonly required?: readonly string[];
  readonly items?: JsonSchema | readonly JsonSchema[];
  readonly prefixItems?: readonly JsonSchema[];
  readonly enum?: readonly unknown[];
  readonly const?: unknown;
  readonly anyOf?: readonly JsonSchema[];
  readonly oneOf?: readonly JsonSchema[];
  readonly allOf?: readonly JsonSchema[];
  readonly format?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly exclusiveMinimum?: number;
  readonly exclusiveMaximum?: number;
  readonly multipleOf?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly uniqueItems?: boolean;
  readonly contentEncoding?: string;
  readonly contentMediaType?: string;
  readonly [keyword: string]: unknown;
}

export type BuiltInControl =
  | "text"
  | "email"
  | "url"
  | "tel"
  | "password"
  | "search"
  | "date"
  | "datetime-local"
  | "time"
  | "textarea"
  | "number"
  | "range"
  | "checkbox"
  | "select"
  | "radio"
  | "file"
  | "hidden";

export type NativeInputType = Exclude<BuiltInControl, "textarea" | "select" | "radio">;
export type FieldDataType = "string" | "number" | "integer" | "boolean" | "file" | "unknown";
export type FieldPredicate<Values> = (values: Readonly<DeepPartial<Values>>) => boolean;
export type FieldState<Values> = boolean | FieldPredicate<Values>;

export type MaybePromise<Value> = Promise<Value> | Value;

/** The portable subset of AbortSignal exposed to field validators. */
export interface AsyncFieldValidationSignal {
  readonly aborted: boolean;
  readonly reason: unknown;
  addEventListener(
    type: "abort",
    listener: () => void,
    options?: { readonly once?: boolean },
  ): void;
  removeEventListener(type: "abort", listener: () => void): void;
  throwIfAborted(): void;
}

export interface AsyncFieldValidationContext {
  /** Aborted when a newer validation for the same runtime field starts. */
  readonly signal: AsyncFieldValidationSignal;
}

export type AsyncFieldValidator<Value, Values> = (
  value: Value,
  values: Readonly<DeepPartial<Values>>,
  context: AsyncFieldValidationContext,
) => MaybePromise<readonly string[] | string | undefined>;

export interface FormOption<Value extends JsonPrimitive = JsonPrimitive> {
  readonly label: string;
  readonly value: Value;
}

type FieldOptionValue<Value> = unknown extends Value
  ? JsonPrimitive
  : Extract<Value, JsonPrimitive>;

export type FieldOptions<Values, Value = unknown> =
  | readonly FormOption<FieldOptionValue<Value>>[]
  | ((values: Readonly<DeepPartial<Values>>) => readonly FormOption<FieldOptionValue<Value>>[]);

export interface ArrayConfig<Values = unknown> {
  readonly addLabel?: string;
  readonly removeLabel?: string;
  readonly moveUpLabel?: string;
  readonly moveDownLabel?: string;
  readonly itemLabel?:
    | string
    | ((
        index: number,
        item: unknown,
        values: Readonly<DeepPartial<Values>>,
      ) => string);
}

export interface FieldConfig<
  Control extends string = never,
  Values = unknown,
  Value = unknown,
> {
  readonly label?: string;
  readonly description?: string;
  readonly placeholder?: string;
  readonly control?: BuiltInControl | Control;
  readonly hidden?: FieldState<Values>;
  readonly disabled?: FieldState<Values>;
  readonly readOnly?: FieldState<Values>;
  readonly order?: number;
  readonly className?: string;
  readonly controlProps?: Readonly<Record<string, unknown>>;
  readonly defaultValue?: Value;
  /** A static list or a synchronous projection of query-backed application state. */
  readonly options?: FieldOptions<Values, Value>;
  readonly multiple?: boolean;
  /** Makes an optional schema field required only while it is rendered. */
  readonly requiredWhenVisible?: FieldState<Values>;
  readonly requiredMessage?: string;
  /** Runs after authoritative schema validation succeeds for this field. */
  readonly asyncValidate?: AsyncFieldValidator<Value, Values>;
  /** Debounces async validation. Defaults to 250ms. */
  readonly asyncValidationDebounceMs?: number;
  readonly array?: ArrayConfig<Values>;
}

export interface FormConfig<Input, Control extends string = never> {
  readonly fields?: {
    readonly [Path in FieldPath<Input>]?:
      | FieldConfig<Control, Input, PathValue<Input, Path>>
      | undefined;
  };
  readonly jsonSchema?: {
    readonly libraryOptions?: Readonly<Record<string, unknown>>;
    readonly opaqueRefinements?: "base" | "error";
  };
}

export interface ResolvedFieldConfig<
  Control extends string = never,
  Values = unknown,
  Value = unknown,
> {
  readonly control?: BuiltInControl | Control;
  readonly placeholder?: string;
  readonly hidden: FieldState<Values>;
  readonly disabled: FieldState<Values>;
  readonly readOnly: FieldState<Values>;
  readonly order?: number;
  readonly className?: string;
  readonly controlProps?: Readonly<Record<string, unknown>>;
  readonly multiple: boolean;
  readonly options?: FieldOptions<Values, Value>;
  readonly requiredWhenVisible: FieldState<Values>;
  readonly requiredMessage?: string;
  readonly asyncValidate?: AsyncFieldValidator<Value, Values>;
  readonly asyncValidationDebounceMs: number;
  readonly array?: ArrayConfig<Values>;
  readonly extensions: Readonly<Record<string, unknown>>;
}

export interface ScalarConstraints {
  readonly format?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly exclusiveMinimum?: number;
  readonly exclusiveMaximum?: number;
  readonly multipleOf?: number;
  readonly accept?: string;
  readonly multiple: boolean;
  readonly contentEncoding?: string;
  readonly contentMediaType?: string;
}

interface BaseField<
  Kind extends FormNode["kind"],
  Control extends string,
  Values,
> {
  readonly kind: Kind;
  readonly key: string;
  readonly path: string;
  readonly label: string;
  readonly description?: string;
  readonly required: boolean;
  readonly nullable: boolean;
  readonly defaultValue?: unknown;
  readonly config: ResolvedFieldConfig<Control, Values>;
  readonly source: JsonSchema;
}

export interface ScalarField<Control extends string = never, Values = unknown>
  extends BaseField<"scalar", Control, Values> {
  readonly dataType: FieldDataType;
  readonly control: BuiltInControl | Control;
  readonly inputType?: NativeInputType;
  readonly constraints: ScalarConstraints;
  readonly options?: readonly FormOption[];
}

export interface ObjectField<Control extends string = never, Values = unknown>
  extends BaseField<"object", Control, Values> {
  readonly children: readonly FormNode<Control, Values>[];
}

export interface ArrayField<Control extends string = never, Values = unknown>
  extends BaseField<"array", Control, Values> {
  readonly item: FormNode<Control, Values>;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly uniqueItems: boolean;
}

export interface UnsupportedField<Control extends string = never, Values = unknown>
  extends BaseField<"unsupported", Control, Values> {
  readonly reason: string;
}

export type FormNode<Control extends string = never, Values = unknown> =
  | ScalarField<Control, Values>
  | ObjectField<Control, Values>
  | ArrayField<Control, Values>
  | UnsupportedField<Control, Values>;

export interface FormModel<Input = unknown, Control extends string = never> {
  readonly root: FormNode<Control, Input>;
  readonly fields: readonly FormNode<Control, Input>[];
  readonly fieldMap: Readonly<Record<string, FormNode<Control, Input>>>;
}
