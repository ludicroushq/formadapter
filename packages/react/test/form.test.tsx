import { StrictMode, useId, useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { z } from "zod";

import {
  submissionFailure,
  submissionSuccess,
  type AsyncFieldValidationContext,
  type AsyncFieldValidationSignal,
} from "@formadapter/core";

import {
  FormAdapterProvider,
  createAdapter,
  createForm as createProviderForm,
  createFormFactory,
  useFormModel,
  useFormState,
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
import { SchemaForm } from "../src/schema-form";

function InputControl({
  controlRef,
  field,
  inputProps,
  onValueChange,
  value,
  ...props
}: ControlProps): ReactNode {
  return (
    <input
      {...inputProps}
      disabled={props.disabled}
      id={props.id}
      name={props.name}
      onBlur={props.onBlur}
      onChange={(event) => onValueChange(event.currentTarget.value)}
      readOnly={props.readOnly}
      ref={controlRef}
      required={props.required}
      type={field.inputType ?? (field.dataType === "number" ? "number" : "text")}
      value={typeof value === "string" || typeof value === "number" ? value : ""}
    />
  );
}

function TextareaControl({
  controlRef,
  inputProps,
  onValueChange,
  value,
  ...props
}: ControlProps): ReactNode {
  return (
    <textarea
      {...inputProps}
      disabled={props.disabled}
      id={props.id}
      name={props.name}
      onBlur={props.onBlur}
      onChange={(event) => onValueChange(event.currentTarget.value)}
      readOnly={props.readOnly}
      ref={controlRef}
      required={props.required}
      value={typeof value === "string" ? value : ""}
    />
  );
}

function SelectControl({
  controlRef,
  field,
  inputProps,
  onValueChange,
  value,
  ...props
}: ControlProps): ReactNode {
  return (
    <select
      {...inputProps}
      disabled={props.disabled}
      id={props.id}
      name={props.name}
      onBlur={props.onBlur}
      onChange={(event) => onValueChange(event.currentTarget.value)}
      required={props.required}
      ref={controlRef}
      value={value === undefined ? "" : String(value)}
    >
      <option value="">Choose</option>
      {field.options?.map((option) => (
        <option key={String(option.value)} value={String(option.value)}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function RadioControl({
  controlRef,
  field,
  name,
  onBlur,
  onValueChange,
  value,
}: ControlProps): ReactNode {
  return (
    <div role="radiogroup">
      {field.options?.map((option, index) => (
        <label key={String(option.value)}>
          <input
            checked={value === option.value}
            name={name}
            onBlur={onBlur}
            onChange={() => onValueChange(option.value)}
            ref={index === 0 ? controlRef : undefined}
            type="radio"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

function CheckboxControl({
  controlRef,
  id,
  inputProps,
  name,
  onBlur,
  onValueChange,
  value,
}: ControlProps): ReactNode {
  return (
    <input
      {...inputProps}
      checked={Boolean(value)}
      id={id}
      name={name}
      onBlur={onBlur}
      onChange={(event) => onValueChange(event.currentTarget.checked)}
      ref={controlRef}
      type="checkbox"
    />
  );
}

function FileControl(props: ControlProps): ReactNode {
  return (
    <input
      id={props.id}
      name={props.name}
      onBlur={props.onBlur}
      onChange={(event) => props.onValueChange(event.currentTarget.files?.[0])}
      ref={props.controlRef}
      type="file"
    />
  );
}

function FormSlot({ children, ...props }: FormSlotProps): ReactNode {
  return <form {...props}>{children}</form>;
}

function FieldSlot({
  children,
  controlId,
  descriptionId,
  error,
  errorId,
  field,
}: FieldSlotProps): ReactNode {
  return (
    <div>
      <label htmlFor={controlId}>{field.label}</label>
      {children}
      {field.description ? <p id={descriptionId}>{field.description}</p> : null}
      {error ? <p id={errorId}>{error}</p> : null}
    </div>
  );
}

function GroupSlot({
  children,
  disabled,
  error,
  errorId,
  field,
  readOnly,
  required,
  ...props
}: GroupSlotProps): ReactNode {
  const describedBy = [
    props["aria-describedby"],
    error ? errorId : undefined,
  ].filter(Boolean).join(" ") || undefined;

  return (
    <fieldset
      {...props}
      aria-describedby={describedBy}
      aria-disabled={disabled || undefined}
      aria-invalid={error ? true : undefined}
      aria-readonly={readOnly || undefined}
      aria-required={required || undefined}
      data-invalid={error ? true : undefined}
    >
      <legend>{field.label}</legend>
      {children}
      {error ? <p id={errorId} role="alert">{error}</p> : null}
    </fieldset>
  );
}

function ArraySlot({ actions, children, field }: ArraySlotProps): ReactNode {
  return (
    <fieldset>
      <legend>{field.label}</legend>
      {children}
      {actions}
    </fieldset>
  );
}

function ArrayItemSlot({ actions, children, label }: ArrayItemSlotProps): ReactNode {
  return (
    <section aria-label={label}>
      {children}
      {actions}
    </section>
  );
}

function ButtonSlot(props: ButtonSlotProps): ReactNode {
  return (
    <button disabled={props.disabled} onClick={props.onClick} type={props.type}>
      {props.children}
    </button>
  );
}

function ErrorSummarySlot({
  errors,
  items,
  onSelect,
  title,
}: ErrorSummarySlotProps): ReactNode {
  const resolvedItems: NonNullable<ErrorSummarySlotProps["items"]> =
    items ?? errors.map((message) => ({ message }));
  return (
    <div role="alert">
      {title}:{" "}
      {resolvedItems.map((item, index) => {
        const focusPath = item.focusPath;
        return focusPath && onSelect ? (
          <button
            key={`${item.message}-${index}`}
            onClick={() => onSelect(focusPath)}
            type="button"
          >
            {item.message}
          </button>
        ) : <span key={`${item.message}-${index}`}>{item.message}</span>;
      })}
    </div>
  );
}

function FormMessageSlot({ kind, message }: FormMessageSlotProps): ReactNode {
  return <p data-kind={kind}>{message}</p>;
}

function WizardSlot({ children, navigation, title }: WizardSlotProps): ReactNode {
  return <section aria-label={title}>{children}{navigation}</section>;
}

function UnsupportedSlot({ reason }: UnsupportedSlotProps): ReactNode {
  return <p>Unsupported: {reason}</p>;
}

const testAdapter = createAdapter({
  name: "test",
  controls: {
    checkbox: CheckboxControl,
    custom: {},
    file: FileControl,
    input: InputControl,
    radio: RadioControl,
    select: SelectControl,
    textarea: TextareaControl,
  },
  slots: {
    Array: ArraySlot,
    ArrayItem: ArrayItemSlot,
    Button: ButtonSlot,
    ErrorSummary: ErrorSummarySlot,
    Field: FieldSlot,
    Form: FormSlot,
    FormMessage: FormMessageSlot,
    Group: GroupSlot,
    Unsupported: UnsupportedSlot,
    Wizard: WizardSlot,
  },
});

const createForm = createFormFactory(testAdapter);

describe("bound schema forms", () => {
  it("layers repeated configuration without losing earlier field settings", () => {
    const Profile = createForm(z.object({
      email: z.email(),
      name: z.string(),
    }), {
      fields: {
        name: {
          controlProps: { autoComplete: "name" },
          label: "Full name",
        },
      },
      jsonSchema: { libraryOptions: { first: true } },
    }).configure({
      fields: {
        email: { label: "Work email" },
        name: {
          controlProps: { "data-layered": "true" },
          description: "Use your legal name.",
        },
      },
      jsonSchema: { libraryOptions: { second: true } },
    });

    render(<Profile.Form />);

    expect(screen.getByLabelText("Full name")).toBeVisible();
    expect(Profile.config.fields?.name?.controlProps).toEqual({
      autoComplete: "name",
      "data-layered": "true",
    });
    expect(screen.getByText("Use your legal name.")).toBeVisible();
    expect(screen.getByLabelText("Work email")).toBeVisible();
    expect(Profile.config.jsonSchema?.libraryOptions).toEqual({
      first: true,
      second: true,
    });
  });

  it("preserves registered defaults through React StrictMode effect replay", async () => {
    const user = userEvent.setup();
    const submitted = vi.fn<(value: unknown) => void>();
    const Profile = createForm(z.object({ name: z.string() }));

    render(
      <StrictMode>
        <Profile.Form defaultValues={{ name: "Ada" }} onSubmit={submitted} />
      </StrictMode>,
    );
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(submitted).toHaveBeenCalledWith(
      { name: "Ada" },
      expect.any(Object),
    ));
  });

  it("aborts pending field validators when the model changes and on unmount", async () => {
    const user = userEvent.setup();
    let firstStarted!: () => void;
    const firstValidatorStarted = new Promise<void>((resolve) => {
      firstStarted = resolve;
    });
    let secondStarted!: () => void;
    const secondValidatorStarted = new Promise<void>((resolve) => {
      secondStarted = resolve;
    });
    let firstSignal: AsyncFieldValidationSignal | undefined;
    let secondSignal: AsyncFieldValidationSignal | undefined;
    const schema = z.object({ username: z.string() });
    const firstConfig = {
      fields: {
        username: {
          asyncValidationDebounceMs: 0,
          asyncValidate: async (
            _value: unknown,
            _values: unknown,
            context: AsyncFieldValidationContext,
          ) => {
            firstSignal = context.signal;
            firstStarted();
            return new Promise<undefined>(() => undefined);
          },
        },
      },
    };
    const secondConfig = {
      fields: {
        username: {
          asyncValidationDebounceMs: 0,
          asyncValidate: async (
            _value: unknown,
            _values: unknown,
            context: AsyncFieldValidationContext,
          ) => {
            secondSignal = context.signal;
            secondStarted();
            return new Promise<undefined>(() => undefined);
          },
        },
      },
    };
    const view = render(
      <SchemaForm
        baseAdapter={testAdapter}
        config={firstConfig}
        mode="onChange"
        schema={schema}
      />,
    );

    await user.type(screen.getByLabelText("Username"), "a");
    await firstValidatorStarted;
    view.rerender(
      <SchemaForm
        baseAdapter={testAdapter}
        config={secondConfig}
        mode="onChange"
        schema={schema}
      />,
    );
    expect(firstSignal?.aborted).toBe(true);

    await user.type(screen.getByLabelText("Username"), "b");
    await secondValidatorStarted;
    view.unmount();
    expect(secondSignal?.aborted).toBe(true);
  });

  it("renders inferred controls, validates, and submits typed output", async () => {
    const user = userEvent.setup();
    const submitted = vi.fn<(value: unknown) => void>();
    const invalid = vi.fn<(errors: Readonly<Record<string, readonly string[]>>) => void>();
    const schema = z.object({
      age: z.number().int().min(18, "Adults only").meta({ title: "Age" }),
      bio: z.string().optional().meta({ title: "Biography" }),
      name: z.string().min(2, "Use at least two characters").meta({ title: "Name" }),
      role: z.enum(["author", "editor"]).meta({ title: "Role" }),
      terms: z.literal(true).meta({ title: "Accept terms" }),
    });
    const Profile = createForm(schema, {
      fields: {
        bio: { control: "textarea" },
        role: { control: "radio" },
      },
    });

    render(
      <Profile.Form
        adapter={testAdapter.extend({ name: "local-test" })}
        defaultValues={{ age: 12 }}
        onInvalid={invalid}
        onSubmit={submitted}
        resetOnSuccess
      />,
    );
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect((await screen.findAllByText(/Use at least two characters/))[0]).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Adults only");
    expect(screen.getByLabelText("Age")).toHaveFocus();
    expect(invalid).toHaveBeenCalledOnce();

    await user.type(screen.getByRole("textbox", { name: "Name" }), "Ada");
    await user.clear(screen.getByLabelText("Age"));
    await user.type(screen.getByLabelText("Age"), "36");
    await user.type(screen.getByLabelText("Biography"), "Builds analytical engines");
    await user.click(screen.getByLabelText("Editor"));
    await user.click(screen.getByLabelText("Accept terms"));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(submitted.mock.calls[0]?.[0]).toEqual({
        age: 36,
        bio: "Builds analytical engines",
        name: "Ada",
        role: "editor",
        terms: true,
      });
    });
    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue(""));
  });

  it("preserves pristine optional values instead of synthesizing user input", async () => {
    const user = userEvent.setup();
    const submitted = vi.fn<(value: unknown) => void>();
    const Optional = createForm(
      z.object({
        flag: z.boolean().optional(),
        settings: z.object({ name: z.string() }).optional(),
        tags: z.array(z.string()).optional(),
      }),
    );

    render(<Optional.Form onSubmit={submitted} />);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(submitted.mock.calls[0]?.[0]).toEqual({}));
  });

  it("keeps RFC 3339 date-times as text unless conversion is explicit", async () => {
    const user = userEvent.setup();
    const submitted = vi.fn<(value: unknown) => void>();
    const Audit = createForm(z.object({ createdAt: z.iso.datetime() }));

    render(
      <Audit.Form
        defaultValues={{ createdAt: "2026-09-15T12:00:00Z" }}
        onSubmit={submitted}
      />,
    );
    const input = screen.getByLabelText("Created At");
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveValue("2026-09-15T12:00:00Z");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() =>
      expect(submitted.mock.calls[0]?.[0]).toEqual({
        createdAt: "2026-09-15T12:00:00Z",
      }),
    );
  });

  it("renders date inputs while preserving schema transforms to Date output", async () => {
    const user = userEvent.setup();
    const submitted = vi.fn<(value: unknown) => void>();
    const Schedule = createForm(z.object({
      startsOn: z.iso.date().pipe(z.coerce.date()),
    }));

    render(<Schedule.Form onSubmit={submitted} />);
    const input = screen.getByLabelText("Starts On");
    expect(input).toHaveAttribute("type", "date");
    await user.type(input, "2026-07-09");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => {
      const value = submitted.mock.calls[0]?.[0] as { startsOn?: unknown } | undefined;
      expect(value?.startsOn).toEqual(new Date("2026-07-09T00:00:00.000Z"));
    });
  });

  it("renders exactly the fields in an explicit layout", () => {
    const schema = z.object({
      email: z.email().meta({ title: "Email" }),
      name: z.string().meta({ title: "Name" }),
    });
    const Contact = createForm(schema).configure({
      fields: { name: { label: "Display name" } },
    });

    render(
      <Contact.Form>
        <Contact.Fields className="manual-grid" names={["name"]} />
        <Contact.Submit>Save contact</Contact.Submit>
      </Contact.Form>,
    );

    expect(screen.getByLabelText("Display name")).toBeVisible();
    expect(screen.getByLabelText("Display name").closest(".manual-grid")).not.toBeNull();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save contact" })).toBeVisible();
  });

  it("adds, reorders, and removes object-array items", async () => {
    const user = userEvent.setup();
    const submitted = vi.fn<(value: unknown) => void>();
    const schema = z.object({
      people: z.array(
        z.object({ name: z.string().min(1).meta({ title: "Person name" }) }),
      ).min(1).default([{ name: "Ada" }]).meta({ title: "People" }),
    });
    const Team = createForm(schema);

    render(<Team.Form onSubmit={submitted} />);
    await user.click(screen.getByRole("button", { name: "Add people" }));
    const items = screen.getAllByRole("region");
    expect(items).toHaveLength(2);
    await user.type(within(items[1]!).getByLabelText("Person name"), "Grace");
    await user.click(within(items[1]!).getByRole("button", { name: "Move up" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(submitted.mock.calls[0]?.[0]).toEqual({
        people: [{ name: "Grace" }, { name: "Ada" }],
      });
    });

    await user.click(within(screen.getAllByRole("region")[1]!).getByRole("button", { name: "Remove" }));
    expect(screen.getAllByRole("region")).toHaveLength(1);
  });

  it("propagates disabled and read-only group state to descendants", () => {
    const schema = z.object({
      profile: z.object({
        name: z.string().meta({ title: "Profile name" }),
      }),
      people: z
        .array(
          z.object({
            name: z.string().meta({ title: "Person name" }),
          }),
        )
        .default([{ name: "Grace" }])
        .meta({ title: "People" }),
    });
    const Team = createForm(schema).configure({
      fields: {
        people: { readOnly: true },
        profile: { disabled: true },
      },
    });

    render(<Team.Form defaultValues={{ profile: { name: "Ada" } }} />);

    expect(screen.getByLabelText("Profile name")).toBeDisabled();
    expect(screen.getByLabelText("Person name")).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Add people" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("supports custom controls and complete provider replacements", async () => {
    const user = userEvent.setup();
    const submitted = vi.fn<(value: unknown) => void>();

    function Rating({ onValueChange, value }: ControlProps): ReactNode {
      return (
        <button type="button" onClick={() => onValueChange(5)}>
          Rating {String(value ?? 0)}
        </button>
      );
    }

    function LoudButton(props: ButtonSlotProps): ReactNode {
      return <button data-loud="true" disabled={props.disabled} type={props.type}>{props.children}</button>;
    }

    const customAdapter = testAdapter.extend({
      controls: { custom: { rating: Rating } },
      name: "custom-test",
    });
    const createCustomForm = createFormFactory(customAdapter);
    const Survey = createCustomForm(
      z.object({ score: z.number().min(1).max(5).default(1) }),
      { fields: { score: { control: "rating" } } },
    );

    render(
      <FormAdapterProvider adapter={customAdapter.extend({ slots: { Button: LoudButton } })}>
        <Survey.Form onSubmit={submitted} />
      </FormAdapterProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Rating 1" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByRole("button", { name: "Submit" })).toHaveAttribute("data-loud", "true");
    await waitFor(() => expect(submitted.mock.calls[0]?.[0]).toEqual({ score: 5 }));
  });

  it("exposes form and field hooks inside a bound form", async () => {
    const user = userEvent.setup();
    const schema = z.object({ name: z.string().default("Ada") });
    const Profile = createForm(schema);

    function Inspector(): ReactNode {
      const form = useFormState();
      const name = Profile.useField("name");
      return (
        <div>
          <output>{String(form.values.name)}</output>
          <button type="button" onClick={() => name.setValue("Grace")}>Change name</button>
          <button type="button" onClick={() => form.reset({ name: "Katherine" })}>
            Load person
          </button>
          <button type="button" onClick={() => form.reset()}>Reset form</button>
        </div>
      );
    }

    render(
      <Profile.Form>
        <Profile.Field name="name" />
        <Inspector />
      </Profile.Form>,
    );
    expect(screen.getByText("Ada", { selector: "output" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Change name" }));
    expect(screen.getByText("Grace", { selector: "output" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Load person" }));
    expect(screen.getByText("Katherine", { selector: "output" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Reset form" }));
    expect(screen.getByText("Katherine", { selector: "output" })).toBeVisible();
  });

  it("exposes one compiled model through generic and schema-bound hooks", () => {
    const Profile = createForm(z.object({ name: z.string().default("Ada") }));
    let genericModel: ReturnType<typeof useFormModel> | undefined;
    let boundModel: ReturnType<typeof Profile.useFormModel> | undefined;

    function Inspector(): null {
      genericModel = useFormModel();
      boundModel = Profile.useFormModel();
      return null;
    }

    render(
      <Profile.Form>
        <Inspector />
      </Profile.Form>,
    );

    expect(genericModel).toBe(boundModel);
    expect(boundModel?.root.kind).toBe("object");
    expect(boundModel?.fieldMap.name).toMatchObject({
      dataType: "string",
      kind: "scalar",
      path: "name",
    });
  });

  it("renders explicit diagnostics for unsupported roots, paths, and controls", () => {
    const ScalarRoot = createForm(z.string());
    const Odd = createForm(
      z.object({
        mystery: z.any(),
        name: z.string(),
        people: z.array(z.string()).default([]),
      }),
    ).configure({
      fields: {
        name: { control: "missing-control" as never },
        people: { hidden: true },
      },
    });

    const { unmount } = render(<ScalarRoot.Form />);
    expect(screen.getByText(/requires an object schema at the root/)).toBeVisible();
    unmount();

    render(
      <Odd.Form>
        <Odd.Field name={"missing" as never} />
        <Odd.Field name="mystery" />
        <Odd.Field name="name" />
        <Odd.Field name={"people[]" as never} />
      </Odd.Form>,
    );
    expect(screen.getByText(/No generated field exists/)).toBeVisible();
    expect(screen.getByText(/Unsupported JSON Schema type/)).toBeVisible();
    expect(screen.getByText(/does not provide the “missing-control” control/)).toBeVisible();
    expect(screen.getByText(/needs an item index/)).toBeVisible();
  });

  it("renders diagnostics instead of registering React Hook Form reserved paths", () => {
    const Unsafe = createForm(z.object({
      root: z.string(),
      toString: z.string(),
    }));

    render(<Unsafe.Form />);

    expect(screen.getByText(/Property name “root” is reserved/u)).toBeVisible();
    expect(screen.getByText(/Property name “toString” is reserved/u)).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

describe("common production features", () => {
  it("resolves generic forms from the nearest complete adapter provider", () => {
    function ParentButton(props: ButtonSlotProps): ReactNode {
      return <button data-scope="parent" disabled={props.disabled} type={props.type}>{props.children}</button>;
    }
    function ChildButton(props: ButtonSlotProps): ReactNode {
      return <button data-scope="child" disabled={props.disabled} type={props.type}>{props.children}</button>;
    }
    const parent = testAdapter.extend({ name: "parent", slots: { Button: ParentButton } });
    const child = testAdapter.extend({ name: "child", slots: { Button: ChildButton } });
    const Generic = createProviderForm(z.object({ name: z.string() }));

    render(
      <FormAdapterProvider adapter={parent}>
        <Generic.Form submitLabel="Parent submit" />
        <FormAdapterProvider adapter={child}>
          <Generic.Form submitLabel="Child submit" />
          <Generic.Form adapter={parent} submitLabel="Local submit" />
        </FormAdapterProvider>
      </FormAdapterProvider>,
    );

    expect(screen.getByRole("button", { name: "Parent submit" })).toHaveAttribute("data-scope", "parent");
    expect(screen.getByRole("button", { name: "Child submit" })).toHaveAttribute("data-scope", "child");
    expect(screen.getByRole("button", { name: "Local submit" })).toHaveAttribute("data-scope", "parent");
  });

  it("fails clearly when a provider-resolved form has no adapter", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const Generic = createProviderForm(z.object({ name: z.string() }));
    expect(() => render(<Generic.Form />)).toThrow(/No form adapter is available/u);
  });

  it("fails clearly when runtime hooks are used outside a form", () => {
    function OutsideForm(): null {
      useFormState();
      return null;
    }
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<OutsideForm />)).toThrow(
      /must be rendered inside their bound Form/u,
    );

    function OutsideModel(): null {
      useFormModel();
      return null;
    }
    expect(() => render(<OutsideModel />)).toThrow(
      /must be rendered inside their bound Form/u,
    );
  });

  it("renders typed conditions and enforces requiredWhenVisible", async () => {
    const user = userEvent.setup();
    const submitted = vi.fn<(value: unknown) => void>();
    const Conditional = createForm(
      z.object({
        accountType: z.enum(["personal", "business"]),
        company: z.string().optional(),
      }),
    ).configure({
        fields: {
          company: {
            requiredWhenVisible: (values) => values.accountType === "business",
          },
        },
      });

    render(
      <Conditional.Form onSubmit={submitted}>
        <Conditional.Field name="accountType" />
        <Conditional.When field="accountType" equals="business" fallback={<p>Personal account</p>}>
          <Conditional.Field name="company" />
        </Conditional.When>
        <Conditional.Submit />
      </Conditional.Form>,
    );

    expect(screen.getByText("Personal account")).toBeVisible();
    await user.selectOptions(screen.getByLabelText("Account Type"), "business");
    expect(screen.getByLabelText("Company")).toBeRequired();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect((await screen.findAllByText("Company is required"))[0]).toBeVisible();
    expect(screen.getByLabelText("Company")).toHaveFocus();
    await user.type(
      screen.getByRole("textbox", { name: "Company" }),
      "Analytical Engines",
    );
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(submitted.mock.calls[0]?.[0]).toEqual({
      accountType: "business",
      company: "Analytical Engines",
    }));
  });

  it("renders conditions driven by a whole-form predicate", async () => {
    const user = userEvent.setup();
    const Conditional = createForm(z.object({
      accountType: z.enum(["personal", "business"]),
    }));

    render(
      <Conditional.Form defaultValues={{ accountType: "personal" }}>
        <Conditional.Field name="accountType" />
        <Conditional.When
          fallback={<p>Personal workflow</p>}
          matches={(values) => values.accountType === "business"}
        >
          <p>Business workflow</p>
        </Conditional.When>
      </Conditional.Form>,
    );

    expect(screen.getByText("Personal workflow")).toBeVisible();
    await user.selectOptions(screen.getByLabelText("Account Type"), "business");
    expect(screen.getByText("Business workflow")).toBeVisible();
  });

  it("supports query-backed options at render time", async () => {
    const user = userEvent.setup();
    const submitted = vi.fn<(value: unknown) => void>();
    const Dynamic = createForm(z.object({ project: z.string() }));

    render(
      <Dynamic.Form onSubmit={submitted}>
        <Dynamic.Field
          name="project"
          options={[
            { label: "Analytical Engine", value: "engine" },
            { label: "Difference Engine", value: "difference" },
          ]}
        />
        <Dynamic.Submit />
      </Dynamic.Form>,
    );
    await user.selectOptions(screen.getByLabelText("Project"), "engine");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(submitted.mock.calls[0]?.[0]).toEqual({ project: "engine" }));
  });

  it("preserves an explicitly configured control when options arrive at render time", async () => {
    const user = userEvent.setup();
    const submitted = vi.fn<(value: unknown) => void>();
    const Dynamic = createForm(z.object({ project: z.string() })).configure({
      fields: { project: { control: "radio" } },
    });

    render(
      <Dynamic.Form onSubmit={submitted}>
        <Dynamic.Field
          name="project"
          options={[
            { label: "Analytical Engine", value: "engine" },
            { label: "Difference Engine", value: "difference" },
          ]}
        />
        <Dynamic.Submit />
      </Dynamic.Form>,
    );

    expect(screen.getByRole("radiogroup")).toBeVisible();
    await user.click(screen.getByLabelText("Difference Engine"));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(submitted.mock.calls[0]?.[0]).toEqual({
      project: "difference",
    }));
  });

  it("blocks a stale dependent option when the available choices change", async () => {
    const user = userEvent.setup();
    const submitted = vi.fn<(value: unknown) => void>();
    const Address = createForm(z.object({
      country: z.enum(["us", "ca"]),
      region: z.string().min(1, "Choose a region"),
    }));

    render(
      <Address.Form
        defaultValues={{ country: "us", region: "ny" }}
        onSubmit={submitted}
      >
        <Address.Field name="country" />
        <Address.Field
          name="region"
          options={(values) => values.country === "ca"
            ? [{ label: "Ontario", value: "on" }]
            : [{ label: "New York", value: "ny" }]}
        />
        <Address.Submit />
      </Address.Form>,
    );

    expect(screen.getByLabelText("Region")).toHaveValue("ny");
    await user.selectOptions(screen.getByLabelText("Country"), "ca");
    await waitFor(() => expect(screen.getByLabelText("Region")).toHaveValue(""));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect((await screen.findAllByText("Choose a valid region"))[0])
      .toBeVisible();
    expect(submitted).not.toHaveBeenCalled();

    await user.selectOptions(screen.getByLabelText("Region"), "on");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(submitted.mock.calls[0]?.[0]).toEqual({
      country: "ca",
      region: "on",
    }));
  });

  it("validates dynamic options from the submitted snapshot in a same-tick update", async () => {
    const user = userEvent.setup();
    const submitted = vi.fn<(value: unknown) => void>();
    const Address = createForm(z.object({
      country: z.enum(["us", "ca"]),
      region: z.string(),
    })).configure({
      fields: {
        region: {
          options: (values) => values.country === "ca"
            ? [{ label: "Ontario", value: "on" }]
            : [{ label: "New York", value: "ny" }],
        },
      },
    });

    function ChangeCountryAndSubmit(): ReactNode {
      const { setValue } = Address.useFormState();
      return (
        <button
          onClick={(event) => {
            setValue("country", "ca");
            event.currentTarget.form?.requestSubmit();
          }}
          type="button"
        >
          Change country and submit
        </button>
      );
    }

    render(
      <Address.Form
        defaultValues={{ country: "us", region: "ny" }}
        onSubmit={submitted}
      >
        <Address.Fields />
        <ChangeCountryAndSubmit />
      </Address.Form>,
    );

    await user.click(screen.getByRole("button", {
      name: "Change country and submit",
    }));

    expect((await screen.findAllByText("Choose a valid region"))[0])
      .toBeVisible();
    expect(submitted).not.toHaveBeenCalled();
  });

  it("allows an optional choice to remain unselected", async () => {
    const user = userEvent.setup();
    const submitted = vi.fn<(value: unknown) => void>();
    const OptionalChoice = createForm(z.object({
      plan: z.string().optional(),
    })).configure({
      fields: {
        plan: { options: [{ label: "Team", value: "team" }] },
      },
    });

    render(<OptionalChoice.Form onSubmit={submitted} />);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(submitted).toHaveBeenCalledWith({}, expect.anything()));
  });

  it("preserves a default while query-backed options are still loading", async () => {
    const Role = createForm(z.object({ role: z.string() }));
    const view = render(
      <Role.Form defaultValues={{ role: "admin" }}>
        <Role.Field name="role" options={[]} />
      </Role.Form>,
    );

    expect(screen.getByLabelText("Role")).toHaveValue("");
    view.rerender(
      <Role.Form defaultValues={{ role: "admin" }}>
        <Role.Field
          name="role"
          options={[{ label: "Administrator", value: "admin" }]}
        />
      </Role.Form>,
    );
    await waitFor(() => expect(screen.getByLabelText("Role")).toHaveValue("admin"));
  });

  it("renders discriminated unions as a discriminator plus conditional branch fields", async () => {
    const user = userEvent.setup();
    const submitted = vi.fn<(value: unknown) => void>();
    const Contact = createForm(z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("person"), name: z.string() }),
      z.object({ company: z.string(), kind: z.literal("company") }),
    ]));

    render(<Contact.Form onSubmit={submitted} />);
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Company")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Kind"), "person");
    expect(screen.getByLabelText("Name")).toBeVisible();
    expect(screen.queryByLabelText("Company")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Name"), "Ada");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(submitted.mock.calls[0]?.[0]).toEqual({
      kind: "person",
      name: "Ada",
    }));
  });

  it("validates wizard steps, preserves values, and appends remaining fields", async () => {
    const user = userEvent.setup();
    const submitted = vi.fn<(value: unknown) => void>();
    const Signup = createForm(z.object({
      email: z.email("Use a valid email"),
      name: z.string().min(1, "Enter a name"),
      note: z.string().optional(),
    }));

    render(
      <Signup.Wizard
        onSubmit={submitted}
      >
        <Signup.Step title="Identity">
          <div data-testid="identity-layout">
            <p>Tell us who you are.</p>
            <Signup.Field name="name" />
          </div>
        </Signup.Step>
        <Signup.Step title="Contact">
          <Signup.Field name="email" />
        </Signup.Step>
      </Signup.Wizard>,
    );

    expect(screen.getByRole("region", { name: "Identity" })).toBeVisible();
    expect(screen.getByText("Tell us who you are.")).toBeVisible();
    expect(screen.getByTestId("identity-layout")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Enter a name")).toBeVisible();
    await user.type(screen.getByLabelText("Name"), "Ada");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("region", { name: "Contact" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("Name")).toHaveValue("Ada");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("region", { name: "Remaining fields" })).toBeVisible();
    await user.type(screen.getByLabelText("Note"), "First programmer");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(submitted.mock.calls[0]?.[0]).toEqual({
      email: "ada@example.com",
      name: "Ada",
      note: "First programmer",
    }));
  });

  it("infers active fields through fragments, layout, Fields, and When branches", async () => {
    const user = userEvent.setup();
    const Signup = createForm(z.object({
      company: z.string().min(1, "Enter a company"),
      email: z.email(),
      kind: z.enum(["personal", "business"]),
      name: z.string().min(1, "Enter a name"),
      note: z.string().optional(),
    }));

    function OpaqueEmail(): ReactNode {
      return <Signup.Field name="email" />;
    }

    render(
      <Signup.Wizard
        defaultValues={{ email: "ada@example.com", kind: "personal" }}
        includeRemaining={false}
      >
        <>
          <Signup.Step fields={["email"]} title="Details">
            <div>
              <Signup.Fields names={["kind"]} />
              <Signup.When
                field="kind"
                equals="business"
                fallback={(
                  <section>
                    <Signup.Field name="name" />
                  </section>
                )}
              >
                <section>
                  <Signup.Field name="company" />
                </section>
              </Signup.When>
              <OpaqueEmail />
            </div>
          </Signup.Step>
          <Signup.Step title="Finish">
            <Signup.Field name="note" />
          </Signup.Step>
        </>
      </Signup.Wizard>,
    );

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Enter a name")).toBeVisible();
    expect(screen.queryByText("Enter a company")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Name"), "Ada");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("region", { name: "Finish" })).toBeVisible();
  });

  it("supports opaque field components and intentional content-only steps", async () => {
    const user = userEvent.setup();
    const Signup = createForm(z.object({ email: z.email() }));

    function ContactFields(): ReactNode {
      return <Signup.Field name="email" />;
    }

    render(
      <Signup.Wizard
        includeRemaining={false}
        nextLabel="Continue"
        previousLabel="Previous"
      >
        <Signup.Step fields={[]} nextLabel="Start" title="Welcome">
          <p>Before you begin</p>
        </Signup.Step>
        <Signup.Step fields={["email"]} title="Contact">
          <ContactFields />
        </Signup.Step>
      </Signup.Wizard>,
    );

    expect(screen.getByText("Before you begin")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByLabelText("Email")).toBeVisible();
    expect(screen.getByRole("button", { name: "Previous" })).toBeVisible();
  });

  it("preserves the active keyed step when dynamic steps are inserted", async () => {
    const user = userEvent.setup();
    const Profile = createForm(z.object({
      email: z.email(),
      name: z.string().min(1),
      note: z.string().optional(),
    }));

    function DynamicWizard(): ReactNode {
      const [showNote, setShowNote] = useState(false);
      return (
        <>
          <button onClick={() => setShowNote(true)} type="button">
            Add note step
          </button>
          <Profile.Wizard
            defaultValues={{ email: "ada@example.com", name: "Ada" }}
            includeRemaining={false}
          >
            <Profile.Step key="identity" title="Identity">
              <Profile.Field name="name" />
            </Profile.Step>
            {showNote ? (
              <Profile.Step key="note" title="Note">
                <Profile.Field name="note" />
              </Profile.Step>
            ) : null}
            <Profile.Step key="contact" title="Contact">
              <Profile.Field name="email" />
            </Profile.Step>
          </Profile.Wizard>
        </>
      );
    }

    render(<DynamicWizard />);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("region", { name: "Contact" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add note step" }));
    expect(screen.getByRole("region", { name: "Contact" })).toBeVisible();
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
  });

  it("does not evaluate nested conditions inside a hidden step", () => {
    const Profile = createForm(z.object({
      company: z.string(),
      kind: z.enum(["personal", "business"]),
    }));

    render(
      <Profile.Wizard
        defaultValues={{ kind: "personal" }}
        includeRemaining={false}
      >
        <Profile.Step title="Account">
          <Profile.Field name="kind" />
        </Profile.Step>
        <Profile.Step
          title="Company"
          when={(values) => values.kind === "business"}
        >
          <Profile.When
            matches={(values) => {
              if (values.kind !== "business") {
                throw new Error("Hidden nested condition was evaluated");
              }
              return true;
            }}
          >
            <Profile.Field name="company" />
          </Profile.When>
        </Profile.Step>
      </Profile.Wizard>,
    );

    expect(screen.getByRole("region", { name: "Account" })).toBeVisible();
  });

  it("rejects ambiguous or mismatched wizard composition", () => {
    const Profile = createForm(z.object({ email: z.email(), name: z.string() }));
    const Other = createForm(z.object({ name: z.string() }));
    function SuppressChildren(_props: { readonly children: ReactNode }): ReactNode {
      return <p>No field is rendered</p>;
    }

    expect(() => render(
      <Profile.Wizard includeRemaining={false}>
        <Profile.Step title="Opaque">
          <div>Custom fields could be hidden here</div>
        </Profile.Step>
      </Profile.Wizard>,
    )).toThrow(/contains no discoverable fields/u);
    expect(() => render(
      <Profile.Wizard includeRemaining={false}>
        <Profile.Step title="Opaque layout">
          <SuppressChildren>
            <Profile.Field name="name" />
          </SuppressChildren>
        </Profile.Step>
      </Profile.Wizard>,
    )).toThrow(/contains no discoverable fields/u);
    expect(() => render(
      <Profile.Wizard includeRemaining={false}>
        <Other.Step title="Other">
          <Other.Field name="name" />
        </Other.Step>
      </Profile.Wizard>,
    )).toThrow(/belongs to a different created form/u);
    expect(() => render(
      <Profile.Wizard includeRemaining={false}>
        <div>Not a step</div>
      </Profile.Wizard>,
    )).toThrow(/children must be Step elements/u);
    expect(() => render(
      <Profile.Wizard includeRemaining={false}>
        <Profile.Step fields={["name"]} title="Redundant">
          <Profile.Field name="name" />
        </Profile.Step>
      </Profile.Wizard>,
    )).toThrow(/only for opaque components/u);
    expect(() => render(
      <Profile.Form>
        <Profile.Step title="Outside">
          <Profile.Field name="name" />
        </Profile.Step>
      </Profile.Form>,
    )).toThrow(/only be used as a direct child of Wizard/u);
  });

  it("collects unassigned children from a partially assigned object group", async () => {
    const user = userEvent.setup();
    const Profile = createForm(z.object({
      profile: z.object({
        email: z.email(),
        name: z.string().min(1),
      }),
    }));

    render(
      <Profile.Wizard>
        <Profile.Step title="Name">
          <Profile.Field name="profile.name" />
        </Profile.Step>
      </Profile.Wizard>,
    );
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Ada");
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("region", { name: "Remaining fields" })).toBeVisible();
    expect(screen.getByLabelText("Email")).toBeVisible();
  });

  it("reveals a skipped conditional step when authoritative validation owns its error", async () => {
    const user = userEvent.setup();
    const submitted = vi.fn<(value: unknown) => void>();
    const Signup = createForm(z.object({
      accountType: z.enum(["personal", "business"]),
      company: z.string().min(1, "Enter a company"),
    }));

    render(
      <Signup.Wizard
        defaultValues={{ accountType: "personal" }}
        includeRemaining={false}
        onSubmit={submitted}
      >
        <Signup.Step title="Account">
          <Signup.Field name="accountType" />
        </Signup.Step>
        <Signup.Step
          title="Company"
          when={(values) => values.accountType === "business"}
        >
          <Signup.Field name="company" />
        </Signup.Step>
      </Signup.Wizard>,
    );

    expect(screen.getByRole("region", { name: "Account" })).toBeVisible();
    expect(screen.queryByLabelText("Company")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("region", { name: "Company" })).toBeVisible();
    expect(screen.getAllByText("Enter a company")[0]).toBeVisible();
    await user.type(
      screen.getByRole("textbox", { name: "Company" }),
      "Analytical Engines",
    );
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(submitted.mock.calls[0]?.[0]).toEqual({
      accountType: "personal",
      company: "Analytical Engines",
    }));
  });

  it("routes server field errors back to the owning wizard step", async () => {
    const user = userEvent.setup();
    const action = vi.fn<() => Promise<ReturnType<typeof submissionFailure>>>(async () => submissionFailure({
      fieldErrors: { name: ["That name cannot be used"] },
    }));
    const Signup = createForm(z.object({
      email: z.email(),
      name: z.string().min(1),
    }));

    render(
      <Signup.Wizard
        action={action}
        includeRemaining={false}
      >
        <Signup.Step title="Identity">
          <Signup.Field name="name" />
        </Signup.Step>
        <Signup.Step title="Contact">
          <Signup.Field name="email" />
        </Signup.Step>
      </Signup.Wizard>,
    );
    await user.type(screen.getByLabelText("Name"), "Ada");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect((await screen.findAllByText("That name cannot be used"))[0])
      .toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Identity" })).toBeVisible();
      expect(screen.getAllByText("That name cannot be used")[0]).toBeVisible();
    });
  });

  it("routes summary links between wizard steps before focusing the field", async () => {
    const user = userEvent.setup();
    const Signup = createForm(z.object({
      email: z.email(),
      name: z.string(),
    }));

    render(
      <Signup.Wizard
        includeRemaining={false}
        initialSubmissionState={submissionFailure({
          fieldErrors: {
            name: ["Choose another name"],
            email: ["Choose another email"],
          },
        })}
      >
        <Signup.Step title="Identity">
          <Signup.Field name="name" />
        </Signup.Step>
        <Signup.Step title="Contact">
          <Signup.Field name="email" />
        </Signup.Step>
      </Signup.Wizard>,
    );

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Identity" })).toBeVisible();
    });
    await user.click(screen.getByRole("button", { name: "Choose another email" }));
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Contact" })).toBeVisible();
      expect(screen.getByLabelText("Email")).toHaveFocus();
    });
  });

  it("focuses the first usable child from aggregate summary errors", async () => {
    const user = userEvent.setup();
    const Profile = createForm(z.object({
      items: z.array(z.string()).refine(() => false, {
        message: "Review the items",
      }),
      profile: z.object({ name: z.string() }).refine(() => false, {
        message: "Review the profile",
      }),
    }));

    render(
      <Profile.Form
        defaultValues={{ items: ["First"], profile: { name: "Ada" } }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await user.click(await screen.findByRole("button", {
      name: "Review the profile",
    }));
    expect(screen.getByLabelText("Name")).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Review the items" }));
    expect(screen.getByLabelText("Items item")).toHaveFocus();
  });

  it("renders simultaneous object and child errors inline", async () => {
    const user = userEvent.setup();
    const Profile = createForm(z.object({
      profile: z.object({ name: z.string() }).superRefine((_value, context) => {
        context.addIssue({
          code: "custom",
          message: "Review this profile",
        });
        context.addIssue({
          code: "custom",
          message: "Choose another name",
          path: ["name"],
        });
      }),
    }));

    render(
      <Profile.Form defaultValues={{ profile: { name: "Ada" } }} />,
    );
    await user.click(screen.getByRole("button", { name: "Submit" }));

    const group = screen.getByRole("group", { name: "Profile" });
    const groupError = await within(group).findByRole("alert");
    expect(groupError).toHaveTextContent("Review this profile");
    expect(groupError.id).not.toBe("");
    expect(group).toHaveAttribute("aria-describedby", groupError.id);
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAttribute("data-invalid", "true");
    expect(within(group).getByText("Choose another name")).toBeVisible();
    expect(screen.getByRole("button", { name: "Choose another name" }))
      .toBeVisible();

    await user.click(screen.getByRole("button", { name: "Review this profile" }));
    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveFocus());
  });

  it("renders aggregate errors for nested objects inside array items", async () => {
    const user = userEvent.setup();
    const Team = createForm(z.object({
      people: z.array(z.object({
        contact: z.object({ email: z.email() }).superRefine(
          (_value, context) => {
            context.addIssue({
              code: "custom",
              message: "Review this contact",
            });
            context.addIssue({
              code: "custom",
              message: "Use a company email",
              path: ["email"],
            });
          },
        ),
      })),
    }));

    render(
      <Team.Form
        defaultValues={{
          people: [{ contact: { email: "ada@example.com" } }],
        }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Submit" }));

    const item = screen.getByRole("region", { name: "Item 1" });
    const contact = within(item).getByRole("group", { name: "Contact" });
    const groupError = await within(contact).findByRole("alert");
    expect(groupError).toHaveTextContent("Review this contact");
    expect(contact).toHaveAttribute("aria-describedby", groupError.id);
    expect(contact).toHaveAttribute("aria-invalid", "true");
    expect(within(contact).getByText("Use a company email")).toBeVisible();
  });

  it("routes hydrated wizard errors past root errors and focuses their field", async () => {
    const Signup = createForm(z.object({
      email: z.email(),
      name: z.string().min(1),
    }));

    render(
      <Signup.Wizard
        includeRemaining={false}
        initialSubmissionState={submissionFailure({
          fieldErrors: { email: ["Use another address"] },
          formErrors: ["The request could not be completed"],
        })}
      >
        <Signup.Step title="Identity">
          <Signup.Field name="name" />
        </Signup.Step>
        <Signup.Step title="Contact">
          <Signup.Field name="email" />
        </Signup.Step>
      </Signup.Wizard>,
    );

    expect((await screen.findAllByText("Use another address"))[0])
      .toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Contact" })).toBeVisible();
      expect(screen.getAllByText("Use another address")[0]).toBeVisible();
    });
    await waitFor(() => expect(screen.getByLabelText("Email")).toHaveFocus());
  });

  it("focuses the first usable scalar for an aggregate wizard error", async () => {
    const Profile = createForm(z.object({
      email: z.email(),
      profile: z.object({ name: z.string() }),
    }));

    render(
      <Profile.Wizard
        includeRemaining={false}
        initialSubmissionState={submissionFailure({
          fieldErrors: { profile: ["Review this profile"] },
        })}
      >
        <Profile.Step title="Contact">
          <Profile.Field name="email" />
        </Profile.Step>
        <Profile.Step title="Profile">
          <Profile.Field name="profile" />
        </Profile.Step>
      </Profile.Wizard>,
    );

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Profile" })).toBeVisible();
      expect(screen.getByLabelText("Name")).toHaveFocus();
    });
  });

  it("routes a concrete array-item error through its parent step", async () => {
    const Team = createForm(z.object({
      invites: z.array(z.object({ email: z.email() })),
      name: z.string(),
    }));

    render(
      <Team.Wizard
        defaultValues={{
          invites: [{ email: "ada@example.com" }],
          name: "Analytical Engines",
        }}
        includeRemaining={false}
        initialSubmissionState={submissionFailure({
          fieldErrors: { "invites.0.email": ["Use another invite address"] },
        })}
      >
        <Team.Step title="Team">
          <Team.Field name="name" />
        </Team.Step>
        <Team.Step title="Invites">
          <Team.Field name="invites" />
        </Team.Step>
      </Team.Wizard>,
    );

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Invites" })).toBeVisible();
      expect(screen.getByLabelText("Email")).toHaveFocus();
    });
    expect(screen.getAllByText("Use another invite address")[0]).toBeVisible();
  });

  it("rejects duplicate wizard step ids", () => {
    const Profile = createForm(z.object({
      email: z.email(),
      name: z.string(),
    }));

    expect(() => render(
      <Profile.Wizard
        includeRemaining={false}
      >
        <Profile.Step id="duplicate" title="Identity">
          <Profile.Field name="name" />
        </Profile.Step>
        <Profile.Step id="duplicate" title="Contact">
          <Profile.Field name="email" />
        </Profile.Step>
      </Profile.Wizard>,
    )).toThrow("Wizard step id “duplicate” is duplicated.");
  });

  it("rejects unknown, overlapping, and array-item wizard assignments", () => {
    const Profile = createForm(z.object({
      items: z.array(z.object({ name: z.string() })),
      profile: z.object({ name: z.string() }),
    }));

    expect(() => render(
      <Profile.Wizard
        includeRemaining={false}
      >
        <Profile.Step title="Unknown">
          <Profile.Field name={"missing" as never} />
        </Profile.Step>
      </Profile.Wizard>,
    )).toThrow("references unknown field “missing”");
    expect(() => render(
      <Profile.Wizard
        includeRemaining={false}
      >
        <Profile.Step title="Profile">
          <Profile.Field name="profile" />
        </Profile.Step>
        <Profile.Step title="Name">
          <Profile.Field name="profile.name" />
        </Profile.Step>
      </Profile.Wizard>,
    )).toThrow(/overlap/u);
    expect(() => render(
      <Profile.Wizard
        includeRemaining={false}
      >
        <Profile.Step title="Item">
          <Profile.Field name={"items[].name" as never} />
        </Profile.Step>
      </Profile.Wizard>,
    )).toThrow(/array-item path/u);
  });

  it("renders unsupported feedback when every wizard step is conditional", () => {
    const Profile = createForm(z.object({ name: z.string().optional() }));

    render(
      <Profile.Wizard
        includeRemaining={false}
      >
        <Profile.Step title="Never" when={() => false}>
          <Profile.Field name="name" />
        </Profile.Step>
      </Profile.Wizard>,
    );

    expect(screen.getByText(/needs at least one visible step/u)).toBeVisible();
  });

  it("ignores stale async field validation and blocks current failures", async () => {
    const user = userEvent.setup();
    const submitted = vi.fn<(value: unknown) => void>();
    const Username = createForm(z.object({ username: z.string().min(2) })).configure({
      fields: {
        username: {
          asyncValidationDebounceMs: 0,
          asyncValidate: async (value) => {
            await new Promise((resolve) => setTimeout(resolve, value === "taken" ? 30 : 1));
            return value === "taken" ? "Username is already taken" : undefined;
          },
        },
      },
    });

    render(<Username.Form mode="onChange" onSubmit={submitted} />);
    const input = screen.getByLabelText("Username");
    await user.type(input, "taken");
    await user.clear(input);
    await user.type(input, "available");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText("Username is already taken")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(submitted.mock.calls[0]?.[0]).toEqual({ username: "available" }));

    await user.clear(input);
    await user.type(input, "taken");
    expect((await screen.findAllByText("Username is already taken"))[0])
      .toBeVisible();
  });

  it("keeps homogeneous arrays bounded, labeled, and focus-aware", async () => {
    const user = userEvent.setup();
    const Tags = createForm(z.object({ tags: z.array(z.string()).min(1).max(2) }))
      .configure({
        fields: {
          tags: {
            array: {
              addLabel: "Add another tag",
              itemLabel: "Tag",
              removeLabel: "Delete tag",
            },
          },
        },
      });

    render(<Tags.Form />);
    expect(screen.getByRole("region", { name: "Tag 1" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add another tag" }));
    expect(screen.getByRole("region", { name: "Tag 2" })).toBeVisible();
    await waitFor(() => expect(screen.getAllByLabelText("Tags item")[1]).toHaveFocus());
    expect(screen.getByRole("button", { name: "Add another tag" })).toBeDisabled();
    await user.click(within(screen.getByRole("region", { name: "Tag 2" }))
      .getByRole("button", { name: "Delete tag" }));
    expect(screen.queryByRole("region", { name: "Tag 2" })).not.toBeInTheDocument();
  });

  it("moves array values down without losing item identity", async () => {
    const user = userEvent.setup();
    const Tags = createForm(z.object({ tags: z.array(z.string()) })).configure({
      fields: { tags: { array: { itemLabel: "Tag" } } },
    });

    render(<Tags.Form defaultValues={{ tags: ["first", "second"] }} />);
    await user.click(
      within(screen.getByRole("region", { name: "Tag 1" }))
        .getByRole("button", { name: "Move down" }),
    );

    expect(screen.getAllByLabelText("Tags item").map((input) =>
      (input as HTMLInputElement).value
    )).toEqual(["second", "first"]);
  });

  it("reconciles array item identity after external reorders and length changes", async () => {
    const user = userEvent.setup();
    const Tags = createForm(z.object({ tags: z.array(z.string()) }));
    const mountedItems = vi.fn<(label: string) => void>();

    function TrackedArrayItem({
      actions,
      children,
      label,
    }: ArrayItemSlotProps): ReactNode {
      const instance = useId();
      useState(() => {
        mountedItems(label);
        return undefined;
      });
      return (
        <section aria-label={label} data-instance={instance}>
          {children}
          {actions}
        </section>
      );
    }
    const trackedAdapter = testAdapter.extend({
      slots: { ArrayItem: TrackedArrayItem },
    });

    function ExternalArrayControls(): ReactNode {
      const { setValue } = Tags.useFormState();
      return (
        <>
          <button
            onClick={() => setValue("tags", ["two", "one"])}
            type="button"
          >
            Reverse
          </button>
          <button
            onClick={() => setValue("tags", ["one", "two", "three"])}
            type="button"
          >
            Load three
          </button>
          <button onClick={() => setValue("tags", [])} type="button">
            Clear all
          </button>
        </>
      );
    }

    render(
      <Tags.Form
        adapter={trackedAdapter}
        defaultValues={{ tags: ["one", "two"] }}
      >
        <Tags.Field name="tags" />
        <ExternalArrayControls />
      </Tags.Form>,
    );
    expect(screen.getAllByRole("region", { name: /Item/u })).toHaveLength(2);
    expect(mountedItems).toHaveBeenCalledTimes(2);
    const oneInstance = screen.getByDisplayValue("one")
      .closest("section")?.getAttribute("data-instance");
    const twoInstance = screen.getByDisplayValue("two")
      .closest("section")?.getAttribute("data-instance");
    await user.click(screen.getByRole("button", { name: "Reverse" }));
    await waitFor(() => {
      expect(screen.getAllByRole<HTMLInputElement>("textbox").map((input) => input.value))
        .toEqual(["two", "one"]);
    });
    expect(screen.getByDisplayValue("one").closest("section"))
      .toHaveAttribute("data-instance", oneInstance);
    expect(screen.getByDisplayValue("two").closest("section"))
      .toHaveAttribute("data-instance", twoInstance);
    await user.click(screen.getByRole("button", { name: "Load three" }));
    await waitFor(() => {
      expect(screen.getAllByRole("region", { name: /Item/u })).toHaveLength(3);
    });
    expect(mountedItems).toHaveBeenCalledTimes(3);
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    await waitFor(() => {
      expect(screen.queryByRole("region", { name: /Item/u })).not.toBeInTheDocument();
    });
  });

  it("loads, saves, and clears an asynchronous draft", async () => {
    const user = userEvent.setup();
    const save = vi.fn<(key: string, values: unknown) => Promise<void>>(async () => undefined);
    const clear = vi.fn<(key: string) => Promise<void>>(async () => undefined);
    const Drafted = createForm(z.object({ name: z.string() }));

    render(
      <Drafted.Form
        draft={{
          adapter: {
            clear,
            load: async () => ({ name: "Draft Ada" }),
            save,
          },
          debounceMs: 0,
          key: "profile",
        }}
        onSubmit={() => submissionSuccess(undefined, "Saved")}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue("Draft Ada"));
    expect(save).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Name"), " Lovelace");
    await waitFor(() => expect(save).toHaveBeenCalledWith("profile", { name: "Draft Ada Lovelace" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Saved")).toBeVisible();
    await waitFor(() => expect(clear).toHaveBeenCalledWith("profile"));
  });

  it("loads a draft only once during React StrictMode effect replay", async () => {
    const load = vi.fn<() => Promise<{ name: string }>>(
      async () => ({ name: "Draft Ada" }),
    );
    const Drafted = createForm(z.object({ name: z.string() }));

    render(
      <StrictMode>
        <Drafted.Form
          draft={{
            adapter: {
              clear: async () => undefined,
              load,
              save: async () => undefined,
            },
            key: "strict-profile",
          }}
        />
      </StrictMode>,
    );

    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue("Draft Ada"));
    expect(load).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledWith("strict-profile");
  });

  it("finishes loading a browser storage draft under React StrictMode", async () => {
    const key = "formadapter:test:strict-browser-draft";
    localStorage.setItem(key, JSON.stringify({ name: "Browser Ada" }));
    const Drafted = createForm(z.object({ name: z.string() }));

    render(
      <StrictMode>
        <Drafted.Form draft={{ key }} />
      </StrictMode>,
    );

    expect(screen.getByText("Loading saved progress…")).toBeVisible();
    await waitFor(() => {
      expect(screen.queryByText("Loading saved progress…"))
        .not.toBeInTheDocument();
      expect(screen.getByLabelText("Name"))
        .toHaveValue("Browser Ada");
      expect(screen.getByLabelText("Name"))
        .not.toBeDisabled();
    });
    localStorage.removeItem(key);
  });

  it("does not reload a draft or reset edits when parent props get new identities", async () => {
    const user = userEvent.setup();
    const load = vi.fn<(key: string) => Promise<{ name: string }>>(async () => ({ name: "Draft Ada" }));
    const adapter = {
      clear: vi.fn<(key: string) => Promise<void>>(async () => undefined),
      load,
      save: vi.fn<(key: string, values: unknown) => Promise<void>>(async () => undefined),
    };
    const Drafted = createForm(z.object({ name: z.string() }));

    function Harness(): ReactNode {
      const [, rerender] = useState(0);
      return (
        <>
          <button onClick={() => rerender((value) => value + 1)} type="button">
            Parent rerender
          </button>
          <Drafted.Form
            defaultValues={{ name: "Initial Ada" }}
            draft={{ adapter, debounceMs: 1_000, key: "stable-profile" }}
          />
        </>
      );
    }

    render(<Harness />);
    const input = screen.getByLabelText("Name");
    await waitFor(() => expect(input).toHaveValue("Draft Ada"));
    await user.type(input, " Lovelace");
    await user.click(screen.getByRole("button", { name: "Parent rerender" }));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(load).toHaveBeenCalledOnce();
    expect(input).toHaveValue("Draft Ada Lovelace");
  });

  it("cancels a debounced draft save when a successful submit clears it", async () => {
    const user = userEvent.setup();
    const save = vi.fn<(key: string, values: unknown) => Promise<void>>(async () => undefined);
    const clear = vi.fn<(key: string) => Promise<void>>(async () => undefined);
    const Drafted = createForm(z.object({ name: z.string() }));

    render(
      <Drafted.Form
        draft={{
          adapter: { clear, load: async () => null, save },
          debounceMs: 50,
          key: "debounced-profile",
        }}
        onSubmit={() => submissionSuccess()}
      />,
    );

    const input = screen.getByLabelText("Name");
    await waitFor(() => expect(input).not.toBeDisabled());
    await user.type(input, "Ada");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(clear).toHaveBeenCalledWith("debounced-profile"));
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(save).not.toHaveBeenCalled();
  });

  it("waits for an in-flight draft save before clearing storage", async () => {
    const user = userEvent.setup();
    let finishSave: (() => void) | undefined;
    const save = vi.fn<(key: string, values: unknown) => Promise<void>>(() => new Promise<void>((resolve) => {
      finishSave = resolve;
    }));
    const clear = vi.fn<(key: string) => Promise<void>>(async () => undefined);
    const onResult = vi.fn<(result: unknown) => void>();
    const Drafted = createForm(z.object({ name: z.string() }));

    render(
      <Drafted.Form
        draft={{
          adapter: { clear, load: async () => null, save },
          debounceMs: 0,
          key: "in-flight-profile",
        }}
        onResult={onResult}
        onSubmit={() => submissionSuccess()}
      />,
    );

    const input = screen.getByLabelText("Name");
    await waitFor(() => expect(input).not.toBeDisabled());
    await user.type(input, "Ada");
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(onResult).toHaveBeenCalled());
    expect(clear).not.toHaveBeenCalled();

    finishSave?.();
    await waitFor(() => expect(clear).toHaveBeenCalledWith("in-flight-profile"));
  });

  it("reports draft load, save, and clear failures without breaking the form", async () => {
    const user = userEvent.setup();
    const errors: Error[] = [];
    const onError = vi.fn<(error: unknown) => void>((error) => {
      if (error instanceof Error) errors.push(error);
    });
    const Drafted = createForm(z.object({ name: z.string() }));

    render(
      <Drafted.Form
        draft={{
          adapter: {
            clear: async () => {
              throw new Error("clear failed");
            },
            load: async () => {
              throw new Error("load failed");
            },
            save: async () => {
              throw new Error("save failed");
            },
          },
          debounceMs: 20,
          key: "failing-profile",
          onError,
        }}
        onSubmit={() => submissionSuccess()}
      />,
    );

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    await user.type(screen.getByLabelText("Name"), "Ada");
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(3));
    expect(errors.map((error) => error.message)).toEqual([
      "load failed",
      "save failed",
      "clear failed",
    ]);
  });

  it("maps native action field errors and exposes real FormData markers", async () => {
    const user = userEvent.setup();
    const action = vi.fn<(
      previous: unknown,
      formData: FormData,
    ) => Promise<ReturnType<typeof submissionFailure>>>(async (_previous, formData) => {
      expect(formData.getAll("__formadapter_boolean")).toEqual(["terms"]);
      expect(formData.getAll("__formadapter_value")).toEqual(["email", "terms"]);
      expect(formData.get("terms")).toBe("boolean:true");
      return submissionFailure({
        fieldErrors: { email: ["This address is already registered"] },
      });
    });
    const Native = createForm(z.object({
      email: z.email(),
      terms: z.boolean(),
    }));

    render(<Native.Form action={action} />);
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.click(screen.getByLabelText("Terms"));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect((await screen.findAllByText("This address is already registered"))[0])
      .toBeVisible();
    expect(action).toHaveBeenCalledOnce();
  });

  it("preserves the activated submit button in native action FormData", async () => {
    const user = userEvent.setup();
    const action = vi.fn<(
      previous: unknown,
      formData: FormData,
    ) => Promise<ReturnType<typeof submissionSuccess>>>(async (_previous, formData) => {
      expect(formData.get("intent")).toBe("draft");
      return submissionSuccess();
    });
    const Intent = createForm(z.object({ name: z.string() }));

    render(
      <Intent.Form action={action} defaultValues={{ name: "Ada" }}>
        <Intent.Field name="name" />
        <button name="intent" type="submit" value="draft">Save draft</button>
      </Intent.Form>,
    );
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
  });

  it("preserves a named submitter when the two-argument FormData constructor is unavailable", async () => {
    const user = userEvent.setup();
    const NativeFormData = globalThis.FormData;
    class LegacyFormData extends NativeFormData {
      constructor(form?: HTMLFormElement, submitter?: HTMLElement) {
        if (submitter) throw new TypeError("Submitter overload is unavailable");
        super(form);
      }
    }
    vi.stubGlobal("FormData", LegacyFormData);

    try {
      const action = vi.fn<(
        previous: unknown,
        formData: FormData,
      ) => Promise<ReturnType<typeof submissionSuccess>>>(async (_previous, formData) => {
        return submissionSuccess({ intent: formData.get("intent") });
      });
      const Intent = createForm(z.object({ name: z.string() }));

      render(
        <Intent.Form action={action} defaultValues={{ name: "Ada" }}>
          <Intent.Field name="name" />
          <button name="intent" type="submit" value="draft">Save draft</button>
          <input aria-label="Publish" name="intent" type="submit" value="publish" />
        </Intent.Form>,
      );
      await user.click(screen.getByRole("button", { name: "Save draft" }));
      await waitFor(() => expect(action).toHaveBeenCalledOnce());
      expect(action.mock.calls[0]?.[1].get("intent")).toBe("draft");
      await user.click(screen.getByRole("button", { name: "Publish" }));
      await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
      expect(action.mock.calls[1]?.[1].get("intent")).toBe("publish");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("ignores a superseded callback submission that resolves late", async () => {
    const user = userEvent.setup();
    const resolvers: Array<(
      value: ReturnType<typeof submissionSuccess>,
    ) => void> = [];
    const onSubmit = vi.fn<(
      values: { name: string },
    ) => Promise<ReturnType<typeof submissionSuccess>>>(() =>
      new Promise((resolve) => resolvers.push(resolve))
    );
    const Profile = createForm(z.object({ name: z.string() }));

    function ProgrammaticEdit(): ReactNode {
      const { setValue } = Profile.useFormState();
      return (
        <button onClick={() => setValue("name", "second")} type="button">
          Set second value
        </button>
      );
    }

    const { container } = render(
      <Profile.Form defaultValues={{ name: "first" }} onSubmit={onSubmit}>
        <Profile.Field name="name" />
        <ProgrammaticEdit />
        <Profile.Submit />
      </Profile.Form>,
    );
    const form = container.querySelector("form");
    if (!form) throw new Error("Expected a form");

    fireEvent.submit(form);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(screen.getByLabelText("Name")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Set second value" }));
    fireEvent.submit(form);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));

    resolvers[1]?.(submissionSuccess(undefined, "Newest result"));
    expect(await screen.findByText("Newest result")).toBeVisible();
    resolvers[0]?.(submissionSuccess(undefined, "Stale result"));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(screen.queryByText("Stale result")).not.toBeInTheDocument();
  });

  it("turns callback exceptions into transport feedback", async () => {
    const user = userEvent.setup();
    const Profile = createForm(z.object({ name: z.string() }));

    render(
      <Profile.Form
        defaultValues={{ name: "Ada" }}
        onSubmit={async () => {
          throw new Error("The network is unavailable");
        }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("The network is unavailable")).toBeVisible();
  });

  it("redacts non-Error callback failures into generic transport feedback", async () => {
    const user = userEvent.setup();
    const Profile = createForm(z.object({ name: z.string() }));

    render(
      <Profile.Form
        defaultValues={{ name: "Ada" }}
        onSubmit={async () => {
          throw "private upstream response";
        }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Unable to submit the form")).toBeVisible();
    expect(screen.queryByText("private upstream response")).not.toBeInTheDocument();
  });

  it("does not reset or clear newer edits after a callback succeeds", async () => {
    const user = userEvent.setup();
    const clear = vi.fn<(key: string) => Promise<void>>(async () => undefined);
    let resolveSubmission!: (
      result: ReturnType<typeof submissionSuccess>,
    ) => void;
    const onSubmit = vi.fn<() => Promise<ReturnType<typeof submissionSuccess>>>(() =>
      new Promise((resolve) => {
        resolveSubmission = resolve;
      })
    );
    const Profile = createForm(z.object({ name: z.string() }));

    function ProgrammaticEdit(): ReactNode {
      const { setValue } = Profile.useFormState();
      return (
        <button onClick={() => setValue("name", "newer edit")} type="button">
          Make newer edit
        </button>
      );
    }

    render(
      <Profile.Form
        defaultValues={{ name: "submitted value" }}
        draft={{
          adapter: {
            clear,
            load: async () => null,
            save: async () => undefined,
          },
          key: "callback-revision",
        }}
        onSubmit={onSubmit}
        resetOnSuccess
      >
        <Profile.Field name="name" />
        <ProgrammaticEdit />
        <Profile.Submit />
      </Profile.Form>,
    );

    const input = screen.getByLabelText("Name");
    await waitFor(() => expect(input).not.toBeDisabled());
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(input).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Make newer edit" }));
    resolveSubmission(submissionSuccess(undefined, "Saved submitted value"));

    expect(await screen.findByText("Saved submitted value")).toBeVisible();
    await waitFor(() => {
      expect(input).not.toBeDisabled();
      expect(input).toHaveValue("newer edit");
    });
    expect(clear).not.toHaveBeenCalled();
  });

  it("does not reset or clear newer edits after a Server Action succeeds", async () => {
    const user = userEvent.setup();
    const clear = vi.fn<(key: string) => Promise<void>>(async () => undefined);
    let resolveAction!: (
      result: ReturnType<typeof submissionSuccess>,
    ) => void;
    const action = vi.fn<(
      previous: unknown,
      formData: FormData,
    ) => Promise<ReturnType<typeof submissionSuccess>>>(() =>
      new Promise((resolve) => {
        resolveAction = resolve;
      })
    );
    const Profile = createForm(z.object({ name: z.string() }));

    function ProgrammaticEdit(): ReactNode {
      const { setValue } = Profile.useFormState();
      return (
        <button onClick={() => setValue("name", "newer action edit")} type="button">
          Make newer action edit
        </button>
      );
    }

    render(
      <Profile.Form
        action={action}
        defaultValues={{ name: "submitted action value" }}
        draft={{
          adapter: {
            clear,
            load: async () => null,
            save: async () => undefined,
          },
          key: "action-revision",
        }}
        resetOnSuccess
      >
        <Profile.Field name="name" />
        <ProgrammaticEdit />
        <Profile.Submit />
      </Profile.Form>,
    );

    const input = screen.getByLabelText("Name");
    await waitFor(() => expect(input).not.toBeDisabled());
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(input).toBeDisabled();
    await user.click(screen.getByRole("button", {
      name: "Make newer action edit",
    }));
    resolveAction(submissionSuccess(undefined, "Saved action value"));

    expect(await screen.findByText("Saved action value")).toBeVisible();
    await waitFor(() => {
      expect(input).not.toBeDisabled();
      expect(input).toHaveValue("newer action edit");
    });
    expect(clear).not.toHaveBeenCalled();
  });

  it("blocks overlapping Server Actions and preserves each submitted revision", async () => {
    const user = userEvent.setup();
    const clear = vi.fn<(key: string) => Promise<void>>(async () => undefined);
    const pendingActions: Array<{
      readonly formData: FormData;
      readonly resolve: (
        result: ReturnType<typeof submissionSuccess>,
      ) => void;
    }> = [];
    const action = vi.fn<(
      previous: unknown,
      formData: FormData,
    ) => Promise<ReturnType<typeof submissionSuccess>>>(async (_previous, formData) =>
      new Promise((resolve) => {
        pendingActions.push({ formData, resolve });
      })
    );
    const Profile = createForm(z.object({ name: z.string() }));

    function ProgrammaticEdit(): ReactNode {
      const { setValue } = Profile.useFormState();
      return (
        <button onClick={() => setValue("name", "second action value")} type="button">
          Queue second action value
        </button>
      );
    }

    const { container } = render(
      <Profile.Form
        action={action}
        defaultValues={{ name: "first action value" }}
        draft={{
          adapter: {
            clear,
            load: async () => null,
            save: async () => undefined,
          },
          key: "queued-action-revisions",
        }}
        resetOnSuccess
      >
        <Profile.Field name="name" />
        <ProgrammaticEdit />
        <Profile.Submit />
      </Profile.Form>,
    );
    const form = container.querySelector("form");
    if (!form) throw new Error("Expected a form");
    const input = screen.getByLabelText("Name");
    await waitFor(() => expect(input).not.toBeDisabled());

    fireEvent.submit(form);
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(pendingActions[0]?.formData.get("name"))
      .toBe("string:first action value");
    expect(input).toBeDisabled();

    await user.click(screen.getByRole("button", {
      name: "Queue second action value",
    }));
    fireEvent.submit(form);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(action).toHaveBeenCalledOnce();
    pendingActions[0]?.resolve(
      submissionSuccess(undefined, "Saved first action value"),
    );

    expect(await screen.findByText("Saved first action value")).toBeVisible();
    await waitFor(() => {
      expect(input).not.toBeDisabled();
      expect(input).toHaveValue("second action value");
    });
    expect(clear).not.toHaveBeenCalled();

    fireEvent.submit(form);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(pendingActions[1]?.formData.get("name"))
      .toBe("string:second action value");
    pendingActions[1]?.resolve(
      submissionSuccess(undefined, "Saved second action value"),
    );
    await waitFor(() => {
      expect(input).not.toBeDisabled();
      expect(input).toHaveValue("first action value");
      expect(clear).toHaveBeenCalledWith("queued-action-revisions");
    });
  });

  it("aborts a pending callback submission when a newer submit is invalid", async () => {
    const user = userEvent.setup();
    const invalid = vi.fn<(
      errors: Readonly<Record<string, readonly string[]>>,
    ) => void>();
    let firstSignal: AbortSignal | undefined;
    const onSubmit = vi.fn<(
      values: { name: string },
      context: { signal: AbortSignal },
    ) => Promise<ReturnType<typeof submissionSuccess>>>((_values, context) => {
      firstSignal = context.signal;
      return new Promise<ReturnType<typeof submissionSuccess>>((resolve) => {
        context.signal.addEventListener(
          "abort",
          () => resolve(submissionSuccess(undefined, "Stale result")),
          { once: true },
        );
      });
    });
    const Profile = createForm(z.object({
      name: z.string().min(1, "Enter a name"),
    }));

    function ProgrammaticClear(): ReactNode {
      const { setValue } = Profile.useFormState();
      return (
        <button onClick={() => setValue("name", "")} type="button">
          Clear name programmatically
        </button>
      );
    }

    const { container } = render(
      <Profile.Form
        defaultValues={{ name: "Ada" }}
        onInvalid={invalid}
        onSubmit={onSubmit}
      >
        <Profile.Field name="name" />
        <ProgrammaticClear />
        <Profile.Submit />
      </Profile.Form>,
    );
    const form = container.querySelector("form");
    if (!form) throw new Error("Expected a form");

    fireEvent.submit(form);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(screen.getByLabelText("Name")).toBeDisabled();
    await user.click(screen.getByRole("button", {
      name: "Clear name programmatically",
    }));
    fireEvent.submit(form);

    await waitFor(() => expect(invalid).toHaveBeenCalledOnce());
    expect(firstSignal?.aborted).toBe(true);
    expect(screen.queryByText("Stale result")).not.toBeInTheDocument();
  });

  it("aborts stale callback work before a newer async validation finishes", async () => {
    const user = userEvent.setup();
    let validationStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      validationStarted = resolve;
    });
    let finishValidation!: () => void;
    const validationGate = new Promise<void>((resolve) => {
      finishValidation = resolve;
    });
    let resolveFirst!: (
      result: ReturnType<typeof submissionSuccess>,
    ) => void;
    let firstSignal: AbortSignal | undefined;
    const onSubmit = vi.fn<(
      values: { name: string },
      context: { signal: AbortSignal },
    ) => Promise<ReturnType<typeof submissionSuccess>>>((_values, context) => {
      firstSignal = context.signal;
      return new Promise((resolve) => {
        resolveFirst = resolve;
      });
    });
    const Profile = createForm(z.object({ name: z.string() })).configure({
      fields: {
        name: {
          asyncValidationDebounceMs: 0,
          asyncValidate: async (value) => {
            if (value !== "blocked") return undefined;
            validationStarted();
            await validationGate;
            return "That value is blocked";
          },
        },
      },
    });

    function ProgrammaticBlock(): ReactNode {
      const { setValue } = Profile.useFormState();
      return (
        <button onClick={() => setValue("name", "blocked")} type="button">
          Set blocked value
        </button>
      );
    }

    const { container } = render(
      <Profile.Form defaultValues={{ name: "first" }} onSubmit={onSubmit}>
        <Profile.Field name="name" />
        <ProgrammaticBlock />
        <Profile.Submit />
      </Profile.Form>,
    );
    const form = container.querySelector("form");
    if (!form) throw new Error("Expected a form");

    fireEvent.submit(form);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(screen.getByLabelText("Name")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Set blocked value" }));
    fireEvent.submit(form);

    await started;
    expect(firstSignal?.aborted).toBe(true);
    resolveFirst(submissionSuccess(undefined, "Stale result"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText("Stale result")).not.toBeInTheDocument();

    finishValidation();
    expect((await screen.findAllByText("That value is blocked"))[0])
      .toBeVisible();
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("drops an invalid onChange submit and later sends one coherent snapshot", async () => {
    const user = userEvent.setup();
    let firstValidationStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      firstValidationStarted = resolve;
    });
    let releaseFirstValidation!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseFirstValidation = resolve;
    });
    const onSubmit = vi.fn<(
      output: { name: string },
      context: {
        formData: FormData;
        input: { name: string };
      },
    ) => void>();
    const Profile = createForm(z.object({ name: z.string() })).configure({
      fields: {
        name: {
          asyncValidationDebounceMs: 0,
          asyncValidate: async (value) => {
            if (value !== "first") return undefined;
            firstValidationStarted();
            await gate;
            return "The first value is invalid";
          },
        },
      },
    });

    function ProgrammaticEdit(): ReactNode {
      const { setValue } = Profile.useFormState();
      return (
        <button onClick={() => setValue("name", "second")} type="button">
          Set second value
        </button>
      );
    }

    const { container } = render(
      <Profile.Form
        defaultValues={{ name: "first" }}
        mode="onChange"
        onSubmit={onSubmit}
      >
        <Profile.Field name="name" />
        <ProgrammaticEdit />
        <Profile.Submit />
      </Profile.Form>,
    );
    const form = container.querySelector("form");
    if (!form) throw new Error("Expected a form");

    fireEvent.submit(form);
    await started;
    const input = screen.getByLabelText("Name");
    expect(input).toBeDisabled();
    await user.click(screen.getByRole("button", {
      name: "Set second value",
    }));
    releaseFirstValidation();

    await waitFor(() => {
      expect(input).not.toBeDisabled();
      expect(input).toHaveValue("second");
    });
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.submit(form);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ name: "second" });
    expect(onSubmit.mock.calls[0]?.[1].input).toEqual({ name: "second" });
    expect(onSubmit.mock.calls[0]?.[1].formData.get("name"))
      .toBe("string:second");
  });

  it("locks controls while async submit validation is pending", async () => {
    const user = userEvent.setup();
    let validationStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      validationStarted = resolve;
    });
    let releaseValidation!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseValidation = resolve;
    });
    const onSubmit = vi.fn<(
      output: { name: string },
      context: {
        formData: FormData;
        input: { name: string };
      },
    ) => void>();
    const Profile = createForm(z.object({ name: z.string() })).configure({
      fields: {
        name: {
          asyncValidationDebounceMs: 0,
          asyncValidate: async () => {
            validationStarted();
            await gate;
            return undefined;
          },
        },
      },
    });
    const { container } = render(
      <Profile.Form defaultValues={{ name: "validated" }} onSubmit={onSubmit} />,
    );
    const form = container.querySelector("form");
    if (!form) throw new Error("Expected a form");

    fireEvent.submit(form);
    await started;
    const input = screen.getByLabelText("Name");
    expect(input).toBeDisabled();
    await user.type(input, "edited while validating");
    expect(input).toHaveValue("validated");
    releaseValidation();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ name: "validated" });
    expect(onSubmit.mock.calls[0]?.[1].input).toEqual({ name: "validated" });
    expect(onSubmit.mock.calls[0]?.[1].formData.get("name"))
      .toBe("string:validated");
  });

  it("does not call a client submit callback after deferred schema validation outlives the form", async () => {
    let validationStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      validationStarted = resolve;
    });
    let releaseValidation!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseValidation = resolve;
    });
    let validationFinished!: () => void;
    const finished = new Promise<void>((resolve) => {
      validationFinished = resolve;
    });
    const schema = z.object({ name: z.string() }).superRefine(async () => {
      validationStarted();
      await gate;
      validationFinished();
    });
    const onSubmit = vi.fn<(values: { name: string }) => void>();
    const Profile = createForm(schema);
    const view = render(
      <Profile.Form defaultValues={{ name: "Ada" }} onSubmit={onSubmit} />,
    );
    const form = view.container.querySelector("form");
    if (!form) throw new Error("Expected a form");

    fireEvent.submit(form);
    await started;
    view.unmount();
    releaseValidation();
    await finished;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not dispatch a server action after deferred schema validation outlives the form", async () => {
    let validationStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      validationStarted = resolve;
    });
    let releaseValidation!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseValidation = resolve;
    });
    let validationFinished!: () => void;
    const finished = new Promise<void>((resolve) => {
      validationFinished = resolve;
    });
    const schema = z.object({ name: z.string() }).superRefine(async () => {
      validationStarted();
      await gate;
      validationFinished();
    });
    const action = vi.fn<() => Promise<ReturnType<typeof submissionSuccess>>>(
      async () => submissionSuccess(),
    );
    const Profile = createForm(schema);
    const view = render(
      <Profile.Form action={action} defaultValues={{ name: "Ada" }} />,
    );
    const form = view.container.querySelector("form");
    if (!form) throw new Error("Expected a form");

    fireEvent.submit(form);
    await started;
    view.unmount();
    releaseValidation();
    await finished;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(action).not.toHaveBeenCalled();
  });

  it("clears prior server field errors after a later successful callback", async () => {
    const user = userEvent.setup();
    const responses = [
      submissionFailure({
        fieldErrors: { email: ["This address is unavailable"] },
      }),
      submissionSuccess(undefined, "Saved"),
    ];
    const onSubmit = vi.fn<
      () => Promise<(typeof responses)[number] | undefined>
    >(async () => responses.shift());
    const Profile = createForm(z.object({ email: z.email() }));

    render(
      <Profile.Form
        defaultValues={{ email: "ada@example.com" }}
        onSubmit={onSubmit}
      />,
    );
    const email = screen.getByLabelText("Email");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect((await screen.findAllByText("This address is unavailable"))[0])
      .toBeVisible();
    await waitFor(() => expect(email).toHaveFocus());

    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Saved")).toBeVisible();
    await waitFor(() => {
      expect(screen.queryAllByText("This address is unavailable")).toHaveLength(0);
    });
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("renders and clears simultaneous server object and child errors", async () => {
    const user = userEvent.setup();
    const responses = [
      submissionFailure({
        fieldErrors: {
          profile: ["Review this profile"],
          "profile.name": ["That name cannot be used"],
        },
      }),
      submissionSuccess(undefined, "Saved profile"),
    ];
    const onSubmit = vi.fn<
      () => Promise<(typeof responses)[number] | undefined>
    >(async () => responses.shift());
    const Profile = createForm(z.object({
      profile: z.object({ name: z.string() }),
    }));

    render(
      <Profile.Form
        defaultValues={{ profile: { name: "Ada" } }}
        onSubmit={onSubmit}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Submit" }));

    const group = screen.getByRole("group", { name: "Profile" });
    const groupError = await within(group).findByRole("alert");
    expect(groupError).toHaveTextContent("Review this profile");
    expect(group).toHaveAttribute("aria-describedby", groupError.id);
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(within(group).getByText("That name cannot be used")).toBeVisible();
    expect(screen.getByRole("button", { name: "That name cannot be used" }))
      .toBeVisible();
    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveFocus());

    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Saved profile")).toBeVisible();
    await waitFor(() => {
      expect(within(group).queryByText("Review this profile"))
        .not.toBeInTheDocument();
      expect(within(group).queryByText("That name cannot be used"))
        .not.toBeInTheDocument();
      expect(group).not.toHaveAttribute("aria-describedby");
      expect(group).not.toHaveAttribute("aria-invalid");
      expect(group).not.toHaveAttribute("data-invalid");
    });
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("does not apply server field errors to values edited after dispatch", async () => {
    const user = userEvent.setup();
    let resolveAction!: (
      result: ReturnType<typeof submissionFailure>,
    ) => void;
    const action = vi.fn<() => Promise<ReturnType<typeof submissionFailure>>>(() =>
      new Promise<ReturnType<typeof submissionFailure>>((resolve) => {
        resolveAction = resolve;
      })
    );
    const onResult = vi.fn<(result: unknown) => void>();
    const Profile = createForm(z.object({ email: z.email() }));

    function ChangeEmail(): ReactNode {
      const { setValue } = Profile.useFormState();
      return (
        <button
          onClick={() => setValue("email", "grace@example.com")}
          type="button"
        >
          Change email
        </button>
      );
    }

    render(
      <Profile.Form
        action={action}
        defaultValues={{ email: "ada@example.com" }}
        onResult={onResult}
      >
        <Profile.Field name="email" />
        <ChangeEmail />
        <Profile.Submit />
      </Profile.Form>,
    );

    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    await user.click(screen.getByRole("button", { name: "Change email" }));
    resolveAction(submissionFailure({
      fieldErrors: { email: ["This belongs to the old address"] },
    }));

    await waitFor(() => expect(onResult).toHaveBeenCalledOnce());
    expect(screen.getByLabelText("Email")).toHaveValue("grace@example.com");
    expect(screen.queryByText("This belongs to the old address"))
      .not.toBeInTheDocument();
  });

  it("keeps every server field message in the error summary", async () => {
    const Profile = createForm(z.object({ email: z.email() }));

    render(
      <>
        <button type="button">Keep focus</button>
        <Profile.Form
          initialSubmissionState={submissionFailure({
            fieldErrors: {
              email: ["This address is unavailable", "Try a different domain"],
            },
          })}
        />
      </>,
    );

    const focusGuard = screen.getByRole("button", { name: "Keep focus" });
    focusGuard.focus();
    const summary = await screen.findByRole("alert");
    expect(summary).toHaveTextContent("This address is unavailable");
    expect(summary).toHaveTextContent("Try a different domain");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(focusGuard).toHaveFocus();
  });

  it("rebuilds native action data from prepared values, including disabled fields", async () => {
    const user = userEvent.setup();
    const action = vi.fn<(
      previous: unknown,
      formData: FormData,
    ) => Promise<ReturnType<typeof submissionSuccess>>>(async (_previous, formData) => {
      expect(formData.get("locked")).toBe("string:server-owned");
      expect(formData.has("detail")).toBe(false);
      return submissionSuccess();
    });
    const Native = createForm(z.object({
      detail: z.string().optional(),
      kind: z.enum(["personal", "business"]),
      locked: z.string(),
    })).configure({ fields: { locked: { disabled: true } } });

    render(
      <Native.Form
        action={action}
        defaultValues={{ kind: "business", locked: "server-owned" }}
      >
        <Native.Field name="kind" />
        <Native.When field="kind" equals="business">
          <Native.Field name="detail" />
        </Native.When>
        <Native.Field name="locked" />
        <Native.Submit />
      </Native.Form>,
    );
    await user.type(screen.getByLabelText("Detail"), "stale branch value");
    await user.selectOptions(screen.getByLabelText("Kind"), "personal");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
  });

  it("uses a model-independent typed codec for render-time action options", async () => {
    const user = userEvent.setup();
    const action = vi.fn<(
      previous: unknown,
      formData: FormData,
    ) => Promise<ReturnType<typeof submissionSuccess>>>(async (_previous, formData) => {
      return submissionSuccess({ encoded: formData.get("choice") });
    });
    const Choice = createForm(z.object({
      choice: z.union([z.literal(7), z.literal(false), z.null(), z.literal("x")]),
    }));

    render(
      <Choice.Form action={action}>
        <Choice.Field
          name="choice"
          options={[
            { label: "Seven", value: 7 },
            { label: "False", value: false },
            { label: "None", value: null },
            { label: "X", value: "x" },
          ]}
        />
        <Choice.Submit />
      </Choice.Form>,
    );

    await user.selectOptions(screen.getByLabelText("Choice"), "7");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(action.mock.calls[0]![1].get("choice")).toBe("number:7");

    await user.selectOptions(screen.getByLabelText("Choice"), "false");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(action.mock.calls[1]![1].get("choice")).toBe("boolean:false");

    await user.selectOptions(screen.getByLabelText("Choice"), "null");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(3));
    expect(action.mock.calls[2]![1].get("choice")).toBe("null:");
  });
});
