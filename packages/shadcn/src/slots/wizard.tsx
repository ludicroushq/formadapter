import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";

import type { WizardSlotProps } from "@formadapter/react";

import { cn } from "../cn";
import { CheckIcon } from "../icons";

export function Wizard({
  children,
  className,
  currentStep,
  description,
  navigation,
  steps,
  title,
  totalSteps,
  ...props
}: WizardSlotProps): ReactNode {
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement | null>(null);
  const previousStep = useRef(currentStep);

  useEffect(() => {
    if (previousStep.current !== currentStep) heading.current?.focus();
    previousStep.current = currentStep;
  }, [currentStep]);

  return (
    <section
      {...props}
      aria-labelledby={props["aria-labelledby"] ?? headingId}
      className={cn("grid gap-6", className)}
      data-step-count={steps?.length}
      data-slot="wizard"
    >
      {steps && steps.length > 0 ? (
        <ol
          aria-label="Form steps"
          className="flex flex-wrap gap-3"
          data-slot="wizard-steps"
        >
          {steps.map((step, index) => (
            <li
              aria-current={step.current ? "step" : undefined}
              className={cn(
                "flex min-w-32 flex-1 items-center gap-2 text-sm",
                step.current || step.completed
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
              data-completed={step.completed || undefined}
              key={step.id}
            >
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-medium",
                  step.current || step.completed
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background",
                )}
              >
                {step.completed ? (
                  <>
                    <CheckIcon />
                    <span className="sr-only">Completed</span>
                  </>
                ) : index + 1}
              </span>
              <span className="truncate">{step.title}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <div>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          Step {currentStep} of {totalSteps}
        </p>
        <h2
          className="text-xl font-semibold tracking-tight"
          id={headingId}
          ref={heading}
          tabIndex={-1}
        >
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <progress
        aria-label={`Step ${currentStep} of ${totalSteps}`}
        className="h-2 w-full overflow-hidden rounded-full bg-primary/20 [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-primary/20 [&::-webkit-progress-value]:bg-primary"
        max={totalSteps}
        value={currentStep}
      />
      <div className="grid gap-6">{children}</div>
      <nav
        aria-label="Wizard navigation"
        className="flex items-center justify-between gap-3"
      >
        {navigation}
      </nav>
    </section>
  );
}
