import {
  Children,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

import type { FormNode } from "@formadapter/core";

import {
  FIELD_COMPONENT,
  FIELDS_COMPONENT,
  STEP_COMPONENT,
  WHEN_COMPONENT,
  componentOwner,
} from "./composition-markers";
import type { RuntimeValues } from "./form-context";
import { isWhenVisible, type RuntimeWhenProps } from "./when";

export interface RuntimeWizardStep {
  readonly id?: string | undefined;
  readonly title: string;
  readonly description?: string | undefined;
  readonly fields: readonly string[];
  readonly body: ReactNode;
  readonly opaqueFields: readonly string[];
  readonly reactKey?: string | undefined;
  readonly when?: ((values: Readonly<Record<string, unknown>>) => boolean) | undefined;
  readonly nextLabel?: string | undefined;
  readonly previousLabel?: string | undefined;
}

interface StepElementProps {
  readonly id?: string | undefined;
  readonly title?: unknown;
  readonly description?: string | undefined;
  readonly children?: ReactNode;
  readonly fields?: readonly string[] | undefined;
  readonly when?: RuntimeWizardStep["when"];
  readonly nextLabel?: string | undefined;
  readonly previousLabel?: string | undefined;
}

function describeCompositionComponent(type: unknown): string | undefined {
  if (componentOwner(type, FIELD_COMPONENT)) return "Field";
  if (componentOwner(type, FIELDS_COMPONENT)) return "Fields";
  if (componentOwner(type, STEP_COMPONENT)) return "Step";
  if (componentOwner(type, WHEN_COMPONENT)) return "When";
  return undefined;
}

function assertMatchingOwner(
  type: unknown,
  marker: symbol,
  owner: object,
  component: string,
): boolean {
  const actualOwner = componentOwner(type, marker);
  if (!actualOwner) return false;
  if (actualOwner !== owner) {
    throw new Error(
      `Wizard ${component} belongs to a different created form. Use components from the same createForm(...) result.`,
    );
  }
  return true;
}

function collectStepElements(
  children: ReactNode,
  owner: object,
): readonly ReactElement<StepElementProps>[] {
  const steps: ReactElement<StepElementProps>[] = [];
  function walk(node: ReactNode): void {
    Children.forEach(node, visit);
  }
  function visit(child: ReactNode): void {
    if (child === null || child === undefined || typeof child === "boolean") return;
    if (typeof child === "string" && child.trim() === "") return;
    if (!isValidElement(child)) {
      throw new Error(
        "Wizard children must be Step elements. Put layout and other content inside a Step.",
      );
    }
    if (child.type === Fragment) {
      walk((child.props as { readonly children?: ReactNode }).children);
      return;
    }
    if (assertMatchingOwner(child.type, STEP_COMPONENT, owner, "Step")) {
      steps.push(child as ReactElement<StepElementProps>);
      return;
    }
    const component = describeCompositionComponent(child.type);
    throw new Error(
      component
        ? `Wizard children must be Step elements, not ${component}. Put ${component} inside a Step.`
        : "Wizard children must be Step elements. Put layout and other content inside a Step.",
    );
  }
  walk(children);
  return steps;
}

type FieldUsageOptions =
  | { readonly active: false }
  | { readonly active: true; readonly values: RuntimeValues };

function collectFieldUsage(
  children: ReactNode,
  root: FormNode<string, unknown>,
  owner: object,
  options: FieldUsageOptions,
): readonly string[] {
  const fields = new Set<string>();
  function walk(node: ReactNode): void {
    Children.forEach(node, visit);
  }
  function visit(child: ReactNode): void {
    if (!isValidElement(child)) return;

    if (assertMatchingOwner(child.type, FIELD_COMPONENT, owner, "Field")) {
      const name = (child.props as { readonly name?: unknown }).name;
      if (typeof name !== "string") {
        throw new Error("Wizard Field requires a string name.");
      }
      fields.add(name);
      return;
    }

    if (assertMatchingOwner(child.type, FIELDS_COMPONENT, owner, "Fields")) {
      const names = (child.props as { readonly names?: unknown }).names;
      if (names === undefined) {
        if (root.kind !== "object") {
          throw new Error(
            "Wizard Fields without names requires an object schema at the root.",
          );
        }
        for (const field of root.children) fields.add(field.path);
        return;
      }
      if (!Array.isArray(names) || names.some((name) => typeof name !== "string")) {
        throw new Error("Wizard Fields names must be an array of field paths.");
      }
      for (const name of names) fields.add(name as string);
      return;
    }

    if (assertMatchingOwner(child.type, WHEN_COMPONENT, owner, "When")) {
      const props = child.props as RuntimeWhenProps<RuntimeValues>;
      if (options.active) {
        walk(isWhenVisible(props, options.values) ? props.children : props.fallback);
      } else {
        walk(props.children);
        walk(props.fallback);
      }
      return;
    }

    if (componentOwner(child.type, STEP_COMPONENT)) {
      assertMatchingOwner(child.type, STEP_COMPONENT, owner, "Step");
      throw new Error("Wizard Step elements cannot be nested inside another Step.");
    }

    if (typeof child.type === "string" || child.type === Fragment) {
      walk((child.props as { readonly children?: ReactNode }).children);
    }
  }
  walk(children);
  return [...fields];
}

function pathsOverlap(left: string, right: string): boolean {
  return left === right ||
    left.startsWith(`${right}.`) ||
    right.startsWith(`${left}.`);
}

export function buildWizardSteps(
  children: ReactNode,
  root: FormNode<string, unknown>,
  owner: object,
): readonly RuntimeWizardStep[] {
  return collectStepElements(children, owner).map((element, index) => {
    const props = element.props;
    if (typeof props.title !== "string" || props.title.trim() === "") {
      throw new Error(`Wizard Step ${index + 1} requires a non-empty title.`);
    }
    const inferredFields = collectFieldUsage(
      props.children,
      root,
      owner,
      { active: false },
    );
    const explicitFields = props.fields;
    if (explicitFields !== undefined) {
      if (
        !Array.isArray(explicitFields) ||
        explicitFields.some((field) => typeof field !== "string")
      ) {
        throw new Error(
          `Wizard step “${props.title}” fields must be an array of field paths.`,
        );
      }
      const redundant = explicitFields.find((declared) =>
        inferredFields.some((rendered) => pathsOverlap(declared, rendered))
      );
      if (redundant) {
        throw new Error(
          `Wizard step “${props.title}” fields includes “${redundant}”, which overlaps a discoverable Field or Fields child. Remove it; fields is only for opaque components.`,
        );
      }
    } else if (inferredFields.length === 0) {
      throw new Error(
        `Wizard step “${props.title}” contains no discoverable fields. Add Field or Fields children, or pass fields for an opaque component (use fields={[]} for a content-only step).`,
      );
    }
    return {
      body: props.children,
      description: props.description,
      fields: [...inferredFields, ...(explicitFields ?? [])],
      id: props.id,
      nextLabel: props.nextLabel,
      opaqueFields: explicitFields ?? [],
      previousLabel: props.previousLabel,
      reactKey: element.key === null ? undefined : String(element.key),
      title: props.title,
      when: props.when,
    };
  });
}

export function activeFieldsForStep(
  step: RuntimeWizardStep,
  root: FormNode<string, unknown>,
  owner: object,
  values: RuntimeValues,
): readonly string[] {
  return [
    ...collectFieldUsage(step.body, root, owner, { active: true, values }),
    ...step.opaqueFields,
  ];
}
