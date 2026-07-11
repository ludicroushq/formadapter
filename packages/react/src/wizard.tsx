"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useFormContext } from "react-hook-form";

import {
  pathToConfigPath,
  type FormNode,
} from "@formadapter/core";

import { RuntimeFields, RuntimeSubmit } from "./bound-parts";
import { useFormRuntime, type RuntimeValues } from "./form-context";
import {
  flattenHookFormErrors,
  hookFormErrorItems,
} from "./resolver";
import { firstFocusablePath } from "./runtime-utils";
import {
  activeFieldsForStep,
  buildWizardSteps,
  type RuntimeWizardStep,
} from "./wizard-composition";

export interface RuntimeWizardProps {
  readonly children: ReactNode;
  readonly compositionOwner: object;
  readonly includeRemaining: boolean;
  readonly nextLabel: string;
  readonly previousLabel: string;
  readonly remainingTitle: string;
}

interface ResolvedWizardStep extends RuntimeWizardStep {
  readonly activeFields: readonly string[];
  readonly runtimeKey: string;
}

function runtimeStepKey(step: RuntimeWizardStep, index: number): string {
  if (step.id !== undefined) return `id:${step.id}`;
  if (step.reactKey !== undefined) return `key:${step.reactKey}`;
  return `index:${index}`;
}

function isCovered(path: string, assigned: ReadonlySet<string>): boolean {
  for (const candidate of assigned) {
    if (
      candidate === path ||
      candidate.startsWith(`${path}.`) ||
      path.startsWith(`${candidate}.`)
    ) return true;
  }
  return false;
}

function collectRemaining(
  node: FormNode<string, unknown>,
  assigned: ReadonlySet<string>,
): readonly string[] {
  if (node.kind !== "object") return node.path ? [node.path] : [];
  const remaining: string[] = [];
  for (const child of node.children) {
    if (isCovered(child.path, assigned)) {
      if (
        child.kind === "object" &&
        !assigned.has(child.path) &&
        [...assigned].some((path) => path.startsWith(`${child.path}.`))
      ) {
        remaining.push(...collectRemaining(child, assigned));
      }
      continue;
    }
    remaining.push(child.path);
  }
  return remaining;
}

function stepOwnsError(step: RuntimeWizardStep, errorPath: string): boolean {
  return step.fields.some((field) =>
    errorPath === field ||
    errorPath.startsWith(`${field}.`) ||
    field.startsWith(`${errorPath}.`)
  );
}

function focusableErrorPath(
  model: ReturnType<typeof useFormRuntime>["model"],
  errorPath: string,
  values: RuntimeValues,
  disabled: boolean,
): string | undefined {
  const concretePath = errorPath.split(".").map((segment) =>
    /^(?:0|[1-9]\d*)$/.test(segment) ? Number(segment) : segment
  );
  const configPath = pathToConfigPath(concretePath);
  const errorNode = Object.prototype.hasOwnProperty.call(
    model.fieldMap,
    configPath,
  )
    ? model.fieldMap[configPath]
    : undefined;
  return errorNode
    ? firstFocusablePath(errorNode, errorPath, values, disabled)
    : errorPath;
}

