import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";

import type {
  ArrayItemSlotProps,
  ArraySlotProps,
  ButtonIntent,
  ButtonSlotProps,
  ErrorSummarySlotProps,
  FieldSlotProps,
  FormAdapterSlots,
  FormMessageSlotProps,
  FormSlotProps,
  GroupSlotProps,
  UnsupportedSlotProps,
  WizardSlotProps,
} from "@formadapter/react";

import type { CommonShadcnComponents } from "./components";

function requiredLabel(label: string, required: boolean): ReactNode {
  return (
    <>
      {label}
      {required ? <span aria-hidden="true"> *</span> : null}
    </>
  );
}

function buttonVariant(
  intent: ButtonIntent,
): "default" | "destructive" | "outline" {
  if (intent === "remove") return "destructive";
  if (intent === "move-up" || intent === "move-down" || intent === "previous") {
    return "outline";
  }
  return "default";
}

export function createSlots(
  components: CommonShadcnComponents,
): FormAdapterSlots {
  const {
    Alert,
    AlertDescription,
    AlertTitle,
    Button: ShadcnButton,
    Field: ShadcnField,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSet,
    FieldTitle,
    Progress,
    Spinner,
  } = components;

  function Form({ children, ...props }: FormSlotProps): ReactNode {
    return (
      <form {...props} data-slot="form">
        {children}
      </form>
    );
  }

  function Field({
    children,
    controlId,
    descriptionId,
    error,
    errorId,
    field,
    invalid,
    required,
    validating,
    ...props
  }: FieldSlotProps): ReactNode {
    if (field.control === "hidden" || field.inputType === "hidden") {
      return children;
    }

    const checkbox = field.control === "checkbox";

    return (
      <ShadcnField
        {...props}
        data-field-path={field.path}
        data-invalid={invalid || undefined}
        data-validating={validating || undefined}
        orientation={checkbox ? "horizontal" : "vertical"}
      >
        {checkbox ? (
          <FieldLabel htmlFor={controlId}>
            {children}
            {requiredLabel(field.label, required)}
          </FieldLabel>
        ) : (
          <>
            <FieldLabel htmlFor={controlId}>
              {requiredLabel(field.label, required)}
            </FieldLabel>
            {children}
          </>
        )}
        {field.description ? (
          <FieldDescription id={descriptionId}>
            {field.description}
          </FieldDescription>
        ) : null}
        {validating ? (
          <FieldDescription>
            <output>Checking…</output>
          </FieldDescription>
        ) : null}
        {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      </ShadcnField>
    );
  }

  function Group({
    children,
    disabled,
    error,
    errorId,
    field,
    readOnly,
    required,
    ...props
  }: GroupSlotProps): ReactNode {
    const descriptionId = useId();
    const describedBy = [
      props["aria-describedby"],
      field.description ? descriptionId : undefined,
      error ? errorId : undefined,
    ].filter(Boolean).join(" ") || undefined;

    return (
      <FieldSet
        {...props}
        aria-describedby={describedBy}
        aria-disabled={disabled || undefined}
        aria-invalid={error ? true : undefined}
        data-field-path={field.path}
        data-invalid={error ? true : undefined}
        data-readonly={readOnly || undefined}
        disabled={disabled}
      >
        <FieldLegend>{requiredLabel(field.label, required)}</FieldLegend>
        {field.description ? (
          <FieldDescription id={descriptionId}>
            {field.description}
          </FieldDescription>
        ) : null}
        <FieldGroup>{children}</FieldGroup>
        {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      </FieldSet>
    );
  }

  function Array({
    actions,
    children,
    disabled,
    error,
    errorId,
    field,
    itemCount,
    readOnly,
    required,
    ...props
  }: ArraySlotProps): ReactNode {
    const descriptionId = useId();
    const describedBy = [
      props["aria-describedby"],
      field.description ? descriptionId : undefined,
      error ? errorId : undefined,
    ].filter(Boolean).join(" ") || undefined;

    return (
      <FieldSet
        {...props}
        aria-describedby={describedBy}
        aria-disabled={disabled || undefined}
        aria-invalid={error ? true : undefined}
        data-field-path={field.path}
        data-invalid={error ? true : undefined}
        data-item-count={itemCount}
        data-readonly={readOnly || undefined}
        disabled={disabled}
      >
        <FieldLegend>{requiredLabel(field.label, required)}</FieldLegend>
        {field.description ? (
          <FieldDescription id={descriptionId}>
            {field.description}
          </FieldDescription>
        ) : null}
        <FieldGroup data-slot="array-items">{children}</FieldGroup>
        <ShadcnField data-slot="array-actions" orientation="horizontal">
          {actions}
        </ShadcnField>
        {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      </FieldSet>
    );
  }

  function ArrayItem({
    actions,
    children,
    field,
    index,
    label,
    ...props
  }: ArrayItemSlotProps): ReactNode {
    const labelId = useId();

    return (
      <ShadcnField
        {...props}
        aria-labelledby={props["aria-labelledby"] ?? labelId}
        data-array-path={field.path}
        data-item-index={index}
        role={props.role ?? "group"}
      >
        <ShadcnField orientation="horizontal">
          <FieldTitle id={labelId}>{label}</FieldTitle>
          <div data-slot="array-item-actions">{actions}</div>
        </ShadcnField>
        <FieldContent>{children}</FieldContent>
      </ShadcnField>
    );
  }

  function Button({
    ariaLabel,
    children,
    disabled,
    intent,
    onClick,
    pending,
    type,
  }: ButtonSlotProps): ReactNode {
    return (
      <ShadcnButton
        aria-busy={pending || undefined}
        aria-label={ariaLabel}
        data-intent={intent}
        disabled={disabled}
        onClick={onClick}
        type={type}
        variant={buttonVariant(intent)}
      >
        {pending ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
        {children}
      </ShadcnButton>
    );
  }

  function ErrorSummary({
    errors,
    items,
    onSelect,
    title,
  }: ErrorSummarySlotProps): ReactNode {
    const resolvedItems: NonNullable<ErrorSummarySlotProps["items"]> =
      items ?? errors.map((message) => ({ message }));

    if (resolvedItems.length === 0) return null;

    return (
      <Alert role="alert" variant="destructive">
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          <ul>
            {resolvedItems.map((item, index) => {
              const focusPath = item.focusPath;
              return (
                <li key={`${item.path ?? "form"}-${item.message}-${index}`}>
                  {focusPath && onSelect ? (
                    <ShadcnButton
                      data-intent="error-link"
                      onClick={() => onSelect(focusPath)}
                      type="button"
                      variant="link"
                    >
                      {item.message}
                    </ShadcnButton>
                  ) : item.message}
                </li>
              );
            })}
          </ul>
        </AlertDescription>
      </Alert>
    );
  }

  function FormMessage({ kind, message }: FormMessageSlotProps): ReactNode {
    return (
      <Alert
        data-kind={kind}
        role={kind === "error" ? "alert" : "status"}
        variant={kind === "error" ? "destructive" : "default"}
      >
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    );
  }

  function Unsupported({ field, reason }: UnsupportedSlotProps): ReactNode {
    return (
      <Alert role="alert">
        <AlertTitle>{field.label}</AlertTitle>
        <AlertDescription>{reason}</AlertDescription>
      </Alert>
    );
  }

  function Wizard({
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
        data-slot="wizard"
      >
        {steps && steps.length > 0 ? (
          <ol aria-label="Form steps" data-slot="wizard-steps">
            {steps.map((step, index) => (
              <li
                aria-current={step.current ? "step" : undefined}
                data-completed={step.completed || undefined}
                key={step.id}
              >
                <span aria-hidden="true">{index + 1}</span>
                <span>{step.title}</span>
                {step.completed ? <span className="sr-only">Completed</span> : null}
              </li>
            ))}
          </ol>
        ) : null}
        <div>
          <p aria-live="polite">Step {currentStep} of {totalSteps}</p>
          <h2 id={headingId} ref={heading} tabIndex={-1}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        <Progress
          aria-label={`Step ${currentStep} of ${totalSteps}`}
          max={totalSteps}
          value={currentStep}
        />
        <FieldGroup>{children}</FieldGroup>
        <nav aria-label="Wizard navigation">{navigation}</nav>
      </section>
    );
  }

  return {
    Array,
    ArrayItem,
    Button,
    ErrorSummary,
    Field,
    Form,
    FormMessage,
    Group,
    Unsupported,
    Wizard,
  };
}
