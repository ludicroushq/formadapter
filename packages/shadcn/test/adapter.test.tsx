import type { ReactNode } from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { z } from "zod";

import {
  FormAdapterProvider,
  createForm as createNeutralForm,
  type ButtonSlotProps,
} from "@formadapter/react";

import { createShadcn as createBaseUIShadcn } from "../src/baseui";
import { createShadcn as createRadixShadcn } from "../src/radix";
import { baseComponents, radixComponents } from "./components";

describe.each([
  ["Base UI", () => createBaseUIShadcn(baseComponents), "shadcn/ui (Base UI)"],
  ["Radix UI", () => createRadixShadcn(radixComponents), "shadcn/ui (Radix UI)"],
] as const)("shadcn %s connector", (_label, create, expectedName) => {
  test("creates a complete adapter, provider, and bound form factory", () => {
    const setup = create();

    expect(setup.adapter.name).toBe(expectedName);
    expect(Object.keys(setup.adapter.controls)).toEqual([
      "checkbox",
      "custom",
      "file",
      "input",
      "radio",
      "select",
      "textarea",
    ]);
    expect(Object.keys(setup.adapter.slots)).toEqual([
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
    expect(setup.Provider).toBeTypeOf("function");
    expect(setup.createForm).toBeTypeOf("function");
  });

  test("provides the adapter once to neutral forms", () => {
    const { Provider } = create();
    const Profile = createNeutralForm(z.object({ name: z.string() }));

    render(
      <Provider>
        <Profile.Form aria-label="Provider form" onSubmit={() => undefined} />
      </Provider>,
    );

    expect(screen.getByRole("form", { name: "Provider form" }))
      .toHaveAttribute("data-slot", "form");
    expect(screen.getByRole("textbox", { name: /Name/u }))
      .toHaveAttribute("data-ui", "input");
    expect(screen.getByRole("button", { name: "Submit" }))
      .toHaveAttribute("data-ui", "button");
  });

  test("renders and submits through its bound factory without a provider", async () => {
    const user = userEvent.setup();
    const { createForm } = create();
    const submitted = vi.fn<(values: unknown, context: unknown) => void>();
    const Contact = createForm(z.object({
      name: z.string().min(1),
      notes: z.string(),
    })).configure({ fields: { notes: { control: "textarea" } } });

    render(<Contact.Form aria-label="Contact" onSubmit={submitted} />);
    await user.type(screen.getByRole("textbox", { name: /Name/u }), "Ada");
    await user.type(screen.getByRole("textbox", { name: /Notes/u }), "Hello");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(submitted).toHaveBeenCalledWith(
      { name: "Ada", notes: "Hello" },
      expect.objectContaining({ input: { name: "Ada", notes: "Hello" } }),
    );
  });
});

test("a child adapter provider replaces the parent in its scope", () => {
  const { adapter, Provider } = createBaseUIShadcn(baseComponents);
  function ScopedButton({ children, type }: ButtonSlotProps): ReactNode {
    return <button data-testid="scoped" type={type}>{children}</button>;
  }
  const scoped = adapter.extend({ slots: { Button: ScopedButton } });
  const Profile = createNeutralForm(z.object({ name: z.string() }));

  render(
    <Provider>
      <Profile.Form aria-label="Outer" onSubmit={() => undefined} />
      <FormAdapterProvider adapter={scoped}>
        <Profile.Form aria-label="Inner" onSubmit={() => undefined} />
      </FormAdapterProvider>
    </Provider>,
  );

  const outer = screen.getByRole("form", { name: "Outer" });
  const inner = screen.getByRole("form", { name: "Inner" });
  expect(outer.querySelector("[data-ui=button]")).toBeInTheDocument();
  expect(outer.querySelector("[data-testid=scoped]")).not.toBeInTheDocument();
  expect(inner.querySelector("[data-testid=scoped]")).toBeInTheDocument();
});
