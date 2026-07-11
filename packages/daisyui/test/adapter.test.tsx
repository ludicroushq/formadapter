import { useState, type ReactNode } from "react";
import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  describe,
  expect,
  test,
  vi,
} from "vitest";

import type {
  ArrayField,
  ObjectField,
  ResolvedFieldConfig,
  ScalarConstraints,
  ScalarField,
  UnsupportedField,
} from "@formadapter/core";
import type { ControlProps } from "@formadapter/react";
import {
  changedInputValue,
  inputType,
  inputValue,
  nativeControlProps,
  optionForValue,
  selectedOptionValue,
  serializedOptionValue,
} from "@formadapter/html/native";

import {
  Array as DaisyArray,
  ArrayItem,
  Button,
  Checkbox,
  DaisyUIProvider,
  ErrorSummary,
  Field,
  File as FileControl,
  Form,
  FormMessage,
  Group,
  Input,
  Radio,
  Select,
  Textarea,
  Unsupported,
  Wizard,
  createForm,
  daisyUIAdapter,
} from "../src";
import { classNames } from "../src/class-names";
import { mergeControlStyle } from "../src/controls/control-style";

type TestScalarOverrides = Partial<
  Omit<ScalarField, "config" | "constraints">
> & {
  readonly config?: Partial<ResolvedFieldConfig>;
  readonly constraints?: Partial<ScalarConstraints>;
};

function scalar(overrides: TestScalarOverrides = {}): ScalarField {
  const baseConfig: ResolvedFieldConfig = {
    asyncValidationDebounceMs: 250,
    disabled: false,
    extensions: {},
    hidden: false,
    multiple: false,
    readOnly: false,
    requiredWhenVisible: false,
  };
  const baseConstraints: ScalarConstraints = {
    multiple: false,
  };

  return {
    config: { ...baseConfig, ...overrides.config },
    constraints: { ...baseConstraints, ...overrides.constraints },
    control: "text",
    dataType: "string",
    key: "name",
    kind: "scalar",
    label: "Name",
    nullable: false,
    path: "name",
    required: true,
    source: { type: "string" },
    ...overrides,
  } as ScalarField;
}

function controlProps(
  field: ScalarField,
  overrides: Partial<ControlProps> = {},
): ControlProps {
  return {
    controlRef: vi.fn<ControlProps["controlRef"]>(),
    disabled: false,
    field,
    id: `control-${field.key}`,
    inputProps: {},
    invalid: false,
    name: field.path,
    onBlur: vi.fn<() => void>(),
    onValueChange: vi.fn<(value: unknown) => void>(),
    readOnly: false,
    required: field.required,
    validating: false,
    value: field.defaultValue,
    ...overrides,
  };
}

function objectField(): ObjectField {
  return {
    children: [scalar()],
    config: {
      asyncValidationDebounceMs: 250,
      disabled: false,
      extensions: {},
      hidden: false,
      multiple: false,
      readOnly: false,
      requiredWhenVisible: false,
    },
    description: "Tell us who you are.",
    key: "profile",
    kind: "object",
    label: "Profile",
    nullable: false,
    path: "profile",
    required: true,
    source: { type: "object" },
  };
}

function arrayField(): ArrayField {
  return {
    config: {
      asyncValidationDebounceMs: 250,
      disabled: false,
      extensions: {},
      hidden: false,
      multiple: false,
      readOnly: false,
      requiredWhenVisible: false,
    },
    description: "Add at least one teammate.",
    item: scalar(),
    key: "teammates",
    kind: "array",
    label: "Teammates",
    maxItems: 4,
    minItems: 1,
    nullable: false,
    path: "teammates",
    required: true,
    source: { type: "array" },
    uniqueItems: false,
  };
}

