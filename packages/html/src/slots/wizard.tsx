import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";

import type { WizardSlotProps } from "@formadapter/react";

export function Wizard({
  children,
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
      data-step-count={steps?.length}
    >
      <p aria-live="polite">Step {currentStep} of {totalSteps}</p>
      <h2 id={headingId} ref={heading} tabIndex={-1}>{title}</h2>
      {description ? <p>{description}</p> : null}
      <progress
        aria-label={`Step ${currentStep} of ${totalSteps}`}
        max={totalSteps}
        value={currentStep}
      />
      {steps && steps.length > 0 ? (
        <ol aria-label="Form steps">
          {steps.map((step) => (
            <li
              aria-current={step.current ? "step" : undefined}
              data-completed={step.completed || undefined}
              key={step.id}
            >
              {step.title}
            </li>
          ))}
        </ol>
      ) : null}
      <div>{children}</div>
      <nav aria-label="Wizard navigation">{navigation}</nav>
    </section>
  );
}
