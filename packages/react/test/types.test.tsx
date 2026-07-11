import type { ReactNode } from "react";
import { type as arkType } from "arktype";
import { expectTypeOf, it } from "vitest";
import { z } from "zod";

import type { BuiltInControl, FormModel } from "@formadapter/core";

import {
  createAdapter,
  createForm as createProviderForm,
  createFormFactory,
  localStorageDraftAdapter,
  useFormModel,
  type ArrayItemSlotProps,
  type ArraySlotProps,
  type ButtonSlotProps,
  type ControlProps,
  type ErrorSummarySlotProps,
  type FieldSlotProps,
  type FormMessageSlotProps,
  type FormSlotProps,
  type GroupSlotProps,
  type UnsupportedSlotProps,
  type WizardSlotProps,
} from "../src";

const Empty = (): null => null;
const adapter = createAdapter({
  name: "types",
  controls: {
    checkbox: Empty,
    custom: { rating: Empty },
    file: Empty,
    input: Empty,
    radio: Empty,
    select: Empty,
    textarea: Empty,
  },
  slots: {
    Array: Empty as (props: ArraySlotProps) => ReactNode,
    ArrayItem: Empty as (props: ArrayItemSlotProps) => ReactNode,
    Button: Empty as (props: ButtonSlotProps) => ReactNode,
    ErrorSummary: Empty as (props: ErrorSummarySlotProps) => ReactNode,
    Field: Empty as (props: FieldSlotProps) => ReactNode,
    Form: Empty as (props: FormSlotProps) => ReactNode,
    FormMessage: Empty as (props: FormMessageSlotProps) => ReactNode,
    Group: Empty as (props: GroupSlotProps) => ReactNode,
    Unsupported: Empty as (props: UnsupportedSlotProps) => ReactNode,
    Wizard: Empty as (props: WizardSlotProps) => ReactNode,
  },
});
const createForm = createFormFactory(adapter);

it("preserves schema input/output, paths, hooks, and custom control types", () => {
  const schema = z.object({
    profile: z.object({ email: z.email() }),
    score: z.string().transform((value) => Number(value)),
  });
  const Bound = createForm(schema).configure({
    fields: {
      score: { control: "rating" },
    },
  });

  const valid = (
    <Bound.Form
      defaultValues={{ profile: { email: "ada@example.com" }, score: "4" }}
      onSubmit={(values) => {
        expectTypeOf(values.profile.email).toEqualTypeOf<string>();
        expectTypeOf(values.score).toEqualTypeOf<number>();
      }}
    >
      <Bound.Field name="profile.email" />
    </Bound.Form>
  );
  expectTypeOf(valid).toMatchTypeOf<ReactNode>();

  // @ts-expect-error defaults use schema input, before the string-to-number transform
  const badDefaults = <Bound.Form defaultValues={{ score: 4 }} />;
  // @ts-expect-error field paths are derived from the schema
  const badPath = <Bound.Field name="profile.missing" />;
  // @ts-expect-error custom controls are inferred from the adapter registry
  createForm(schema).configure({ fields: { score: { control: "stars" } } });
  // @ts-expect-error "input" is an adapter registry key, not a semantic control
  createForm(schema).configure({ fields: { score: { control: "input" } } });
  void badDefaults;
  void badPath;

  function Inspector(): null {
    const email = Bound.useField("profile.email");
    expectTypeOf(email.value).toEqualTypeOf<string>();
    const model = Bound.useFormModel();
    expectTypeOf(model).toEqualTypeOf<
      FormModel<z.input<typeof schema>, "rating">
    >();
    expectTypeOf(model.fieldMap.score?.config.control).toEqualTypeOf<
      BuiltInControl | "rating" | undefined
    >();
    const form = Bound.useFormState();
    expectTypeOf(form.values.profile?.email).toEqualTypeOf<
      string | undefined
    >();
    form.setValue("profile.email", "grace@example.com");
    form.reset({ profile: { email: "ada@example.com" }, score: "4" });
    // @ts-expect-error field values follow the schema input type
    form.setValue("profile.email", 42);
    // @ts-expect-error form state paths are derived from the schema
    form.setValue("profile.missing", "nope");
    return null;
  }
  expectTypeOf(Inspector).toBeFunction();

  function GenericInspector(): null {
    const model = useFormModel();
    expectTypeOf(model).toEqualTypeOf<FormModel<unknown, string>>();
    return null;
  }
  expectTypeOf(GenericInspector).toBeFunction();

  const typedOptions = (
    <Bound.Field
      name="score"
      options={[{ label: "Four", value: "4" }]}
    />
  );
  expectTypeOf(typedOptions).toMatchTypeOf<ReactNode>();
  // @ts-expect-error render-time options use this field's schema input type
  const wrongOption = <Bound.Field name="score" options={[{ label: "Four", value: 4 }]} />;
  void wrongOption;

  const arkSchema = arkType({ age: "number.integer", email: "string.email" });
  const ArkForm = createForm(arkSchema);
  const arkElement = (
    <ArkForm.Form
      onSubmit={(values) => {
        expectTypeOf(values.age).toEqualTypeOf<number>();
        expectTypeOf(values.email).toEqualTypeOf<string>();
      }}
    />
  );
  expectTypeOf(arkElement).toMatchTypeOf<ReactNode>();
});