describe("DaisyUI control helpers", () => {
  test("deduplicates classes and safely ignores invalid control props", () => {
    expect(classNames(undefined, false, "input input-lg", "input")).toBe(
      "input input-lg",
    );
    expect(classNames(null, false, undefined)).toBeUndefined();

    const withoutProps = nativeControlProps(scalar());
    expect(withoutProps).toEqual({ props: {} });

    const invalidPropsField = scalar({
      config: {
        controlProps: [] as unknown as Readonly<Record<string, unknown>>,
      },
    });
    expect(nativeControlProps(invalidPropsField)).toEqual({ props: {} });
    expect(mergeControlStyle({ maxWidth: "10rem", width: "50%" })).toEqual({
      maxWidth: "10rem",
      width: "50%",
    });

    const hostileProps = nativeControlProps<Record<string, unknown>>(scalar({
      config: {
        controlProps: JSON.parse(
          '{"__proto__":{"formadapterPolluted":true},"constructor":"ignored","data-safe":"kept"}',
        ) as Readonly<Record<string, unknown>>,
      },
    }));
    expect(hostileProps.props).toEqual({ "data-safe": "kept" });
    expect(Object.prototype).not.toHaveProperty("formadapterPolluted");
  });

  test("resolves semantic input types and normalizes native values", () => {
    expect(inputType(scalar({ control: "email" }))).toBe("email");
    expect(
      inputType(
        scalar({
          constraints: { format: "date-time" },
          control: "textarea",
        }),
      ),
    ).toBe("text");
    expect(
      inputType(
        scalar({
          constraints: { format: "date-time" },
          inputType: "datetime-local",
        }),
      ),
    ).toBe("datetime-local");
    expect(
      inputType(
        scalar({
          constraints: { format: "uri" },
          control: "textarea",
        }),
      ),
    ).toBe("url");
    for (const [format, expected] of [
      ["date", "date"],
      ["email", "email"],
      ["password", "password"],
      ["tel", "tel"],
      ["time", "time"],
      ["url", "url"],
    ] as const) {
      expect(
        inputType(
          scalar({
            constraints: { format },
            control: "custom-input" as never,
          }),
        ),
      ).toBe(expected);
    }
    expect(
      inputType(
        scalar({
          control: "textarea",
          dataType: "integer",
        }),
      ),
    ).toBe("number");
    expect(inputType(scalar({ control: "textarea" }))).toBe("text");

    const date = new Date(2026, 6, 9, 15, 30);
    expect(inputValue(date, "date")).toBe("2026-07-09");
    expect(inputValue(date, "datetime-local")).toBe("2026-07-09T15:30");
    expect(inputValue(date, "time")).toBe("15:30");
    expect(inputValue(date)).toBe(date.toISOString());
    expect(inputValue(null)).toBe("");
    expect(inputValue(undefined)).toBe("");
    expect(inputValue("Ada")).toBe("Ada");
    expect(inputValue(3)).toBe(3);
    expect(inputValue(true)).toBe("true");

    const numeric = scalar({ dataType: "number" });
    expect(changedInputValue(numeric, "not-a-number", Number.NaN)).toBe(
      "not-a-number",
    );
    expect(changedInputValue(numeric, "3.5", 3.5)).toBe(3.5);
    expect(changedInputValue(numeric, "", Number.NaN)).toBe("");
    expect(changedInputValue(scalar(), "Ada", Number.NaN)).toBe("Ada");
  });

  test("round-trips primitive options without string/number collisions", () => {
    const options = [
      { label: "Null", value: null },
      { label: "False", value: false },
      { label: "Number", value: 2 },
      { label: "String", value: "2" },
    ] as const;

    expect(serializedOptionValue(null)).toBe("null:");
    expect(serializedOptionValue(false)).toBe("boolean:false");
    expect(serializedOptionValue(2)).toBe("number:2");
    expect(serializedOptionValue("2")).toBe("string:2");
    expect(optionForValue(options, "number:2")?.value).toBe(2);
    expect(optionForValue(options, "missing")).toBeUndefined();
    expect(selectedOptionValue(options, "2")).toBe("string:2");
    expect(selectedOptionValue(options, undefined)).toBe("");
  });
});

