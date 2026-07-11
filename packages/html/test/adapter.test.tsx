import type { ReactNode } from "react";
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
import { z } from "zod";

import type {
  ArrayField,
  ObjectField,
  ResolvedFieldConfig,
  ScalarConstraints,
  ScalarField,
  UnsupportedField,
} from "@formadapter/core";
import {
  createForm as createNeutralForm,
  type ControlProps,
} from "@formadapter/react";

import {
  Array as HTMLArray,
  ArrayItem,
  Button,
  Checkbox,
  ErrorSummary,
  Field,
  File as FileControl,
  Form,
  FormMessage,
  Group,
  HTMLProvider,
  Input,
  Radio,
  Select,
  Textarea,
  Unsupported,
  Wizard,
  createForm,
  htmlAdapter,
} from "../src";
import {
  changedInputValue,
  inputType,
  inputValue,
  nativeControlProps,
  optionForValue,
  selectedOptionValue,
  serializedOptionValue,
  type NativeControlProps,
} from "../src/native";

type ScalarOverrides = Partial<Omit<ScalarField, "config" | "constraints">> & {
  readonly config?: Partial<ResolvedFieldConfig>;
  readonly constraints?: Partial<ScalarConstraints>;
};

function scalar(overrides: ScalarOverrides = {}): ScalarField {
  const config: ResolvedFieldConfig = {
    asyncValidationDebounceMs: 250,
    disabled: false,
    extensions: {},
    hidden: false,
    multiple: false,
    readOnly: false,
    requiredWhenVisible: false,
  };
  const constraints: ScalarConstraints = { multiple: false };
  return {
    config: { ...config, ...overrides.config },
    constraints: { ...constraints, ...overrides.constraints },
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

describe("native control helpers", () => {
  test("protects runtime props and preserves safe consumer attributes", () => {
    const empty: NativeControlProps<Record<string, unknown>> = { props: {} };
    expect(empty.props).toEqual({});
    expect(nativeControlProps(scalar())).toEqual({ props: {} });
    expect(nativeControlProps(scalar({
      config: { controlProps: [] as unknown as Record<string, unknown> },
    }))).toEqual({ props: {} });

    const result = nativeControlProps<Record<string, unknown>>(scalar({
      config: {
        controlProps: JSON.parse(
          '{"__proto__":{"polluted":true},"className":"wide","id":"bad","style":{"color":"red"},"data-safe":"yes"}',
        ) as Record<string, unknown>,
      },
    }));
    expect(result).toEqual({
      className: "wide",
      props: { "data-safe": "yes" },
      style: { color: "red" },
    });
    expect(Object.prototype).not.toHaveProperty("polluted");
  });

  test("maps schema semantics to native input types and values", () => {
    expect(inputType(scalar({ inputType: "datetime-local" }))).toBe(
      "datetime-local",
    );
    for (const control of [
      "date",
      "email",
      "hidden",
      "number",
      "password",
      "range",
      "search",
      "tel",
      "text",
      "time",
      "url",
    ] as const) {
      expect(inputType(scalar({ control }))).toBe(control);
    }
    expect(inputType(scalar({ control: "textarea", dataType: "integer" })))
      .toBe("number");
    for (const [format, expected] of [
      ["date", "date"],
      ["date-time", "text"],
      ["email", "email"],
      ["password", "password"],
      ["tel", "tel"],
      ["time", "time"],
      ["uri", "url"],
      ["url", "url"],
      [undefined, "text"],
    ] as const) {
      expect(inputType(scalar({
        constraints: format === undefined ? {} : { format },
        control: "custom" as never,
      }))).toBe(expected);
    }

    const date = new Date(2026, 6, 9, 15, 30);
    expect(inputValue(date, "date")).toBe("2026-07-09");
    expect(inputValue(date, "datetime-local")).toBe("2026-07-09T15:30");
    expect(inputValue(date, "time")).toBe("15:30");
    expect(inputValue(date)).toBe(date.toISOString());
    expect(inputValue(null)).toBe("");
    expect(inputValue(undefined)).toBe("");
    expect(inputValue("Ada")).toBe("Ada");
    expect(inputValue(4)).toBe(4);
    expect(inputValue(true)).toBe("true");

    expect(changedInputValue(scalar({ dataType: "number" }), "3.5", 3.5))
      .toBe(3.5);
    expect(changedInputValue(scalar({ dataType: "number" }), "no", Number.NaN))
      .toBe("no");
    expect(changedInputValue(scalar({ dataType: "number" }), "", Number.NaN))
      .toBe("");
    expect(changedInputValue(scalar(), "Ada", Number.NaN)).toBe("Ada");
  });

  test("round-trips every supported primitive option without collisions", () => {
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

describe("native controls", () => {
  test("renders constrained inputs without adding presentation", () => {
    const onBlur = vi.fn<() => void>();
    const onValueChange = vi.fn<(value: unknown) => void>();
    const field = scalar({
      config: {
        controlProps: {
          className: "consumer-input",
          "data-testid": "seats",
          id: "ignored",
          style: { maxWidth: "20rem" },
          value: "ignored",
        },
        placeholder: "Seats",
      },
      constraints: { maximum: 10, minimum: 1, multipleOf: 0.5 },
      control: "number",
      dataType: "number",
    });
    render(<Input {...controlProps(field, {
      id: "seat-count",
      inputProps: { "aria-describedby": "help", "aria-invalid": true },
      name: "seatCount",
      onBlur,
      onValueChange,
      value: 2.5,
    })} />);

    const input = screen.getByTestId("seats");
    expect(input).toHaveAttribute("id", "seat-count");
    expect(input).toHaveAttribute("name", "seatCount");
    expect(input).toHaveAttribute("min", "1");
    expect(input).toHaveAttribute("max", "10");
    expect(input).toHaveAttribute("step", "0.5");
    expect(input).toHaveAttribute("aria-describedby", "help");
    expect(input).toHaveClass("consumer-input");
    expect((input as HTMLElement).style.maxWidth).toBe("20rem");
    fireEvent.change(input, { target: { value: "3.5" } });
    fireEvent.blur(input);
    expect(onValueChange).toHaveBeenCalledWith(3.5);
    expect(onBlur).toHaveBeenCalledOnce();
  });

  test("handles integer, range, and read-only input behavior", () => {
    const onValueChange = vi.fn<(value: unknown) => void>();
    render(
      <>
        <Input {...controlProps(scalar({ dataType: "integer" }), {
          inputProps: { "aria-label": "Integer" },
        })} />
        <Input {...controlProps(scalar({ control: "range" }), {
          inputProps: { "aria-label": "Range" },
          onValueChange,
          readOnly: true,
        })} />
        <Input {...controlProps(scalar(), {
          inputProps: { "aria-label": "Read-only text" },
          onValueChange,
          readOnly: true,
        })} />
      </>,
    );
    expect(screen.getByLabelText("Integer")).toHaveAttribute("step", "1");
    expect(screen.getByLabelText("Range")).toBeDisabled();
    expect(screen.getByLabelText("Read-only text")).toHaveAttribute("readonly");
    fireEvent.change(screen.getByLabelText("Read-only text"), {
      target: { value: "ignored" },
    });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("renders and updates a configured textarea", () => {
    const onValueChange = vi.fn<(value: unknown) => void>();
    const props = controlProps(scalar({
      config: { controlProps: { className: "notes", rows: 4 } },
      constraints: { maxLength: 100, minLength: 2 },
      control: "textarea",
    }), { onValueChange, value: "Hello" });
    const { rerender } = render(<Textarea {...props} />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("rows", "4");
    expect(textarea).toHaveAttribute("minlength", "2");
    expect(textarea).toHaveAttribute("maxlength", "100");
    fireEvent.change(textarea, { target: { value: "Updated" } });
    expect(onValueChange).toHaveBeenCalledWith("Updated");
    onValueChange.mockClear();
    rerender(<Textarea {...props} readOnly />);
    fireEvent.change(textarea, { target: { value: "Ignored" } });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("preserves typed select values and read-only semantics", () => {
    const onValueChange = vi.fn<(value: unknown) => void>();
    const field = scalar({
      config: { placeholder: "Choose" },
      control: "select",
      options: [
        { label: "Number", value: 2 },
        { label: "String", value: "2" },
        { label: "None", value: null },
      ],
      required: false,
    });
    const props = controlProps(field, {
      onValueChange,
      required: false,
      value: 2,
    });
    const { rerender } = render(<Select {...props} />);
    const select = screen.getByRole("combobox");
    expect(screen.getByRole("option", { name: "Choose" })).toBeEnabled();
    for (const [label, expected] of [
      ["String", "2"],
      ["None", null],
    ] as const) {
      const option = screen.getByRole<HTMLOptionElement>("option", { name: label });
      fireEvent.change(select, { target: { value: option.value } });
      expect(onValueChange).toHaveBeenLastCalledWith(expected);
    }
    fireEvent.change(select, { target: { value: "" } });
    expect(onValueChange).toHaveBeenLastCalledWith("");
    onValueChange.mockClear();
    rerender(<Select {...props} readOnly />);
    expect(select).toBeDisabled();
    expect(select).toHaveAttribute("aria-readonly", "true");
    fireEvent.change(select, { target: { value: "string:2" } });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("renders typed radios with a focusable empty state", () => {
    const onValueChange = vi.fn<(value: unknown) => void>();
    const field = scalar({
      control: "radio",
      label: "Plan",
      options: [
        { label: "Starter", value: "starter" },
        { label: "Team", value: "team" },
      ],
    });
    const props = controlProps(field, { onValueChange, value: "starter" });
    const { rerender } = render(<Radio {...props} />);
    expect(screen.getByRole("radiogroup", { name: "Plan" })).not.toHaveAttribute(
      "style",
    );
    expect(screen.getByRole("radio", { name: "Starter" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Team" }));
    expect(onValueChange).toHaveBeenCalledWith("team");
    onValueChange.mockClear();
    rerender(<Radio {...props} readOnly />);
    fireEvent.click(screen.getByRole("radio", { name: "Team" }));
    expect(onValueChange).not.toHaveBeenCalled();

    const controlRef = vi.fn<ControlProps["controlRef"]>();
    rerender(<Radio {...controlProps({ ...field, options: [] }, { controlRef })} />);
    const empty = screen.getByRole("radiogroup", { name: "Plan" });
    expect(empty).toHaveAttribute("tabindex", "-1");
    expect(controlRef).toHaveBeenCalledWith(empty);
  });

  test("only makes must-be-true checkboxes natively required", () => {
    const onValueChange = vi.fn<(value: unknown) => void>();
    const mustAccept = scalar({
      control: "checkbox",
      dataType: "boolean",
      source: { const: true, type: "boolean" },
    });
    const props = controlProps(mustAccept, {
      inputProps: { "aria-label": "Accept" },
      onValueChange,
      required: true,
      value: false,
    });
    const { rerender } = render(<Checkbox {...props} />);
    const checkbox = screen.getByRole("checkbox", { name: "Accept" });
    expect(checkbox).toBeRequired();
    fireEvent.click(checkbox);
    expect(onValueChange).toHaveBeenCalledWith(true);

    rerender(<Checkbox {...props} field={scalar({
      control: "checkbox",
      dataType: "boolean",
      source: { type: "boolean" },
    })} />);
    expect(checkbox).not.toBeRequired();
    onValueChange.mockClear();
    rerender(<Checkbox {...props} readOnly />);
    fireEvent.click(checkbox);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("emits single and multiple files and clears stale native selections", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn<(value: unknown) => void>();
    const first = new File(["one"], "one.png", {
      lastModified: 123,
      type: "image/png",
    });
    const second = new File(["two"], "two.png", { type: "image/png" });
    const single = scalar({
      constraints: { contentMediaType: "image/png" },
      control: "file",
      dataType: "file",
    });
    const props = controlProps(single, {
      inputProps: { "aria-label": "Attachment" },
      onValueChange,
    });
    const { rerender } = render(<FileControl {...props} />);
    const input = screen.getByLabelText<HTMLInputElement>("Attachment");
    expect(input).toHaveAttribute("accept", "image/png");
    await user.upload(input, first);
    expect(onValueChange).toHaveBeenCalledWith(first);
    expect(input.value).toContain("one.png");

    rerender(<FileControl {...props} value={input.files} />);
    expect(input.value).toContain("one.png");
    rerender(<FileControl {...props} value={{
      lastModified: first.lastModified,
      name: first.name,
      size: first.size,
      type: first.type,
    }} />);
    expect(input.value).toContain("one.png");
    rerender(<FileControl {...props} value={second} />);
    expect(input.value).toBe("");

    const multiple = scalar({
      config: { multiple: true },
      control: "file",
      dataType: "file",
    });
    rerender(<FileControl {...controlProps(multiple, {
      inputProps: { "aria-label": "Attachment" },
      onValueChange,
    })} />);
    await user.upload(input, [first, second]);
    expect(onValueChange).toHaveBeenLastCalledWith([first, second]);
    rerender(<FileControl {...controlProps(multiple, {
      inputProps: { "aria-label": "Attachment" },
      onValueChange,
      value: [first, second],
    })} />);
    expect(input.value).toContain("one.png");
    rerender(<FileControl {...controlProps(multiple, {
      inputProps: { "aria-label": "Attachment" },
      onValueChange,
      value: "",
    })} />);
    expect(input.value).toBe("");
    rerender(<FileControl {...controlProps(multiple, {
      inputProps: { "aria-label": "Attachment" },
      onValueChange,
      readOnly: true,
    })} />);
    expect(input).toBeDisabled();
    expect(input).not.toHaveAttribute("aria-readonly");
  });
});

describe("semantic slots", () => {
  test("renders hidden fields without visible wrapper content", () => {
    render(
      <Field
        controlId="token"
        field={scalar({ control: "hidden", inputType: "hidden" })}
        invalid={false}
        required={false}
      >
        <input data-testid="token" type="hidden" />
      </Field>,
    );
    expect(screen.getByTestId("token")).toBeInTheDocument();
    expect(screen.queryByText("Name")).not.toBeInTheDocument();
  });

  test("connects labels, descriptions, validation, and object errors", () => {
    render(
      <Form aria-label="Profile form" className="consumer-form">
        <Group
          aria-describedby="consumer-help"
          disabled
          error="Review this profile"
          errorId="profile-error"
          field={objectField()}
          readOnly
          required
        >
          <p id="consumer-help">Consumer help</p>
          <Field
            className="consumer-field"
            controlId="name"
            descriptionId="name-description"
            error="Enter a name"
            errorId="name-error"
            field={scalar({ description: "Public name" })}
            invalid
            required
            validating
          >
            <input id="name" />
          </Field>
        </Group>
      </Form>,
    );
    const form = screen.getByRole("form", { name: "Profile form" });
    expect(form).toHaveClass("consumer-form");
    expect(form).not.toHaveAttribute("style");
    const group = screen.getByRole("group", { name: /Profile/u });
    const description = screen.getByText("Tell us who you are.");
    expect(group.getAttribute("aria-describedby")?.split(" ")).toEqual([
      "consumer-help",
      description.id,
      "profile-error",
    ]);
    expect(group).toHaveAttribute("aria-disabled", "true");
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAttribute("data-readonly", "true");
    expect(screen.getByLabelText(/Name/u)).toHaveAttribute("id", "name");
    expect(screen.getByText("Public name")).toHaveAttribute(
      "id",
      "name-description",
    );
    expect(screen.getByText("Checking…")).toHaveRole("status");
    expect(screen.getByText("Enter a name")).toHaveAttribute("role", "alert");
    expect(screen.getByText("Review this profile")).toHaveAttribute(
      "id",
      "profile-error",
    );
  });

  test("renders checkbox and radio field labels without invalid nesting", () => {
    render(
      <>
        <Field
          controlId="enabled"
          field={scalar({ control: "checkbox", dataType: "boolean" })}
          invalid={false}
          required={false}
        >
          <input id="enabled" type="checkbox" />
        </Field>
        <Field
          controlId="plan"
          field={scalar({ control: "radio" })}
          invalid={false}
          required
        >
          <div id="plan">Plans</div>
        </Field>
      </>,
    );
    expect(screen.getByRole("checkbox", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByText("Plans").previousSibling).toHaveTextContent("Name *");
  });

  test("keeps optional groups and arrays minimal and unstyled", () => {
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
        <HTMLArray
          actions={null}
          aria-describedby="array-help"
          disabled={false}
          field={{ ...arrayBase, required: false }}
          itemCount={0}
          readOnly={false}
          required={false}
        >
          Array child
        </HTMLArray>
        <p id="array-help">Array help</p>
        <Wizard
          currentStep={1}
          navigation={null}
          title="Only step"
          totalSteps={1}
        >
          Step child
        </Wizard>
      </>,
    );

    const group = screen.getByRole("group", { name: "Profile" });
    expect(group).not.toHaveAttribute("aria-describedby");
    expect(group).not.toHaveAttribute("aria-disabled");
    expect(group).not.toHaveAttribute("aria-invalid");
    expect(group).not.toHaveAttribute("class");
    expect(group).not.toHaveAttribute("style");
    const array = screen.getByRole("group", { name: "Teammates" });
    expect(array).toHaveAttribute("aria-describedby", "array-help");
    expect(array).not.toHaveAttribute("data-invalid");
    expect(array).not.toHaveAttribute("data-readonly");
    expect(screen.queryByRole("list", { name: "Form steps" }))
      .not.toBeInTheDocument();
  });

  test("renders arrays, items, semantic actions, and aggregate errors", () => {
    const field = arrayField();
    render(
      <HTMLArray
        actions={<Button disabled={false} intent="add" type="button">Add</Button>}
        disabled={false}
        error="Add a teammate"
        errorId="teammates-error"
        field={field}
        itemCount={1}
        readOnly
        required
      >
        <ArrayItem
          actions={
            <Button
              ariaLabel="Remove item 1"
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
          <input aria-label="Teammate" />
        </ArrayItem>
      </HTMLArray>,
    );
    const array = screen.getByRole("group", { name: /Teammates/u });
    const description = screen.getByText("Add at least one teammate.");
    expect(array.getAttribute("aria-describedby")?.split(" ")).toEqual([
      description.id,
      "teammates-error",
    ]);
    expect(array).toHaveAttribute("data-item-count", "1");
    expect(array).toHaveAttribute("data-readonly", "true");
    expect(screen.getByRole("group", { name: "Item 1" })).toHaveAttribute(
      "data-item-index",
      "0",
    );
    expect(screen.getByRole("button", { name: "Remove item 1" }))
      .toHaveAttribute("data-intent", "remove");
    expect(screen.getByText("Add a teammate")).toHaveAttribute(
      "id",
      "teammates-error",
    );
  });

  test("renders summaries, messages, pending state, and unsupported nodes", () => {
    const onSelect = vi.fn<(path: string) => void>();
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
        <Button disabled intent="submit" pending type="submit">Save</Button>
        <ErrorSummary
          errors={["Enter a name", "Try later"]}
          items={[
            { focusPath: "profile.name", message: "Enter a name", path: "profile" },
            { message: "Try later" },
          ]}
          onSelect={onSelect}
          title="Fix these fields"
        />
        <FormMessage kind="error" message="Server failed" />
        <FormMessage kind="info" message="Draft saved" />
        <FormMessage kind="success" message="Saved" />
        <Unsupported field={unsupported} reason={unsupported.reason} />
      </>,
    );
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Enter a name" }));
    expect(onSelect).toHaveBeenCalledWith("profile.name");
    expect(screen.getByText("Try later")).not.toHaveRole("button");
    expect(screen.getByText("Server failed")).toHaveRole("alert");
    expect(screen.getByText("Server failed")).not.toHaveAttribute("aria-live");
    expect(screen.getByText("Draft saved")).toHaveRole("status");
    expect(screen.getByText("Saved")).toHaveAttribute("data-kind", "success");
    expect(screen.getByText("Records need a custom control.")).toBeInTheDocument();
  });

  test("omits empty summaries and supports the simple errors API", () => {
    const { rerender } = render(<ErrorSummary errors={[]} title="Nothing" />);
    expect(screen.queryByText("Nothing")).not.toBeInTheDocument();
    rerender(<ErrorSummary errors={["Name is required"]} title="Fix it" />);
    expect(screen.getByText("Name is required")).toBeInTheDocument();
  });

  test("announces wizard progress, step metadata, and focuses new headings", () => {
    const navigation = (
      <>
        <Button disabled={false} intent="previous" type="button">Back</Button>
        <Button disabled={false} intent="next" type="button">Next</Button>
      </>
    );
    const steps = [
      { completed: true, current: false, id: "identity", title: "Identity" },
      { completed: false, current: true, id: "contact", title: "Contact" },
    ];
    const { rerender } = render(
      <Wizard
        currentStep={1}
        navigation={navigation}
        steps={steps.map((step, index) => ({
          ...step,
          completed: false,
          current: index === 0,
        }))}
        title="Identity"
        totalSteps={2}
      >
        Identity fields
      </Wizard>,
    );
    expect(screen.getByRole("region", { name: "Identity" })).not.toHaveAttribute(
      "class",
    );
    expect(screen.getByRole("list", { name: "Form steps" })).toBeInTheDocument();
    rerender(
      <Wizard
        currentStep={2}
        description="How we can reach you"
        navigation={navigation}
        steps={steps}
        title="Contact"
        totalSteps={2}
      >
        Contact fields
      </Wizard>,
    );
    expect(screen.getByRole("progressbar", { name: "Step 2 of 2" }))
      .toHaveValue(2);
    expect(screen.getByRole("heading", { name: "Contact" })).toHaveFocus();
    expect(screen.getByText("Contact", { selector: "li" })).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.getByText("Identity", { selector: "li" })).toHaveAttribute(
      "data-completed",
      "true",
    );
    expect(screen.getByRole("navigation", { name: "Wizard navigation" }))
      .toBeInTheDocument();
  });
});

describe("HTML adapter", () => {
  test("provides the adapter once and exposes a complete immutable base", () => {
    const Neutral = createNeutralForm(z.object({ name: z.string() }));
    render(
      <HTMLProvider>
        <Neutral.Form aria-label="Provider form" onSubmit={() => undefined} />
      </HTMLProvider>,
    );
    expect(screen.getByRole("form", { name: "Provider form" }))
      .toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Name/u })).toBeInTheDocument();
    expect(htmlAdapter.name).toBe("HTML");
    expect(Object.keys(htmlAdapter.controls).sort()).toEqual([
      "checkbox",
      "custom",
      "file",
      "input",
      "radio",
      "select",
      "textarea",
    ]);
    expect(Object.keys(htmlAdapter.slots).sort()).toEqual([
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

    function Rating(): ReactNode {
      return <div>Rating</div>;
    }
    const extended = htmlAdapter.extend({
      controls: { custom: { rating: Rating } },
      name: "Product UI",
    });
    expect(extended.name).toBe("Product UI");
    expect(extended.controls.custom.rating).toBe(Rating);
    expect(extended.controls.input).toBe(Input);
    expect(htmlAdapter.controls.custom).not.toHaveProperty("rating");
    expect(createForm).toBeTypeOf("function");
  });

  test("renders and submits a schema with the adapter-bound factory", async () => {
    const user = userEvent.setup();
    const submitted = vi.fn<(
      value: { name: string; notes: string },
      context: unknown,
    ) => void>();
    const Contact = createForm(z.object({
      name: z.string().min(1),
      notes: z.string(),
    })).configure({ fields: { notes: { control: "textarea" } } });

    render(<Contact.Form aria-label="Contact" onSubmit={submitted} />);
    expect(screen.getByRole("form", { name: "Contact" })).not.toHaveAttribute(
      "class",
    );
    expect(screen.getByRole("textbox", { name: /Name/u })).not.toHaveAttribute(
      "class",
    );
    await user.type(screen.getByRole("textbox", { name: /Name/u }), "Ada");
    await user.type(screen.getByRole("textbox", { name: /Notes/u }), "Hello");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(submitted).toHaveBeenCalledWith(
      { name: "Ada", notes: "Hello" },
      expect.objectContaining({
        formData: expect.any(FormData),
        input: { name: "Ada", notes: "Hello" },
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
