/** A Standard Schema issue. Kept structural so schema libraries remain optional. */
export interface StandardIssue {
  readonly message: string;
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined;
}

export interface StandardSuccess<Output> {
  readonly value: Output;
  readonly issues?: undefined;
}

export interface StandardFailure {
  readonly issues: ReadonlyArray<StandardIssue>;
}

export type StandardResult<Output> = StandardSuccess<Output> | StandardFailure;

export interface StandardTypes<Input = unknown, Output = Input> {
  readonly input: Input;
  readonly output: Output;
}

export interface StandardJSONSchemaOptions {
  readonly target: "draft-2020-12" | "draft-07" | "openapi-3.0" | (string & {});
  readonly libraryOptions?: Readonly<Record<string, unknown>> | undefined;
}

export interface FormSchema<Input = unknown, Output = Input> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly types?: StandardTypes<Input, Output> | undefined;
    readonly validate: (
      value: unknown,
      options?: { readonly libraryOptions?: Readonly<Record<string, unknown>> | undefined },
    ) => StandardResult<Output> | Promise<StandardResult<Output>>;
    readonly jsonSchema: {
      readonly input: (options: StandardJSONSchemaOptions) => Record<string, unknown>;
      readonly output: (options: StandardJSONSchemaOptions) => Record<string, unknown>;
    };
  };
}

export type InferInput<Schema extends FormSchema> = NonNullable<
  Schema["~standard"]["types"]
>["input"];

export type InferOutput<Schema extends FormSchema> = NonNullable<
  Schema["~standard"]["types"]
>["output"];