describe("DaisyUI controls", () => {
  test("renders a constrained input and protects runtime-owned props", () => {
    const onBlur = vi.fn<() => void>();
    const onValueChange = vi.fn<(value: unknown) => void>();
    const field = scalar({
      config: {
        controlProps: {
          "data-testid": "number-control",
          className: "input-lg",
          id: "ignored-id",
          name: "ignored-name",
          style: { maxWidth: "24rem" },
          value: "ignored-value",
        },
        placeholder: "Number of seats",
      },
      constraints: {
        maximum: 20,
        minimum: 1,
      },
      control: "number",
      dataType: "number",
      inputType: "number",
    });

    render(
      <Input
        {...controlProps(field, {
          id: "seat-count",
          inputProps: {
            "aria-describedby": "seat-help",
            "aria-invalid": true,
          },
          invalid: true,
          name: "seats",
          onBlur,
          onValueChange,
          value: 2.5,
        })}
      />,
    );

    const input = screen.getByTestId("number-control");
    expect(input).toHaveAttribute("id", "seat-count");
    expect(input).toHaveAttribute("name", "seats");
    expect(input).toHaveAttribute("min", "1");
    expect(input).toHaveAttribute("max", "20");
    expect(input).toHaveAttribute("step", "any");
    expect(input).toHaveAttribute("aria-describedby", "seat-help");
    expect(input).toHaveClass("input", "input-error", "input-lg");
    expect((input as HTMLElement).style.maxWidth).toBe("24rem");
    expect((input as HTMLElement).style.width).toBe("100%");

    fireEvent.change(input, { target: { value: "3.5" } });
    fireEvent.blur(input);
    expect(onValueChange).toHaveBeenCalledWith(3.5);
    expect(onBlur).toHaveBeenCalledOnce();

    fireEvent.change(input, { target: { value: "" } });
    expect(onValueChange).toHaveBeenLastCalledWith("");
  });

  test("renders textarea metadata and emits empty values as undefined", () => {
    const onValueChange = vi.fn<(value: unknown) => void>();
    const field = scalar({
      config: {
        controlProps: { className: "textarea-lg", rows: 6 },
        placeholder: "Tell us more",
      },
      constraints: { maxLength: 200, minLength: 10 },
      control: "textarea",
    });

    render(
      <Textarea
        {...controlProps(field, {
          onValueChange,
          value: "A useful description",
        })}
      />,
    );

    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveClass("textarea", "textarea-lg");
    expect(textarea).toHaveAttribute("rows", "6");
    expect(textarea).toHaveAttribute("minlength", "10");
    expect(textarea).toHaveAttribute("maxlength", "200");
    expect(textarea).toHaveAttribute("placeholder", "Tell us more");

    fireEvent.change(textarea, { target: { value: "" } });
    expect(onValueChange).toHaveBeenCalledWith("");
  });

  test("preserves typed select option values", () => {
    const onValueChange = vi.fn<(value: unknown) => void>();
    const field = scalar({
      config: { placeholder: "Choose a plan" },
      control: "select",
      options: [
        { label: "Starter", value: 1 },
        { label: "Team", value: 2 },
        { label: "Legacy code", value: "2" },
        { label: "None", value: null },
      ],
      required: false,
    });

    render(
      <Select
        {...controlProps(field, {
          onValueChange,
          readOnly: false,
          required: false,
          value: 1,
        })}
      />,
    );

    const select = screen.getByRole("combobox");
    expect(select).toHaveClass("select");
    expect(screen.getByRole("option", { name: "Choose a plan" })).toBeEnabled();

    const team = screen.getByRole<HTMLOptionElement>("option", {
      name: "Team",
    });
    fireEvent.change(select, { target: { value: team.value } });
    expect(onValueChange).toHaveBeenCalledWith(2);

    const legacy = screen.getByRole<HTMLOptionElement>("option", {
      name: "Legacy code",
    });
    fireEvent.change(select, { target: { value: legacy.value } });
    expect(onValueChange).toHaveBeenLastCalledWith("2");

    const none = screen.getByRole<HTMLOptionElement>("option", {
      name: "None",
    });
    fireEvent.change(select, { target: { value: none.value } });
    expect(onValueChange).toHaveBeenLastCalledWith(null);
  });

  test("serializes the current option once for progressive enhancement", () => {
    const field = scalar({
      control: "select",
      label: "Plan",
      options: [
        { label: "Starter", value: 1 },
        { label: "Team", value: 2 },
      ],
    });

    function ProgressiveForm(): ReactNode {
      const [value, setValue] = useState<unknown>(undefined);
      return (
        <form aria-label="Progressive form">
          <input name="__formadapter_value" type="hidden" value="plan" />
          <Select
            {...controlProps(field, {
              inputProps: { "aria-label": "Plan" },
              name: "plan",
              onValueChange: setValue,
              value,
            })}
          />
        </form>
      );
    }

    render(<ProgressiveForm />);
    const select = screen.getByRole("combobox", { name: "Plan" });
    const team = screen.getByRole<HTMLOptionElement>("option", { name: "Team" });
    fireEvent.change(select, { target: { value: team.value } });

    const form = screen.getByRole<HTMLFormElement>("form", {
      name: "Progressive form",
    });
    const formData = new FormData(form);
    expect(formData.getAll("__formadapter_value")).toEqual(["plan"]);
    expect(formData.getAll("plan")).toEqual(["number:2"]);
  });

  test("renders accessible radio options and respects read-only state", () => {
    const onValueChange = vi.fn<(value: unknown) => void>();
    const field = scalar({
      control: "radio",
      label: "Plan",
      options: [
        { label: "Starter", value: "starter" },
        { label: "Team", value: "team" },
      ],
    });
    const props = controlProps(field, {
      onValueChange,
      value: "starter",
    });
    const { rerender } = render(<Radio {...props} />);

    const starter = screen.getByRole("radio", { name: "Starter" });
    const team = screen.getByRole("radio", { name: "Team" });
    expect(screen.getByRole("radiogroup", { name: "Plan" })).toHaveStyle({
      display: "flex",
      flexWrap: "wrap",
      gap: "0.75rem",
    });
    expect(starter).toBeChecked();
    fireEvent.click(team);
    expect(onValueChange).toHaveBeenCalledWith("team");

    onValueChange.mockClear();
    rerender(<Radio {...props} readOnly />);
    fireEvent.click(team);
    expect(onValueChange).not.toHaveBeenCalled();

    const emptyRef = vi.fn<ControlProps["controlRef"]>();
    rerender(
      <Radio
        {...controlProps({ ...field, options: [] }, { controlRef: emptyRef })}
      />,
    );
    const emptyGroup = screen.getByRole("radiogroup", { name: "Plan" });
    expect(emptyGroup).toHaveAttribute("tabindex", "-1");
    expect(emptyGroup).toHaveAttribute("aria-required", "true");
    expect(emptyRef).toHaveBeenCalledWith(emptyGroup);
  });

  test("renders a required checkbox inside its accessible field label", () => {
    const onValueChange = vi.fn<(value: unknown) => void>();
    const field = scalar({
      control: "checkbox",
      dataType: "boolean",
      description: "Required before continuing.",
      label: "Accept terms",
      source: { const: true, type: "boolean" },
    });
    const props = controlProps(field, { onValueChange, value: false });

    render(
      <Field
        controlId={props.id}
        descriptionId="terms-description"
        field={field}
        invalid={false}
        required
      >
        <Checkbox {...props} />
      </Field>,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" });
    expect(checkbox).toBeRequired();
    expect(screen.getByText("Required before continuing.")).toHaveAttribute(
      "id",
      "terms-description",
    );
    fireEvent.click(checkbox);
    expect(onValueChange).toHaveBeenCalledWith(true);

    const falseAllowed = scalar({
      control: "checkbox",
      dataType: "boolean",
      label: "Enabled",
      source: { type: "boolean" },
    });
    const { rerender } = render(
      <Checkbox
        {...controlProps(falseAllowed, {
          inputProps: { "aria-label": "Enabled" },
          required: true,
          value: false,
        })}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "Enabled" })).not.toBeRequired();
    rerender(<></>);
  });

  test("emits one file or a file array according to schema configuration", () => {
    const onValueChange = vi.fn<(value: unknown) => void>();
    const singleField = scalar({
      constraints: { accept: "image/png" },
      control: "file",
      dataType: "file",
    });
    const first = new File(["one"], "one.png", { type: "image/png" });
    const second = new File(["two"], "two.png", { type: "image/png" });
    const { rerender } = render(
      <FileControl
        {...controlProps(singleField, {
          inputProps: { "aria-label": "Attachment" },
          onValueChange,
        })}
      />,
    );
    const input = screen.getByLabelText("Attachment");

    expect(input).toHaveClass("file-input");
    expect(input).toHaveAttribute("accept", "image/png");
    fireEvent.change(input, { target: { files: [first] } });
    expect(onValueChange).toHaveBeenCalledWith(first);

    const multipleField = scalar({
      config: { multiple: true },
      control: "file",
      dataType: "file",
    });
    rerender(
      <FileControl
        {...controlProps(multipleField, {
          inputProps: { "aria-label": "Attachment" },
          onValueChange,
        })}
      />,
    );
    fireEvent.change(input, { target: { files: [first, second] } });
    expect(onValueChange).toHaveBeenLastCalledWith([first, second]);
  });

  test("clears the native file selection when the controlled value resets", async () => {
    const user = userEvent.setup();
    const field = scalar({ control: "file", dataType: "file" });
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    const props = controlProps(field, {
      inputProps: { "aria-label": "Resettable attachment" },
    });
    const { rerender } = render(<FileControl {...props} />);
    const input = screen.getByLabelText<HTMLInputElement>("Resettable attachment");

    await user.upload(input, file);
    expect(input.files).toHaveLength(1);
    expect(input.value).not.toBe("");
    rerender(<FileControl {...props} value="" />);
    expect(input.value).toBe("");
  });

  test("keeps a native file selection when controlled state clones its metadata", async () => {
    const user = userEvent.setup();
    const field = scalar({ control: "file", dataType: "file" });
    const file = new File(["avatar"], "avatar.png", {
      lastModified: 123,
      type: "image/png",
    });
    const props = controlProps(field, {
      inputProps: { "aria-label": "Cloned attachment" },
    });
    const { rerender } = render(<FileControl {...props} />);
    const input = screen.getByLabelText<HTMLInputElement>("Cloned attachment");

    await user.upload(input, file);
    const selected = input.files?.item(0);
    if (!selected) throw new Error("Expected the browser to select a file");
    const cloned = new File([selected], selected.name, {
      lastModified: selected.lastModified,
      type: selected.type,
    });
    expect({
      lastModified: cloned.lastModified,
      name: cloned.name,
      size: cloned.size,
      type: cloned.type,
    }).toEqual({
      lastModified: selected.lastModified,
      name: selected.name,
      size: selected.size,
      type: selected.type,
    });
    rerender(
      <FileControl
        {...props}
        value={cloned}
      />,
    );

    expect(input.value).toContain("avatar.png");
    expect(input.files).toHaveLength(1);
  });

  test("clears a stale native filename when controlled state changes files", async () => {
    const user = userEvent.setup();
    const field = scalar({ control: "file", dataType: "file" });
    const first = new File(["first"], "first.png", { type: "image/png" });
    const replacement = new File(["replacement"], "replacement.png", {
      type: "image/png",
    });
    const props = controlProps(field, {
      inputProps: { "aria-label": "Replaceable attachment" },
      value: first,
    });
    const { rerender } = render(<FileControl {...props} />);
    const input = screen.getByLabelText<HTMLInputElement>(
      "Replaceable attachment",
    );

    await user.upload(input, first);
    expect(input.value).toContain("first.png");
    rerender(<FileControl {...props} value={replacement} />);

    expect(input.value).toBe("");
    expect(input.files).toHaveLength(0);
  });

  test("covers accessible read-only, invalid, range, hidden, and empty variants", () => {
    const onValueChange = vi.fn<(value: unknown) => void>();
    render(
      <>
        <Input
          {...controlProps(
            scalar({ control: "range", inputType: "range" }),
            {
              inputProps: { "aria-label": "Range" },
              invalid: true,
              onValueChange,
              readOnly: true,
            },
          )}
        />
        <Input
          {...controlProps(
            scalar({ control: "hidden", inputType: "hidden" }),
            { inputProps: { "aria-label": "Hidden" }, invalid: true },
          )}
        />
        <Textarea
          {...controlProps(scalar({ control: "textarea" }), {
            inputProps: { "aria-label": "Invalid notes" },
            invalid: true,
          })}
        />
        <Checkbox
          {...controlProps(
            scalar({ control: "checkbox", dataType: "boolean" }),
            {
              inputProps: { "aria-label": "Read-only checkbox" },
              invalid: true,
              onValueChange,
              readOnly: true,
            },
          )}
        />
        <Radio
          {...controlProps(scalar({ control: "radio" }), {
            inputProps: { "aria-label": "Empty radio" },
            invalid: true,
            readOnly: true,
          })}
        />
        <Select
          {...controlProps(scalar({ control: "select" }), {
            inputProps: { "aria-label": "Empty select" },
            invalid: true,
            readOnly: true,
          })}
        />
        <FileControl
          {...controlProps(
            scalar({
              constraints: { contentMediaType: "text/plain", multiple: true },
              control: "file",
              dataType: "file",
            }),
            {
              inputProps: { "aria-label": "Read-only files" },
              invalid: true,
              onValueChange,
              readOnly: true,
            },
          )}
        />
      </>,
    );

    expect(screen.getByLabelText("Range")).toHaveClass("range", "range-error");
    expect(screen.getByLabelText("Range")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Range"), { target: { value: "10" } });
    expect(screen.getByLabelText("Hidden")).not.toHaveClass("input-error");
    expect(screen.getByLabelText("Invalid notes")).toHaveClass("textarea-error");
    fireEvent.click(screen.getByLabelText("Read-only checkbox"));
    expect(onValueChange).not.toHaveBeenCalled();
    const readOnlySelect = screen.getByLabelText("Empty select");
    expect(readOnlySelect).toBeDisabled();
    expect(readOnlySelect).toHaveAttribute("aria-readonly", "true");
    fireEvent.change(readOnlySelect, { target: { value: "ignored" } });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Read-only files")).toBeDisabled();
    expect(screen.getByLabelText("Read-only files")).toHaveAttribute(
      "accept",
      "text/plain",
    );
  });
});