export function RuntimeWizard({
  children,
  compositionOwner,
  includeRemaining,
  nextLabel,
  previousLabel,
  remainingTitle,
}: RuntimeWizardProps): ReactNode {
  const {
    adapter,
    disabled,
    model,
    registerErrorFocus,
    values,
  } = useFormRuntime();
  const methods = useFormContext<RuntimeValues>();
  const steps = useMemo(
    () => buildWizardSteps(children, model.root, compositionOwner),
    [children, compositionOwner, model.root],
  );
  const errors = flattenHookFormErrors(methods.formState.errors);
  const errorPathSignature = JSON.stringify(
    [...new Set(
      hookFormErrorItems(methods.formState.errors).flatMap((item) =>
        item.path ? [item.path] : []
      ),
    )],
  );
  const errorPaths = useMemo<readonly string[]>(
    () => JSON.parse(errorPathSignature) as string[],
    [errorPathSignature],
  );
  const [revealedConditionalSteps, setRevealedConditionalSteps] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const assigned = useMemo(() => {
    const owned: string[] = [];
    const ids = new Set<string>();
    const runtimeKeys = new Set<string>();
    for (const [index, step] of steps.entries()) {
      if (step.id !== undefined) {
        if (ids.has(step.id)) {
          throw new Error(`Wizard step id “${step.id}” is duplicated.`);
        }
        ids.add(step.id);
      }
      const runtimeKey = runtimeStepKey(step, index);
      if (runtimeKeys.has(runtimeKey)) {
        throw new Error(`Wizard step identity “${runtimeKey}” is duplicated.`);
      }
      runtimeKeys.add(runtimeKey);
      for (const field of step.fields) {
        if (field.includes("[]")) {
          throw new Error(
            `Wizard field “${field}” is an array-item path. Assign its parent array to one step instead.`,
          );
        }
        if (!Object.prototype.hasOwnProperty.call(model.fieldMap, field)) {
          throw new Error(`Wizard step “${step.title}” references unknown field “${field}”.`);
        }
        const overlap = owned.find((candidate) =>
          candidate === field ||
          candidate.startsWith(`${field}.`) ||
          field.startsWith(`${candidate}.`)
        );
        if (overlap) {
          throw new Error(
            `Wizard fields “${overlap}” and “${field}” overlap. Each field can belong to only one step.`,
          );
        }
        owned.push(field);
      }
    }
    return new Set(owned);
  }, [model.fieldMap, steps]);
  useEffect(() => {
    if (errorPaths.length === 0) return;
    const newlyRevealed = steps.flatMap((step, index) =>
      step.when &&
        !step.when(values) &&
        errorPaths.some((errorPath) => stepOwnsError(step, errorPath))
        ? [runtimeStepKey(step, index)]
        : []
    );
    if (newlyRevealed.length === 0) return;
    setRevealedConditionalSteps((current) => {
      if (newlyRevealed.every((key) => current.has(key))) return current;
      return new Set([...current, ...newlyRevealed]);
    });
  }, [errorPaths, steps, values]);
  const resolvedSteps = useMemo(() => {
    const visible: ResolvedWizardStep[] = steps
      .map((step, index) => ({
        ...step,
        runtimeKey: runtimeStepKey(step, index),
      }))
      .filter((step) =>
        !step.when ||
        step.when(values) ||
        revealedConditionalSteps.has(step.runtimeKey) ||
        errorPaths.some((errorPath) => stepOwnsError(step, errorPath))
      )
      .map((step) => ({
        ...step,
        activeFields: activeFieldsForStep(
          step,
          model.root,
          compositionOwner,
          values,
        ),
      }));
    const remaining = includeRemaining
      ? collectRemaining(model.root, assigned)
      : [];
    if (remaining.length === 0) return visible;
    const remainingStep: ResolvedWizardStep = {
      activeFields: remaining,
      body: <RuntimeFields names={remaining} />,
      fields: remaining,
      opaqueFields: [],
      runtimeKey: "internal:remaining",
      title: remainingTitle,
    };
    return [...visible, remainingStep];
  }, [
    assigned,
    errorPaths,
    includeRemaining,
    model.root,
    compositionOwner,
    revealedConditionalSteps,
    remainingTitle,
    steps,
    values,
  ]);
  const [activeKey, setActiveKey] = useState<string | undefined>(undefined);
  const lastIndex = useRef(0);
  const advancing = useRef(false);
  const routedError = useRef<string | undefined>(undefined);
  const focusedError = useRef<string | undefined>(undefined);
  const foundIndex = resolvedSteps.findIndex((step) => step.runtimeKey === activeKey);
  const safeIndex = foundIndex >= 0
    ? foundIndex
    : Math.min(lastIndex.current, Math.max(0, resolvedSteps.length - 1));
  const activeStep = resolvedSteps[safeIndex];

  useEffect(() => {
    lastIndex.current = safeIndex;
    if (activeStep && activeKey !== activeStep.runtimeKey) {
      setActiveKey(activeStep.runtimeKey);
    }
  }, [activeKey, activeStep, safeIndex]);

  useEffect(() => {
    let focusFrame: number | undefined;
    let routed = false;
    for (const errorPath of Object.keys(errors)) {
      const owner = resolvedSteps.find((step) => stepOwnsError(step, errorPath));
      if (!owner) continue;
      const signature = `${owner.runtimeKey}:${errorPath}:${errors[errorPath]?.join("|")}`;
      if (
        routedError.current === signature &&
        focusedError.current === signature
      ) return;
      const firstRoute = routedError.current !== signature;
      routedError.current = signature;
      routed = true;
      if (firstRoute) setActiveKey(owner.runtimeKey);
      const focusPath = focusableErrorPath(
        model,
        errorPath,
        values,
        disabled,
      );
      if (focusPath) {
        focusFrame = requestAnimationFrame(() => {
          methods.setFocus(focusPath);
          focusedError.current = signature;
        });
      } else {
        focusedError.current = signature;
      }
      break;
    }
    if (!routed) {
      routedError.current = undefined;
      focusedError.current = undefined;
    }
    return () => {
      if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
    };
  }, [disabled, errors, methods, model, resolvedSteps, values]);

  useEffect(() => {
    let focusFrame: number | undefined;
    const unregister = registerErrorFocus((errorPath) => {
      const owner = resolvedSteps.find((step) =>
        stepOwnsError(step, errorPath)
      );
      if (owner) setActiveKey(owner.runtimeKey);
      const focusPath = focusableErrorPath(
        model,
        errorPath,
        values,
        disabled,
      );
      if (focusPath) {
        focusFrame = requestAnimationFrame(() => methods.setFocus(focusPath));
      }
    });
    return () => {
      unregister();
      if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
    };
  }, [disabled, methods, model, registerErrorFocus, resolvedSteps, values]);

  if (!activeStep) {
    const Unsupported = adapter.slots.Unsupported;
    return <Unsupported field={model.root} reason="A wizard needs at least one visible step." />;
  }

  const Button = adapter.slots.Button;
  const Wizard = adapter.slots.Wizard;
  const last = safeIndex === resolvedSteps.length - 1;
  const pending = methods.formState.isSubmitting || methods.formState.isValidating;
  const previous = (): void => {
    const target = resolvedSteps[Math.max(0, safeIndex - 1)];
    if (target) setActiveKey(target.runtimeKey);
  };
  const next = async (): Promise<void> => {
    if (advancing.current) return;
    advancing.current = true;
    try {
      const valid = activeStep.activeFields.length === 0 ||
        await methods.trigger(activeStep.activeFields, { shouldFocus: true });
      const target = resolvedSteps[Math.min(resolvedSteps.length - 1, safeIndex + 1)];
      if (valid && target) setActiveKey(target.runtimeKey);
    } finally {
      advancing.current = false;
    }
  };

  return (
    <Wizard
      currentStep={safeIndex + 1}
      description={activeStep.description}
      navigation={
        <>
          <Button
            disabled={safeIndex === 0 || disabled || pending}
            intent="previous"
            onClick={previous}
            type="button"
          >
            {activeStep.previousLabel ?? previousLabel}
          </Button>
          {last ? (
            <RuntimeSubmit />
          ) : (
            <Button
              disabled={disabled || pending}
              intent="next"
              onClick={() => void next()}
              pending={methods.formState.isValidating}
              type="button"
            >
              {activeStep.nextLabel ?? nextLabel}
            </Button>
          )}
        </>
      }
      title={activeStep.title}
      totalSteps={resolvedSteps.length}
      steps={resolvedSteps.map((step, index) => ({
        completed: index < safeIndex,
        current: index === safeIndex,
        ...(step.description ? { description: step.description } : {}),
        id: step.runtimeKey,
        title: step.title,
      }))}
    >
      {resolvedSteps.map((step, index) => (
        <div
          aria-hidden={index === safeIndex ? undefined : true}
          hidden={index !== safeIndex}
          key={step.runtimeKey}
        >
          {step.body}
        </div>
      ))}
    </Wizard>
  );
}
