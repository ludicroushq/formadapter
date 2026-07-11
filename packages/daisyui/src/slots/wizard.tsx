import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";

import type { WizardSlotProps } from "@formadapter/react";

import { classNames } from "../class-names";
import { useDaisyUIClassNames } from "../prefix";

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
  const progressClassName = useDaisyUIClassNames("progress progress-primary");
  const mutedClassName = useDaisyUIClassNames("text-base-content/60");
  const descriptionClassName = useDaisyUIClassNames("text-base-content/70");

  useEffect(() => {
    if (previousStep.current !== currentStep) heading.current?.focus();
    previousStep.current = currentStep;
  }, [currentStep]);

  return (
    <section
      {...props}
      aria-labelledby={props["aria-labelledby"] ?? headingId}
      className={classNames("grid gap-4", className)}
      data-step-count={steps?.length}
    >
      <div>
        <p aria-live="polite" className={classNames(mutedClassName, "text-sm")}>
          Step {currentStep} of {totalSteps}
        </p>
        <h2
          className="text-xl font-semibold"
          id={headingId}
          ref={heading}
          tabIndex={-1}
        >
          {title}
        </h2>
        {description ? <p className={descriptionClassName}>{description}</p> : null}
      </div>
      <progress
        aria-label={`Step ${currentStep} of ${totalSteps}`}
        className={classNames(progressClassName, "w-full")}
        max={totalSteps}
        value={currentStep}
      />
      <div className="grid gap-4">{children}</div>
      <div className="flex items-center justify-between gap-3">{navigation}</div>
    </section>
  );
}