describe("DaisyUI slots", () => {
  test("renders hidden fields without a visible wrapper", () => {
    render(
      <Field
        controlId="token"
        field={scalar({ control: "hidden", inputType: "hidden" })}
        invalid={false}
        required={false}
      >
        <input data-testid="hidden-token" type="hidden" />
      </Field>,
    );

    expect(screen.getByTestId("hidden-token")).toBeInTheDocument();
    expect(screen.queryByText("Name")).not.toBeInTheDocument();
  });

  test("renders minimal optional group, array, checkbox, and radio slots", () => {
    const { description: _groupDescription, ...groupBase } = objectField();
    const { description: _arrayDescription, ...arrayBase } = arrayField();
    render(
      <>
        <Group
          disabled={false}
          field={{ ...groupBase, required: false }}
          readOnly={false}
          required={false}
        >
          Group child
        </Group>
        <DaisyArray
          actions={null}
          disabled={false}
          field={{ ...arrayBase, required: false }}
          itemCount={0}
          readOnly={false}
          required={false}
        >
          Array child
        </DaisyArray>
        <Field
          controlId="enabled"
          field={scalar({ control: "checkbox", dataType: "boolean" })}
          invalid={false}
          required={false}
        >
          <input id="enabled" type="checkbox" />
        </Field>
        <Field
          controlId="mode"
          field={scalar({ control: "radio" })}
          invalid={false}
          required={false}
        >
          <div id="mode">Modes</div>
        </Field>
      </>,
    );

    expect(screen.getByText("Group child")).toBeVisible();
    expect(screen.getByText("Array child")).toBeVisible();
    expect(screen.getByLabelText("Name")).toHaveAttribute("type", "checkbox");
    expect(screen.getByText("Modes").previousSibling).toHaveClass(
      "fieldset-legend",
    );
  });

  test("renders consistent form, group, and field markup", () => {
    const field = scalar({
      config: { className: "configured-field" },
      description: "Publicly visible name.",
    });

    render(
      <Form aria-label="Profile form" className="custom-form">
        <Group disabled={false} field={objectField()} readOnly={false} required>
          <Field
            className="manual-field"
            controlId="name"
            descriptionId="name-description"
            error="Enter your name"
            errorId="name-error"
            field={field}
            invalid
            required
            validating
          >
            <input id="name" />
          </Field>
        </Group>
      </Form>,
    );

    expect(screen.getByRole("form", { name: "Profile form" })).toHaveClass(
      "fieldset",
      "custom-form",
    );
    const group = screen.getByRole("group", { name: /Profile/u });
    expect(group).toHaveClass(
      "rounded-box",
      "border",
    );
    const groupDescription = screen.getByText("Tell us who you are.");
    expect(group).toHaveAttribute("aria-describedby", groupDescription.id);
    expect(screen.getByText("Enter your name")).toHaveAttribute("role", "alert");
    expect(screen.getByText("Checking…")).toHaveRole("status");
    expect(screen.getByText("Publicly visible name.")).toHaveAttribute(
      "id",
      "name-description",
    );
    expect(screen.getByLabelText(/Name/u).closest("div")).toHaveClass(
      "manual-field",
    );
  });

  test("renders group errors with composed accessible relationships", () => {
    render(
      <>
        <p id="consumer-help">Consumer-provided help.</p>
        <Group
          aria-describedby="consumer-help"
          disabled={false}
          error="Review this profile"
          errorId="profile-error"
          field={objectField()}
          readOnly={false}
          required
        >
          <input aria-label="Profile name" />
        </Group>
      </>,
    );

    const group = screen.getByRole("group", { name: /Profile/u });
    const description = screen.getByText("Tell us who you are.");
    const error = screen.getByRole("alert");
    expect(group.getAttribute("aria-describedby")?.split(" ")).toEqual([
      "consumer-help",
      description.id,
      "profile-error",
    ]);
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAttribute("data-invalid", "true");
    expect(error).toHaveAttribute("id", "profile-error");
    expect(error).toHaveTextContent("Review this profile");
    expect(error).toHaveClass("label", "text-error");
  });

  test("renders array items, generic action buttons, and array errors", () => {
    const field = arrayField();

    render(
      <DaisyArray
        actions={
          <Button disabled={false} intent="add" type="button">
            Add teammate
          </Button>
        }
        disabled={false}
        error="Add at least one teammate"
        errorId="teammates-error"
        field={field}
        itemCount={1}
        readOnly={false}
        required
      >
        <ArrayItem
          actions={
            <Button
              ariaLabel="Remove Item 1"
              disabled={false}
              intent="remove"
              type="button"
            >
              Remove
            </Button>
          }
          field={field}
          index={0}
          label="Item 1"
        >
          <input aria-label="Teammate name" />
        </ArrayItem>
      </DaisyArray>,
    );

    const array = screen.getByRole("group", { name: /Teammates/u });
    expect(array).toHaveAttribute(
      "data-item-count",
      "1",
    );
    const arrayDescription = screen.getByText("Add at least one teammate.");
    expect(array.getAttribute("aria-describedby")?.split(" ")).toEqual([
      arrayDescription.id,
      "teammates-error",
    ]);
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Item 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add teammate" })).toHaveClass(
      "btn",
      "btn-outline",
    );
    expect(screen.getByRole("button", { name: "Remove Item 1" })).toHaveClass(
      "btn-error",
      "join-item",
    );
    expect(screen.getByText("Add at least one teammate")).toHaveAttribute(
      "id",
      "teammates-error",
    );
  });

  test("renders pending submit, error summary, and unsupported feedback", () => {
    const unsupported: UnsupportedField = {
      config: {
        asyncValidationDebounceMs: 250,
        disabled: false,
        extensions: {},
        hidden: false,
        multiple: false,
        readOnly: false,
        requiredWhenVisible: false,
      },
      key: "metadata",
      kind: "unsupported",
      label: "Metadata",
      nullable: false,
      path: "metadata",
      reason: "Records need a custom control.",
      required: false,
      source: {},
    };

    render(
      <>
        <Button disabled intent="submit" pending type="submit">
          Save profile
        </Button>
        <ErrorSummary
          errors={["Name is required", "Email is invalid"]}
          title="Fix these fields"
        />
        <Unsupported field={unsupported} reason={unsupported.reason} />
      </>,
    );

    const submit = screen.getByRole("button", { name: "Save profile" });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute("aria-busy", "true");
    expect(submit.querySelector(".loading-spinner")).toBeInTheDocument();
    expect(screen.getByText("Fix these fields").closest("[role=alert]")).toHaveClass(
      "alert-error",
    );
    expect(screen.getByText("Records need a custom control.")).toBeInTheDocument();
  });

  test("renders form messages and wizard progress through adapter-owned slots", () => {
    const navigation = (
      <>
        <Button disabled={false} intent="previous" type="button">Back</Button>
        <Button disabled={false} intent="next" type="button">Next</Button>
      </>
    );
    const { rerender } = render(
      <>
        <FormMessage kind="success" message="Saved" />
        <Wizard
          currentStep={1}
          navigation={navigation}
          title="Identity"
          totalSteps={3}
        >
          Identity fields
        </Wizard>
      </>,
    );

    expect(screen.getByText("Saved").closest("[role=status]")).toHaveClass("alert-success");
    expect(screen.getByRole("region", { name: "Identity" })).toBeInTheDocument();
    rerender(
      <>
        <FormMessage kind="success" message="Saved" />
        <Wizard
          currentStep={2}
          navigation={navigation}
          title="Contact"
          totalSteps={3}
        >
          Contact fields
        </Wizard>
      </>,
    );
    expect(screen.getByRole("progressbar", { name: "Step 2 of 3" })).toHaveValue(2);
    expect(screen.getByRole("region", { name: "Contact" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contact" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Back" })).toHaveClass("btn-ghost");
    expect(screen.getByRole("button", { name: "Next" })).toHaveClass("btn-primary");
  });

  test("omits an empty error summary", () => {
    const { container } = render(<ErrorSummary errors={[]} title="Nothing to fix" />);
    expect(container).toBeEmptyDOMElement();
  });

  test("lets structured summary errors route focus back to their field", () => {
    const onSelect = vi.fn<(path: string) => void>();
    render(
      <ErrorSummary
        errors={["Enter a name", "Try again later"]}
        items={[
          {
            focusPath: "profile.name",
            message: "Enter a name",
            path: "profile",
          },
          { message: "Try again later" },
        ]}
        onSelect={onSelect}
        title="Fix these fields"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Enter a name" }));
    expect(onSelect).toHaveBeenCalledWith("profile.name");
    expect(screen.getByText("Try again later")).not.toHaveRole("button");
  });
});