it("keeps the value-oriented control contract DOM-library neutral", () => {
  expectTypeOf<ControlProps["onValueChange"]>().toEqualTypeOf<
    (value: unknown) => void
  >();
});

it("distinguishes schema array templates from concrete runtime paths", () => {
  const Collection = createForm(z.object({
    items: z.array(z.object({
      flags: z.array(z.boolean()),
      name: z.string(),
    })),
  }));

  const arrayField = <Collection.Field name="items" />;
  expectTypeOf(arrayField).toMatchTypeOf<ReactNode>();

  // @ts-expect-error array-item templates configure generated items; they are not renderable paths
  const templateField = <Collection.Field name="items[].name" />;
  // @ts-expect-error a wizard owns the parent array, not an unindexed generated item
  const templateStep = <Collection.Step fields={["items[].name"]} title="Items"><div /></Collection.Step>;
  // @ts-expect-error conditions outside an item scope cannot read an unindexed array item
  const templateCondition = <Collection.When field="items[].name" equals="Ada" />;
  void templateField;
  void templateStep;
  void templateCondition;

  function Inspector(): null {
    const itemName = Collection.useField("items.0.name");
    const secondFlag = Collection.useField("items.0.flags.1");
    expectTypeOf(itemName.value).toEqualTypeOf<string>();
    expectTypeOf(secondFlag.value).toEqualTypeOf<boolean>();

    const form = Collection.useFormState();
    form.setValue("items.0.name", "Ada");
    form.setValue("items.0.flags.1", true);
    // @ts-expect-error runtime hooks require a concrete array index
    form.setValue("items[].name", "Ada");
    // @ts-expect-error concrete path values retain the array item's schema type
    form.setValue("items.0.flags.1", "true");
    // @ts-expect-error useField also requires a concrete array index
    Collection.useField("items[].name");
    return null;
  }
  expectTypeOf(Inspector).toBeFunction();
});

it("types conditions, wizard paths, async validators, and submission transports", () => {
  const schema = z.object({
    accountType: z.enum(["personal", "business"]),
    company: z.string().optional(),
    score: z.string().transform(Number),
  });
  const Bound = createForm(schema).configure({
    fields: {
      company: {
        asyncValidate: (value, values, context) => {
          expectTypeOf(value).toEqualTypeOf<string | undefined>();
          expectTypeOf(values.accountType).toEqualTypeOf<"personal" | "business" | undefined>();
          expectTypeOf(context.signal.aborted).toEqualTypeOf<boolean>();
          return undefined;
        },
      },
    },
  });

  const valid = (
    <Bound.Form
      onSubmit={(output, context) => {
        expectTypeOf(output.score).toEqualTypeOf<number>();
        expectTypeOf(context.input.score).toEqualTypeOf<string>();
        expectTypeOf(context.formData).toEqualTypeOf<FormData>();
      }}
    >
      <Bound.When field="accountType" equals="business">
        <Bound.Field name="company" />
      </Bound.When>
    </Bound.Form>
  );
  expectTypeOf(valid).toMatchTypeOf<ReactNode>();

  const wizard = (
    <Bound.Wizard>
      <Bound.Step title="Account">
        <Bound.Fields names={["accountType", "company"]} />
      </Bound.Step>
    </Bound.Wizard>
  );
  expectTypeOf(wizard).toMatchTypeOf<ReactNode>();

  const persisted = (
    <Bound.Form
      draft={{ adapter: localStorageDraftAdapter, key: "typed-profile" }}
    />
  );
  expectTypeOf(persisted).toMatchTypeOf<ReactNode>();

  // @ts-expect-error equality values follow the selected field type
  const wrongCondition = <Bound.When field="accountType" equals="enterprise" />;
  // @ts-expect-error wizard fields use schema-derived paths
  const wrongWizard = <Bound.Step fields={["missing"]} title="Nope"><div /></Bound.Step>;
  // @ts-expect-error the legacy object-list wizard API was replaced by compositional steps
  const legacyWizard = <Bound.Wizard steps={[]} />;
  // @ts-expect-error native actions and callback submissions are mutually exclusive
  const competingSubmissions = <Bound.Form action={async () => ({ status: "idle" })} onSubmit={() => undefined} />;
  void wrongCondition;
  void wrongWizard;
  void legacyWizard;
  void competingSubmissions;

  const ProviderBound = createProviderForm(schema, {
    fields: { company: { control: "design-system-control" } },
  });
  expectTypeOf(ProviderBound.Form).toBeFunction();
});
