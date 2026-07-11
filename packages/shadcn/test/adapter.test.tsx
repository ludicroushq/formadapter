import type { ReactNode } from "react";
import {
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

import {
  FormAdapterProvider,
  createForm as createNeutralForm,
  type ButtonSlotProps,
} from "@formadapter/react";

import {
  Array as ShadcnArray,
  ArrayItem,
  Button,
  Checkbox,
  ErrorSummary,
  Field,
  File as FileControl,
  Form,
  FormMessage,
  Group,
  Input,
  Radio,
  Select,
  ShadcnProvider,
  Textarea,
  Unsupported,
  Wizard,
  createForm,
  shadcnAdapter,
} from "../src";

describe("shadcn adapter", () => {
  test("owns every built-in control and visible slot", () => {
    expect(shadcnAdapter.name).toBe("shadcn/ui");
    expect(shadcnAdapter.controls).toEqual({
      checkbox: Checkbox,
      custom: {},
      file: FileControl,
      input: Input,
      radio: Radio,
      select: Select,
      textarea: Textarea,
    });
    expect(shadcnAdapter.slots).toEqual({
      Array: ShadcnArray,
      ArrayItem,
      Button,
      ErrorSummary,
      Field,
      Form,
      FormMessage,
      Group,
      Unsupported,
      Wizard,
    });
    expect(createForm).toBeTypeOf("function");
  });

  test("extends without mutating the built-in adapter", () => {
    function Rating(): ReactNode {
      return <div>Rating</div>;
    }
    function ProductButton(props: ButtonSlotProps): ReactNode {
      return <button data-testid="product-button" type={props.type}>{props.children}</button>;
    }

    const extended = shadcnAdapter.extend({
      controls: { custom: { rating: Rating } },
      name: "Product UI",
      slots: { Button: ProductButton },
    });

    expect(extended.name).toBe("Product UI");
    expect(extended.controls.custom.rating).toBe(Rating);
    expect(extended.controls.input).toBe(Input);
    expect(extended.slots.Button).toBe(ProductButton);
    expect(shadcnAdapter.controls.custom).not.toHaveProperty("rating");
    expect(shadcnAdapter.slots.Button).toBe(Button);
  });

  test("provides the adapter once to neutral forms", () => {
    const Profile = createNeutralForm(z.object({ name: z.string() }));

    render(
      <ShadcnProvider>
        <Profile.Form aria-label="Provider form" onSubmit={() => undefined} />
      </ShadcnProvider>,
    );

    expect(screen.getByRole("form", { name: "Provider form" }))
      .toHaveAttribute("data-slot", "form");
    expect(screen.getByRole("textbox", { name: /Name/u }))
      .toHaveAttribute("data-slot", "input");
    expect(screen.getByRole("button", { name: "Submit" }))
      .toHaveAttribute("data-slot", "button");
  });

  test("lets a child provider replace the parent adapter for its subtree", () => {
    function ScopedButton({
      children,
      disabled,
      onClick,
      type,
    }: ButtonSlotProps): ReactNode {
      return (
        <button
          data-testid="scoped-button"
          disabled={disabled}
          onClick={onClick}
          type={type}
        >
          {children}
        </button>
      );
    }
    const scopedAdapter = shadcnAdapter.extend({
      name: "Scoped UI",
      slots: { Button: ScopedButton },
    });
    const Profile = createNeutralForm(z.object({ name: z.string() }));

    render(
      <ShadcnProvider>
        <Profile.Form aria-label="Outer form" onSubmit={() => undefined} />
        <FormAdapterProvider adapter={scopedAdapter}>
          <Profile.Form aria-label="Inner form" onSubmit={() => undefined} />
        </FormAdapterProvider>
      </ShadcnProvider>,
    );

    const outer = screen.getByRole("form", { name: "Outer form" });
    const inner = screen.getByRole("form", { name: "Inner form" });
    expect(outer.querySelector("[data-slot=button]")).toBeInTheDocument();
    expect(outer.querySelector("[data-testid=scoped-button]"))
      .not.toBeInTheDocument();
    expect(inner.querySelector("[data-testid=scoped-button]"))
      .toBeInTheDocument();
    expect(inner.querySelector("[data-slot=button]")).not.toBeInTheDocument();
  });

  test("gives a complete form-local adapter priority over its provider", () => {
    function LocalButton({ children, type }: ButtonSlotProps): ReactNode {
      return <button data-testid="local-button" type={type}>{children}</button>;
    }
    const localAdapter = shadcnAdapter.extend({
      name: "Local UI",
      slots: { Button: LocalButton },
    });
    const Profile = createNeutralForm(z.object({ name: z.string() }));

    render(
      <ShadcnProvider>
        <Profile.Form
          adapter={localAdapter}
          aria-label="Local form"
          onSubmit={() => undefined}
        />
      </ShadcnProvider>,
    );

    const form = screen.getByRole("form", { name: "Local form" });
    expect(form.querySelector("[data-testid=local-button]")).toBeInTheDocument();
    expect(form.querySelector("[data-slot=button]")).not.toBeInTheDocument();
  });

  test("renders and submits through the adapter-bound factory without a provider", async () => {
    const user = userEvent.setup();
    const submitted = vi.fn<(
      values: { name: string; notes: string },
      context: unknown,
    ) => void>();
    const Contact = createForm(z.object({
      name: z.string().min(1),
      notes: z.string(),
    })).configure({
      fields: { notes: { control: "textarea" } },
    });

    render(<Contact.Form aria-label="Contact" onSubmit={submitted} />);
    expect(screen.getByRole("form", { name: "Contact" }))
      .toHaveAttribute("data-slot", "form");
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
