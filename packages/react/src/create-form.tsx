"use client";

import type { ReactNode } from "react";

import type {
  FieldConfig,
  FormConfig,
  FormModel,
  FormSchema,
  InferInput,
} from "@formadapter/core";

import type {
  AdapterControlName,
  AnyFormAdapter,
} from "./adapter";
import {
  RuntimeField,
  RuntimeFields,
  RuntimeSubmit,
} from "./bound-parts";
import {
  FIELD_COMPONENT,
  FIELDS_COMPONENT,
  STEP_COMPONENT,
  WHEN_COMPONENT,
  markComponent,
} from "./composition-markers";
import { SchemaForm, type SchemaFormProps } from "./schema-form";
import {
  useFormField,
  useFormModel as useRuntimeFormModel,
  useFormState as useRuntimeFormState,
  type BoundFormState,
  type FormAdapterFieldState,
} from "./hooks";
import type { ConcreteFieldPath, ConcretePathValue } from "./paths";
import { RuntimeWhen } from "./when";
import { RuntimeWizard } from "./wizard";
import type {
  BoundFieldProps,
  BoundFieldsProps,
  BoundFormProps,
  BoundSubmitProps,
  BoundStepProps,
  BoundWhenProps,
  BoundWizardProps,
  CreateForm,
  CreatedForm,
} from "./types";

function mergeFieldConfig(
  base: FieldConfig<string, unknown> | undefined,
  next: FieldConfig<string, unknown>,
): FieldConfig<string, unknown> {
  return {
    ...base,
    ...next,
    ...(base?.array || next.array
      ? { array: { ...base?.array, ...next.array } }
      : {}),
    ...(base?.controlProps || next.controlProps
      ? { controlProps: { ...base?.controlProps, ...next.controlProps } }
      : {}),
  };
}

function mergeFormConfig<Input, Control extends string>(
  base: FormConfig<Input, Control>,
  next: FormConfig<Input, Control>,
): FormConfig<Input, Control> {
  const baseFields = base.fields as Readonly<Record<
    string,
    FieldConfig<string, unknown> | undefined
  >> | undefined;
  const nextFields = next.fields as Readonly<Record<
    string,
    FieldConfig<string, unknown> | undefined
  >> | undefined;
  const fields: Record<string, FieldConfig<string, unknown> | undefined> = {
    ...baseFields,
  };
  for (const [path, field] of Object.entries(nextFields ?? {})) {
    const baseField = baseFields &&
        Object.prototype.hasOwnProperty.call(baseFields, path)
      ? baseFields[path]
      : undefined;
    Object.defineProperty(fields, path, {
      configurable: true,
      enumerable: true,
      value: field === undefined
        ? undefined
        : mergeFieldConfig(baseField, field),
      writable: true,
    });
  }

  const baseJsonSchema = base.jsonSchema;
  const nextJsonSchema = next.jsonSchema;
  const jsonSchema = baseJsonSchema || nextJsonSchema
    ? {
        ...baseJsonSchema,
        ...nextJsonSchema,
        ...(baseJsonSchema?.libraryOptions || nextJsonSchema?.libraryOptions
          ? {
              libraryOptions: {
                ...baseJsonSchema?.libraryOptions,
                ...nextJsonSchema?.libraryOptions,
              },
            }
          : {}),
      }
    : undefined;

  return {
    ...base,
    ...next,
    ...(baseFields || nextFields
      ? {
          fields: fields as NonNullable<
            FormConfig<Input, Control>["fields"]
          >,
        }
      : {}),
    ...(jsonSchema ? { jsonSchema } : {}),
  };
}

export function createFormFactory(): CreateForm<AnyFormAdapter>;
export function createFormFactory<TAdapter extends AnyFormAdapter>(
  adapter: TAdapter,
): CreateForm<TAdapter>;
export function createFormFactory<TAdapter extends AnyFormAdapter>(
  adapter?: TAdapter,
): CreateForm<TAdapter> {
  return function createForm<const TSchema extends FormSchema>(
    schema: TSchema,
    providedConfig?: FormConfig<
      InferInput<TSchema>,
      AdapterControlName<TAdapter>
    >,
  ): CreatedForm<TSchema, TAdapter> {
    const config = providedConfig ?? {};
    const compositionOwner = {};

    function Form<Data = unknown>(props: BoundFormProps<TSchema, Data>): ReactNode {
      return (
        <SchemaForm<TSchema, TAdapter, Data>
          {...props}
          baseAdapter={adapter}
          config={config as FormConfig<InferInput<TSchema>, string>}
          schema={schema}
        />
      );
    }

    function Field({
      name,
      className,
      options,
    }: BoundFieldProps<TSchema>): ReactNode {
      return <RuntimeField className={className} name={name} options={options} />;
    }

    function Fields({
      names,
      className,
    }: BoundFieldsProps<TSchema>): ReactNode {
      return <RuntimeFields className={className} names={names} />;
    }

    function Submit(props: BoundSubmitProps): ReactNode {
      return <RuntimeSubmit {...props} />;
    }

    function Step(_props: BoundStepProps<TSchema>): ReactNode {
      throw new Error("Step can only be used as a direct child of Wizard.");
    }

    function When(props: BoundWhenProps<TSchema>): ReactNode {
      return <RuntimeWhen {...props} />;
    }

    function Wizard<Data = unknown>({
      children,
      includeRemaining = true,
      nextLabel = "Next",
      previousLabel = "Back",
      remainingTitle = "Remaining fields",
      ...props
    }: BoundWizardProps<TSchema, Data>): ReactNode {
      const schemaFormProps = {
        ...props,
        baseAdapter: adapter,
        children: (
          <RuntimeWizard
            compositionOwner={compositionOwner}
            includeRemaining={includeRemaining}
            nextLabel={nextLabel}
            previousLabel={previousLabel}
            remainingTitle={remainingTitle}
          >
            {children}
          </RuntimeWizard>
        ),
        config: config as FormConfig<InferInput<TSchema>, string>,
        schema,
      } as unknown as SchemaFormProps<TSchema, TAdapter, Data>;
      return <SchemaForm<TSchema, TAdapter, Data> {...schemaFormProps} />;
    }

    function useField<TPath extends ConcreteFieldPath<InferInput<TSchema>>>(
      name: TPath,
    ): FormAdapterFieldState<ConcretePathValue<InferInput<TSchema>, TPath>> {
      return useFormField(name);
    }

    function useBoundFormState(): BoundFormState<InferInput<TSchema>> {
      return useRuntimeFormState() as unknown as BoundFormState<
        InferInput<TSchema>
      >;
    }

    function useBoundFormModel(): FormModel<
      InferInput<TSchema>,
      AdapterControlName<TAdapter>
    > {
      return useRuntimeFormModel() as FormModel<
        InferInput<TSchema>,
        AdapterControlName<TAdapter>
      >;
    }

    markComponent(Field, FIELD_COMPONENT, compositionOwner);
    markComponent(Fields, FIELDS_COMPONENT, compositionOwner);
    markComponent(Step, STEP_COMPONENT, compositionOwner);
    markComponent(When, WHEN_COMPONENT, compositionOwner);

    return {
      config,
      configure: (nextConfig) =>
        createForm(schema, mergeFormConfig(config, nextConfig)),
      Field,
      Fields,
      Form,
      schema,
      Step,
      Submit,
      When,
      Wizard,
      useField,
      useFormModel: useBoundFormModel,
      useFormState: useBoundFormState,
    };
  };
}

/** Creates forms that resolve their adapter from the nearest provider at render time. */
export const createForm: CreateForm<AnyFormAdapter> = createFormFactory();
