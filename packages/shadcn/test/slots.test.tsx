import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  Array as ShadcnArray,
  ArrayItem,
  Button,
  ErrorSummary,
  Field,
  Form,
  FormMessage,
  Group,
  Unsupported,
  Wizard,
} from "../src";
import {
  arrayField,
  objectField,
  scalar,
  unsupportedField,
} from "./fixtures";

describe("shadcn slots", () => {
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

  test("renders minimal optional group, array, checkbox, and radio fields", () => {
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
        <ShadcnArray
          actions={null}
          disabled={false}
          field={{ ...arrayBase, required: false }}
          itemCount={0}
          readOnly={false}
          required={false}
        >
          Array child
        </ShadcnArray>
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
    expect(screen.getByText("Modes").previousSibling).toHaveAttribute(
      "data-slot",
      "field-label",
    );
  });

  test("composes form, group, and field accessibility relationships", () => {
    const field = scalar({
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

    const form = screen.getByRole("form", { name: "Profile form" });
    expect(form).toHaveAttribute("data-slot", "form");
    expect(form).toHaveClass("custom-form", "grid", "w-full");

    const group = screen.getByRole("group", { name: /Profile/u });
    expect(group).toHaveAttribute("data-slot", "field-set");
    const groupDescription = screen.getByText("Tell us who you are.");
    expect(group).toHaveAttribute("aria-describedby", groupDescription.id);

    const fieldError = screen.getByText("Enter your name");
    expect(fieldError).toHaveAttribute("role", "alert");
    expect(fieldError).toHaveAttribute("data-slot", "field-error");
    expect(fieldError).toHaveClass("text-destructive");
    expect(screen.getByText("Checking…")).toHaveRole("status");
    expect(screen.getByText("Publicly visible name.")).toHaveAttribute(
      "id",
      "name-description",
    );
    expect(screen.getByLabelText(/Name/u).closest("div")).toHaveClass(
      "manual-field",
    );
  });

  test("renders object errors inline with composed ARIA metadata", () => {
    render(
      <>
        <p id="consumer-help">Consumer-provided help.</p>
        <Group
          aria-describedby="consumer-help"
          disabled={false}
          error="Review this profile"
          errorId="profile-error"
          field={objectField()}
          readOnly
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
    expect(group).toHaveAttribute("data-readonly", "true");
    expect(error).toHaveAttribute("id", "profile-error");
    expect(error).toHaveTextContent("Review this profile");
    expect(error).toHaveClass("text-destructive");
  });

  test("renders array items, intent buttons, and aggregate errors", () => {
    const field = arrayField();

    render(
      <ShadcnArray
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
            <>
              <Button
                ariaLabel="Move Item 1 up"
                disabled={false}
                intent="move-up"
                type="button"
              >
                Up
              </Button>
              <Button
                ariaLabel="Remove Item 1"
                disabled={false}
                intent="remove"
                type="button"
              >
                Remove
              </Button>
            </>
          }
          field={field}
          index={0}
          label="Item 1"
        >
          <input aria-label="Teammate name" />
        </ArrayItem>
      </ShadcnArray>,
    );

    const array = screen.getByRole("group", { name: /Teammates/u });
    expect(array).toHaveAttribute("data-item-count", "1");
    const arrayDescription = screen.getByText("Add at least one teammate.");
    expect(array.getAttribute("aria-describedby")?.split(" ")).toEqual([
      arrayDescription.id,
      "teammates-error",
    ]);
    expect(screen.getByRole("group", { name: "Item 1" })).toHaveAttribute(
      "data-slot",
      "card",
    );
    expect(screen.getByRole("button", { name: "Add teammate" }))
      .toHaveAttribute("data-intent", "add");
    expect(screen.getByRole("button", { name: "Add teammate" }))
      .toHaveClass("border", "bg-background");
    expect(screen.getByRole("button", { name: "Move Item 1 up" }))
      .toHaveClass("hover:bg-accent");
    expect(screen.getByRole("button", { name: "Remove Item 1" }))
      .toHaveClass("text-destructive");
    expect(screen.getByText("Add at least one teammate")).toHaveAttribute(
      "id",
      "teammates-error",
    );
  });

  test("renders pending buttons, unsupported feedback, and every message kind", () => {
    render(
      <>
        <Button disabled intent="submit" pending type="submit">
          Save profile
        </Button>
        <Unsupported
          field={unsupportedField()}
          reason="Records need a custom control."
        />
        <FormMessage kind="error" message="Server failed" />
        <FormMessage kind="info" message="Draft saved" />
        <FormMessage kind="success" message="Saved" />
      </>,
    );

    const submit = screen.getByRole("button", { name: "Save profile" });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute("aria-busy", "true");
    expect(submit.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.getByText("Records need a custom control.").closest("[role=alert]"))
      .toHaveClass("bg-muted/50", "text-foreground");
    expect(screen.getByText("Server failed").closest("[role=alert]"))
      .toBeInTheDocument();
    expect(screen.getByText("Draft saved").closest("[role=status]"))
      .toBeInTheDocument();
    expect(screen.getByText("Saved").closest("[role=status]"))
      .toBeInTheDocument();
    expect(screen.getByText("Saved").closest("[data-kind]"))
      .toHaveAttribute("data-kind", "success");
  });

  test("omits empty summaries and routes structured errors to their field", () => {
    const onSelect = vi.fn<(path: string) => void>();
    const { rerender } = render(
      <ErrorSummary errors={[]} title="Nothing to fix" />,
    );
    expect(screen.queryByText("Nothing to fix")).not.toBeInTheDocument();

    rerender(
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

    const alert = screen.getByText("Fix these fields").closest("[role=alert]");
    const fieldErrorLink = screen.getByRole("button", { name: "Enter a name" });
    expect(alert).toHaveAttribute("data-slot", "alert");
    expect(alert).toHaveClass("bg-card", "text-destructive");
    expect(fieldErrorLink).not.toHaveClass("bg-destructive");
    expect(fieldErrorLink.className).not.toMatch(
      /(?:^|\s)text-card(?:\s|$)/u,
    );
    fireEvent.click(fieldErrorLink);
    expect(onSelect).toHaveBeenCalledWith("profile.name");
    expect(screen.getByText("Try again later")).not.toHaveRole("button");
  });

  test("renders wizard step metadata, progress, navigation, and focus", () => {
    const navigation = (
      <>
        <Button disabled={false} intent="previous" type="button">Back</Button>
        <Button disabled={false} intent="next" type="button">Next</Button>
      </>
    );
    const firstSteps = [
      {
        completed: false,
        current: true,
        description: "Who you are",
        id: "identity",
        title: "Identity",
      },
      {
        completed: false,
        current: false,
        description: "How to reach you",
        id: "contact",
        title: "Contact",
      },
    ];
    const { rerender } = render(
      <Wizard
        currentStep={1}
        navigation={navigation}
        steps={firstSteps}
        title="Identity"
        totalSteps={2}
      >
        Identity fields
      </Wizard>,
    );

    expect(screen.getByRole("region", { name: "Identity" })).toHaveAttribute(
      "data-step-count",
      "2",
    );
    const firstStepList = screen.getByRole("list", { name: "Form steps" });
    expect(firstStepList).toBeInTheDocument();
    expect(within(firstStepList).getByText("Identity").closest("li"))
      .toHaveAttribute("aria-current", "step");

    rerender(
      <Wizard
        currentStep={2}
        description="How we can reach you"
        navigation={navigation}
        steps={[
          { ...firstSteps[0]!, completed: true, current: false },
          { ...firstSteps[1]!, current: true },
        ]}
        title="Contact"
        totalSteps={2}
      >
        Contact fields
      </Wizard>,
    );

    expect(screen.getByRole("progressbar", { name: "Step 2 of 2" }))
      .toHaveValue(2);
    expect(screen.getByRole("heading", { name: "Contact" })).toHaveFocus();
    expect(within(screen.getByRole("list", { name: "Form steps" }))
      .getByText("Identity").closest("li"))
      .toHaveAttribute("data-completed", "true");
    expect(screen.getByText("Completed")).toHaveClass("sr-only");
    expect(screen.getByRole("navigation", { name: "Wizard navigation" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" }))
      .toHaveClass("hover:bg-accent");
    expect(screen.getByRole("button", { name: "Next" }))
      .toHaveClass("bg-primary");
  });

  test("uses semantic design tokens instead of fixed palette utilities", () => {
    render(
      <>
        <FormMessage kind="error" message="Bad request" />
        <FormMessage kind="success" message="Saved profile" />
        <ErrorSummary errors={["Name is required"]} title="Fix it" />
        <Button disabled={false} intent="remove" type="button">Remove</Button>
        <Unsupported field={unsupportedField()} reason="Unsupported" />
      </>,
    );

    const classNames = [...document.querySelectorAll<HTMLElement>("[class]")]
      .map((element) => element.className)
      .join(" ");
    expect(classNames).toMatch(/(?:destructive|primary|card|foreground)/u);
    expect(classNames).not.toMatch(
      /(?:^|\s)(?:red|green|blue|yellow|orange|amber|zinc|slate|gray|neutral|stone)-\d{2,3}(?:\/\d+)?(?:\s|$)/u,
    );
  });
});
