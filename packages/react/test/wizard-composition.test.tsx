import { Fragment, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { compileForm, type FormNode } from "@formadapter/core";

import {
  FIELD_COMPONENT,
  FIELDS_COMPONENT,
  STEP_COMPONENT,
  WHEN_COMPONENT,
  markComponent,
} from "../src/composition-markers";
import { buildWizardSteps } from "../src/wizard-composition";

interface FieldProps {
  readonly name: unknown;
}

interface FieldsProps {
  readonly names?: unknown;
}

interface StepProps {
  readonly children?: ReactNode;
  readonly fields?: unknown;
  readonly title?: unknown;
}

interface WhenProps {
  readonly children?: ReactNode;
  readonly fallback?: ReactNode;
}

function components(owner: object) {
  function Field(_props: FieldProps): null {
    return null;
  }
  function Fields(_props: FieldsProps): null {
    return null;
  }
  function Step({ children }: StepProps): ReactNode {
    return children;
  }
  function When({ children }: WhenProps): ReactNode {
    return children;
  }

  markComponent(Field, FIELD_COMPONENT, owner);
  markComponent(Fields, FIELDS_COMPONENT, owner);
  markComponent(Step, STEP_COMPONENT, owner);
  markComponent(When, WHEN_COMPONENT, owner);
  return { Field, Fields, Step, When };
}

const objectRoot = compileForm(z.object({
  email: z.email(),
  name: z.string(),
  profile: z.object({ name: z.string() }),
})).root;

describe("wizard composition diagnostics", () => {
  it("rejects every bound composition primitive used directly under Wizard", () => {
    const owner = {};
    const { Field, Fields, When } = components(owner);

    expect(() => buildWizardSteps(<Field name="name" />, objectRoot, owner))
      .toThrow(/not Field/u);
    expect(() => buildWizardSteps(<Fields names={["name"]} />, objectRoot, owner))
      .toThrow(/not Fields/u);
    expect(() => buildWizardSteps(<When />, objectRoot, owner))
      .toThrow(/not When/u);
  });

  it("rejects non-Step content and empty titles", () => {
    const owner = {};
    const { Field, Step } = components(owner);

    expect(() => buildWizardSteps("Not a step", objectRoot, owner))
      .toThrow(/children must be Step elements/u);
    expect(() => buildWizardSteps(
      <Step title=" "><Field name="name" /></Step>,
      objectRoot,
      owner,
    )).toThrow(/requires a non-empty title/u);
  });

  it("rejects malformed Field and Fields props at the runtime boundary", () => {
    const owner = {};
    const { Field, Fields, Step } = components(owner);

    expect(() => buildWizardSteps(
      <Step title="Bad field"><Field name={42} /></Step>,
      objectRoot,
      owner,
    )).toThrow(/requires a string name/u);
    expect(() => buildWizardSteps(
      <Step title="Bad fields"><Fields names="name" /></Step>,
      objectRoot,
      owner,
    )).toThrow(/names must be an array/u);
  });

  it("requires an object root when Fields omits names", () => {
    const owner = {};
    const { Fields, Step } = components(owner);
    const scalarRoot = compileForm(z.string()).root as FormNode<string, unknown>;

    expect(() => buildWizardSteps(
      <Step title="All fields"><Fields /></Step>,
      scalarRoot,
      owner,
    )).toThrow(/requires an object schema at the root/u);
  });

  it("rejects nested and cross-form composition components", () => {
    const owner = {};
    const otherOwner = {};
    const { Field, Step } = components(owner);
    const Other = components(otherOwner);

    expect(() => buildWizardSteps(
      <Step title="Outer">
        <Step title="Inner"><Field name="name" /></Step>
      </Step>,
      objectRoot,
      owner,
    )).toThrow(/cannot be nested/u);
    expect(() => buildWizardSteps(
      <Step title="Wrong field"><Other.Field name="name" /></Step>,
      objectRoot,
      owner,
    )).toThrow(/belongs to a different created form/u);
  });

  it("validates opaque ownership without overlapping inferred fields", () => {
    const owner = {};
    const { Field, Step } = components(owner);

    expect(() => buildWizardSteps(
      <Step fields="name" title="Malformed"><div /></Step>,
      objectRoot,
      owner,
    )).toThrow(/fields must be an array/u);
    expect(() => buildWizardSteps(
      <Step fields={["name"]} title="Duplicate">
        <Field name="name" />
      </Step>,
      objectRoot,
      owner,
    )).toThrow(/only for opaque components/u);
    expect(() => buildWizardSteps(
      <Step fields={["profile"]} title="Parent overlap">
        <Field name="profile.name" />
      </Step>,
      objectRoot,
      owner,
    )).toThrow(/only for opaque components/u);
    expect(() => buildWizardSteps(
      <Step fields={["profile.name"]} title="Child overlap">
        <Field name="profile" />
      </Step>,
      objectRoot,
      owner,
    )).toThrow(/only for opaque components/u);
  });

  it("accepts fragments, native layout, Fields without names, and opaque paths", () => {
    const owner = {};
    const { Field, Fields, Step } = components(owner);
    const steps = buildWizardSteps(
      <Fragment>
        <Step fields={["email"]} title="Profile">
          <section><Field name="name" /></section>
        </Step>
        <Step title="Everything"><Fields /></Step>
      </Fragment>,
      objectRoot,
      owner,
    );

    expect(steps[0]?.fields).toEqual(["name", "email"]);
    expect(steps[1]?.fields).toEqual(["email", "name", "profile"]);
  });
});
