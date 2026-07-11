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

import {
  changedInputValue,
  inputType,
  inputValue,
  nativeControlProps,
  optionForValue,
  selectedOptionValue,
  serializedOptionValue,
} from "@formadapter/html/native";
import type { ControlProps } from "@formadapter/react";

import {
  Checkbox,
  File as FileControl,
  Input,
  Radio,
  Select,
  Textarea,
} from "../src";
import { cn } from "../src/cn";
import {
  controlProps,
  scalar,
} from "./fixtures";

describe("shadcn control helpers", () => {
  test("merges Tailwind utilities while preserving ordinary classes", () => {
    expect(cn("h-9 w-full", false, undefined, "h-12 custom-input"))
      .toBe("w-full h-12 custom-input");
    expect(cn(null, false, undefined)).toBe("");

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

  test("reuses the canonical native input and option codecs", () => {
    expect(inputType(scalar({ control: "email" }))).toBe("email");
    expect(
      inputType(scalar({
        constraints: { format: "date-time" },
        inputType: "datetime-local",
      })),
    ).toBe("datetime-local");
    expect(inputType(scalar({ control: "textarea", dataType: "integer" })))
      .toBe("number");

    const date = new Date(2026, 6, 9, 15, 30);
    expect(inputValue(date, "date")).toBe("2026-07-09");
    expect(inputValue(date, "datetime-local")).toBe("2026-07-09T15:30");
    expect(inputValue(date, "time")).toBe("15:30");
    expect(inputValue(null)).toBe("");
    expect(changedInputValue(scalar({ dataType: "number" }), "3.5", 3.5))
      .toBe(3.5);
    expect(changedInputValue(scalar({ dataType: "number" }), "bad", Number.NaN))
      .toBe("bad");

    const options = [
      { label: "Null", value: null },
      { label: "False", value: false },
      { label: "Number", value: 2 },
      { label: "String", value: "2" },
    ] as const;
    expect(serializedOptionValue(null)).toBe("null:");
    expect(serializedOptionValue(false)).toBe("boolean:false");
    expect(optionForValue(options, "number:2")?.value).toBe(2);
    expect(selectedOptionValue(options, "2")).toBe("string:2");
    expect(selectedOptionValue(options, undefined)).toBe("");
  });
});

describe("shadcn controls", () => {
  test("renders constrained inputs and lets consumer utilities override defaults", () => {
    const onBlur = vi.fn<() => void>();
    const onValueChange = vi.fn<(value: unknown) => void>();
    const field = scalar({
      config: {
        controlProps: {
          "data-testid": "number-control",
          className: "h-12 custom-input",
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
    expect(input).toHaveAttribute("data-slot", "input");
    expect(input).toHaveAttribute("id", "seat-count");
    expect(input).toHaveAttribute("name", "seats");
    expect(input).toHaveAttribute("min", "1");
    expect(input).toHaveAttribute("max", "20");
    expect(input).toHaveAttribute("step", "any");
    expect(input).toHaveAttribute("aria-describedby", "seat-help");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveClass("h-12", "custom-input");
    expect(input).not.toHaveClass("h-9");
    expect((input as HTMLElement).style.maxWidth).toBe("24rem");

    fireEvent.change(input, { target: { value: "3.5" } });
    fireEvent.blur(input);
    expect(onValueChange).toHaveBeenCalledWith(3.5);
    expect(onBlur).toHaveBeenCalledOnce();

    fireEvent.change(input, { target: { value: "" } });
    expect(onValueChange).toHaveBeenLastCalledWith("");
  });

  test("handles range, hidden, and read-only input variants", () => {
    const onValueChange = vi.fn<(value: unknown) => void>();
    const { rerender } = render(
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
      />,
    );

    const range = screen.getByLabelText("Range");
    expect(range).toHaveAttribute("type", "range");
    expect(range).toBeDisabled();
    expect(range.className).toContain("accent-primary");
    fireEvent.change(range, { target: { value: "10" } });
    expect(onValueChange).not.toHaveBeenCalled();

    rerender(
      <Input
        {...controlProps(
          scalar({ control: "hidden", inputType: "hidden" }),
          { inputProps: { "aria-label": "Hidden" }, invalid: true },
        )}
      />,
    );
    expect(screen.getByLabelText("Hidden")).toHaveAttribute("type", "hidden");
  });

  test("renders textarea metadata and controlled values", () => {
    const onValueChange = vi.fn<(value: unknown) => void>();
    const field = scalar({
      config: {
        controlProps: { className: "min-h-32", rows: 6 },
        placeholder: "Tell us more",
      },
      constraints: { maxLength: 200, minLength: 10 },
      control: "textarea",
    });

    render(
      <Textarea
        {...controlProps(field, {
          invalid: true,
          onValueChange,
          value: "A useful description",
        })}
      />,
    );

    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("data-slot", "textarea");
    expect(textarea).toHaveClass("min-h-32");
    expect(textarea).not.toHaveClass("min-h-16");
    expect(textarea).toHaveAttribute("rows", "6");
    expect(textarea).toHaveAttribute("minlength", "10");
    expect(textarea).toHaveAttribute("maxlength", "200");
    expect(textarea).toHaveAttribute("placeholder", "Tell us more");

    fireEvent.change(textarea, { target: { value: "" } });
    expect(onValueChange).toHaveBeenCalledWith("");
  });

  test("preserves typed native select values and placeholder semantics", () => {
    const onValueChange = vi.fn<(value: unknown) => void>();
    const field = scalar({
      config: {
        controlProps: { className: "h-12" },
        placeholder: "Choose a plan",
      },
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
          invalid: true,
          onValueChange,
          required: false,
          value: 1,
        })}
      />,
    );

    const select = screen.getByRole("combobox");
    expect(select).toHaveAttribute("data-slot", "native-select");
    expect(select).toHaveClass("h-12");
    expect(select).not.toHaveClass("h-9");
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

  test("renders accessible native radio options and respects read-only state", () => {
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
      invalid: true,
      onValueChange,
      value: "starter",
    });
    const { rerender } = render(<Radio {...props} />);

    const starter = screen.getByRole("radio", { name: "Starter" });
    const team = screen.getByRole("radio", { name: "Team" });
    const group = screen.getByRole("radiogroup", { name: "Plan" });
    expect(group).toHaveAttribute("data-slot", "radio-group");
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(starter).toBeChecked();
    expect(starter).toHaveAttribute("data-invalid", "true");
    fireEvent.click(team);
    expect(onValueChange).toHaveBeenCalledWith("team");

    onValueChange.mockClear();
    rerender(<Radio {...props} readOnly />);
    fireEvent.click(team);
    expect(onValueChange).not.toHaveBeenCalled();

    const emptyRef = vi.fn<ControlProps["controlRef"]>();
    rerender(
      <Radio
        {...controlProps(
          { ...field, options: [] },
          { controlRef: emptyRef },
        )}
      />,
    );
    const emptyGroup = screen.getByRole("radiogroup", { name: "Plan" });
    expect(emptyGroup).toHaveAttribute("tabindex", "-1");
    expect(emptyRef).toHaveBeenCalledWith(emptyGroup);
  });

  test("renders required native checkboxes and blocks read-only changes", () => {
    const onValueChange = vi.fn<(value: unknown) => void>();
    const field = scalar({
      control: "checkbox",
      dataType: "boolean",
      label: "Accept terms",
      source: { const: true, type: "boolean" },
    });
    const props = controlProps(field, {
      inputProps: {
        "aria-invalid": true,
        "aria-label": "Accept terms",
      },
      invalid: true,
      onValueChange,
      value: false,
    });
    const { rerender } = render(<Checkbox {...props} />);

    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" });
    expect(checkbox).toHaveAttribute("data-slot", "checkbox");
    expect(checkbox).toBeRequired();
    expect(checkbox).toHaveAttribute("aria-invalid", "true");
    fireEvent.click(checkbox);
    expect(onValueChange).toHaveBeenCalledWith(true);

    onValueChange.mockClear();
    rerender(<Checkbox {...props} readOnly />);
    fireEvent.click(checkbox);
    expect(onValueChange).not.toHaveBeenCalled();

    rerender(
      <Checkbox
        {...controlProps(
          scalar({
            control: "checkbox",
            dataType: "boolean",
            source: { type: "boolean" },
          }),
          {
            inputProps: { "aria-label": "Optional false" },
            required: true,
            value: false,
          },
        )}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "Optional false" }))
      .not.toBeRequired();
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
          inputProps: {
            "aria-invalid": true,
            "aria-label": "Attachment",
          },
          invalid: true,
          onValueChange,
        })}
      />,
    );
    const input = screen.getByLabelText("Attachment");

    expect(input).toHaveAttribute("data-slot", "input");
    expect(input).toHaveAttribute("accept", "image/png");
    expect(input).toHaveAttribute("aria-invalid", "true");
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

  test("synchronizes controlled file selections without lying about filenames", async () => {
    const user = userEvent.setup();
    const field = scalar({ control: "file", dataType: "file" });
    const first = new File(["first"], "first.png", {
      lastModified: 123,
      type: "image/png",
    });
    const replacement = new File(["replacement"], "replacement.png", {
      type: "image/png",
    });
    const props = controlProps(field, {
      inputProps: { "aria-label": "Replaceable attachment" },
    });
    const { rerender } = render(<FileControl {...props} />);
    const input = screen.getByLabelText<HTMLInputElement>(
      "Replaceable attachment",
    );

    await user.upload(input, first);
    expect(input.value).toContain("first.png");

    const selected = input.files?.item(0);
    if (!selected) throw new Error("Expected the browser to select a file");
    const clone = new File([selected], selected.name, {
      lastModified: selected.lastModified,
      type: selected.type,
    });
    rerender(<FileControl {...props} value={clone} />);
    expect(input.value).toContain("first.png");

    rerender(<FileControl {...props} value={replacement} />);
    expect(input.value).toBe("");
    expect(input.files).toHaveLength(0);

    await user.upload(input, first);
    rerender(<FileControl {...props} value="" />);
    expect(input.value).toBe("");
  });

  test("reflects disabled and read-only state across non-text controls", () => {
    const onValueChange = vi.fn<(value: unknown) => void>();
    render(
      <>
        <Textarea
          {...controlProps(scalar({ control: "textarea" }), {
            disabled: true,
            inputProps: { "aria-label": "Disabled notes" },
          })}
        />
        <Select
          {...controlProps(scalar({ control: "select" }), {
            inputProps: { "aria-label": "Read-only select" },
            onValueChange,
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
              readOnly: true,
            },
          )}
        />
      </>,
    );

    expect(screen.getByLabelText("Disabled notes")).toBeDisabled();
    const select = screen.getByLabelText("Read-only select");
    expect(select).toBeDisabled();
    expect(select).toHaveAttribute("aria-readonly", "true");
    fireEvent.change(select, { target: { value: "ignored" } });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Read-only files")).toBeDisabled();
    expect(screen.getByLabelText("Read-only files")).toHaveAttribute(
      "accept",
      "text/plain",
    );
  });
});