describe("DaisyUI adapter", () => {
  test("provides a client-safe adapter boundary", () => {
    render(<DaisyUIProvider><span>Scoped form</span></DaisyUIProvider>);
    expect(screen.getByText("Scoped form")).toBeVisible();
  });

  test("matches a DaisyUI prefix without rewriting consumer classes", () => {
    const field = scalar({
      config: {
        controlProps: { className: "input-lg" },
      },
    });

    render(
      <DaisyUIProvider prefix="fa-">
        <Form aria-label="Prefixed form" className="custom-form">
          <Input
            {...controlProps(field, {
              inputProps: { "aria-label": "Prefixed input" },
              invalid: true,
            })}
          />
          <Button disabled intent="submit" pending type="submit">
            Save
          </Button>
        </Form>
        <DaisyUIProvider>
          <Input
            {...controlProps(field, {
              inputProps: { "aria-label": "Nested input" },
            })}
          />
        </DaisyUIProvider>
        <Field
          controlId="prefixed-field"
          error="Prefixed field error"
          errorId="prefixed-field-error"
          field={field}
          invalid
          required
        >
          <input id="prefixed-field" />
        </Field>
        <Group
          disabled={false}
          error="Prefixed group error"
          errorId="prefixed-group-error"
          field={objectField()}
          readOnly={false}
          required
        >
          Prefixed group
        </Group>
        <DaisyArray
          actions={null}
          disabled={false}
          field={arrayField()}
          itemCount={1}
          readOnly={false}
          required
        >
          <ArrayItem
            actions={null}
            field={arrayField()}
            index={0}
            label="Prefixed item"
          >
            Item contents
          </ArrayItem>
        </DaisyArray>
        <Wizard
          currentStep={1}
          description="Prefixed description"
          navigation={null}
          title="Prefixed wizard"
          totalSteps={2}
        >
          Wizard contents
        </Wizard>
      </DaisyUIProvider>,
    );

    expect(screen.getByRole("form", { name: "Prefixed form" })).toHaveClass(
      "fa-fieldset",
      "custom-form",
    );
    const input = screen.getByLabelText("Prefixed input");
    expect(input).toHaveClass("fa-input", "fa-input-error", "input-lg");
    expect(input).not.toHaveClass("input", "fa-input-lg");
    const submit = screen.getByRole("button", { name: "Save" });
    expect(submit).toHaveClass("fa-btn", "fa-btn-primary");
    expect(submit.querySelector(".fa-loading-spinner")).toBeInTheDocument();
    expect(screen.getByLabelText("Nested input")).toHaveClass(
      "input",
      "input-lg",
    );
    expect(screen.getByLabelText("Nested input")).not.toHaveClass("fa-input");
    expect(screen.getByText("Prefixed field error")).toHaveClass(
      "fa-label",
      "text-error",
    );
    expect(screen.getByText("Prefixed field error")).not.toHaveClass("fa-text-error");
    expect(screen.getByText("Prefixed group error")).toHaveClass(
      "fa-label",
      "text-error",
    );
    expect(screen.getByText("Prefixed group error"))
      .not.toHaveClass("fa-text-error");
    expect(screen.getByRole("group", { name: /Profile/u })).toHaveClass(
      "bg-base-200",
      "border-base-300",
      "rounded-box",
    );
    expect(screen.getByRole("group", { name: /Profile/u })).not.toHaveClass(
      "fa-bg-base-200",
      "fa-border-base-300",
      "fa-rounded-box",
    );
    expect(screen.getByRole("group", { name: "Prefixed item" })).toHaveClass(
      "bg-base-100",
      "border-base-300",
      "fa-card",
    );
    expect(screen.getByText("Step 1 of 2")).toHaveClass(
      "text-base-content/60",
    );
    expect(screen.getByText("Prefixed description")).toHaveClass(
      "text-base-content/70",
    );
    expect(screen.getByRole("progressbar")).toHaveClass(
      "fa-progress",
      "fa-progress-primary",
    );
  });

  test("owns every built-in control and visible slot", () => {
    expect(daisyUIAdapter.name).toBe("DaisyUI");
    expect(Object.keys(daisyUIAdapter.controls).sort()).toEqual([
      "checkbox",
      "custom",
      "file",
      "input",
      "radio",
      "select",
      "textarea",
    ]);
    expect(Object.keys(daisyUIAdapter.slots).sort()).toEqual([
      "Array",
      "ArrayItem",
      "Button",
      "ErrorSummary",
      "Field",
      "Form",
      "FormMessage",
      "Group",
      "Unsupported",
      "Wizard",
    ]);
    expect(createForm).toBeTypeOf("function");
  });

  test("extends without mutating the built-in adapter", () => {
    function Rating(): ReactNode {
      return <div>Rating</div>;
    }

    const extended = daisyUIAdapter.extend({
      controls: { custom: { rating: Rating } },
      name: "Product UI",
    });

    expect(extended.name).toBe("Product UI");
    expect(extended.controls.custom.rating).toBe(Rating);
    expect(daisyUIAdapter.controls.custom).not.toHaveProperty("rating");
    expect(extended.controls.input).toBe(Input);
  });
});
