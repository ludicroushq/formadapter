import type { ComponentPropsWithRef } from "react";

import { expect, test } from "vitest";

import { createShadcn as createBaseUIShadcn } from "../src/baseui";
import { createShadcn as createRadixShadcn } from "../src/radix";
import {
  TestButton,
  baseComponents,
  radixComponents,
} from "./components";

function ProductButton({
  analyticsLabel: _analyticsLabel,
  ...props
}: ComponentPropsWithRef<typeof TestButton> & {
    readonly analyticsLabel?: string;
  }): React.JSX.Element {
  return <TestButton {...props} />;
}

function RequiredProductButton({
  analyticsId: _analyticsId,
  ...props
}: ComponentPropsWithRef<typeof TestButton> & {
    readonly analyticsId: string;
  }): React.JSX.Element {
  return <TestButton {...props} />;
}

function verifyRejectedComponents(): void {
  // A required customization must be supplied by a wrapper before FormAdapter
  // can safely render the component.
  createBaseUIShadcn({
    ...baseComponents,
    // @ts-expect-error Required analyticsId is not part of the managed contract.
    Button: RequiredProductButton,
  });

  // The entry points intentionally reject the other primitive family.
  // @ts-expect-error Radix checkbox/ref contracts are not Base UI contracts.
  createBaseUIShadcn(radixComponents);
  // @ts-expect-error Base UI inputRef contracts are not Radix contracts.
  createRadixShadcn(baseComponents);
}

test("infers customized user components without widening their props", () => {
  const setup = createBaseUIShadcn({
    ...baseComponents,
    Button: ProductButton,
  });

  expect(setup.Provider).toBeTypeOf("function");
  expect(verifyRejectedComponents).toBeTypeOf("function");
});
