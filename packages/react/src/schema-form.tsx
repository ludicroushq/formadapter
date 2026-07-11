"use client";

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  FormProvider,
  useForm,
  useWatch,
  type DefaultValues,
  type FieldErrors,
} from "react-hook-form";

import {
  compileForm,
  getDefaultValues,
  initialSubmissionState,
  pathToConfigPath,
  submissionFailure,
  submissionSuccess,
  type FormConfig,
  type FormModel,
  type FormSchema,
  type InferInput,
  type InferOutput,
  type SubmissionState,
} from "@formadapter/core";

import type { AnyFormAdapter } from "./adapter";
import { useFormAdapter } from "./adapter-context";
import { RuntimeAutoLayout } from "./bound-parts";
import {
  FormRuntimeContext,
  type RuntimeValues,
} from "./form-context";
import {
  createStandardResolver,
  flattenHookFormErrors,
  hookFormErrorItems,
} from "./resolver";
import { buildFormData } from "./form-data-fields";
import {
  mergeDefaultValues,
  firstFocusablePath,
  prepareValuesForValidation,
} from "./runtime-utils";
import type {
  BoundFormProps,
  FormSubmissionAction,
} from "./types";
import { useDraftPersistence } from "./use-draft";

export type SchemaFormProps<
  TSchema extends FormSchema,
  TAdapter extends AnyFormAdapter,
  Data = unknown,
> = BoundFormProps<TSchema, Data> & {
  readonly baseAdapter?: TAdapter | undefined;
  readonly config: FormConfig<InferInput<TSchema>, string>;
  readonly schema: TSchema;
};

async function idleAction(
  previousState: SubmissionState,
  _formData: FormData,
): Promise<SubmissionState> {
  return previousState;
}

function formDataFromSubmit(
  form: HTMLFormElement,
  nativeEvent: Event | undefined,
): FormData {
  const submitter = typeof SubmitEvent !== "undefined" &&
      nativeEvent instanceof SubmitEvent
    ? nativeEvent.submitter
    : null;
  if (!submitter) return new FormData(form);
  try {
    return new FormData(form, submitter);
  } catch {
    const fallback = new FormData(form);
    if (
      (submitter instanceof HTMLButtonElement ||
        submitter instanceof HTMLInputElement) &&
      submitter.name
    ) {
      fallback.append(submitter.name, submitter.value);
    }
    return fallback;
  }
}

function nativeEventObject(event: unknown): object | undefined {
  if (typeof event !== "object" || event === null || !("nativeEvent" in event)) {
    return undefined;
  }
  const nativeEvent = event.nativeEvent;
  return typeof nativeEvent === "object" && nativeEvent !== null
    ? nativeEvent
    : undefined;
}

export function SchemaForm<
  TSchema extends FormSchema,
  TAdapter extends AnyFormAdapter,
  Data = unknown,
>(props: SchemaFormProps<TSchema, TAdapter, Data>): ReactNode {
  const {
    action,
    adapter: localAdapter,
    baseAdapter,
    children,
    config,
    defaultValues,
    disabled = false,
    draft,
    initialSubmissionState: providedSubmissionState = initialSubmissionState,
    mode = "onSubmit",
    onInvalid,
    onResult,
    onSubmit,
    permalink,
    resetOnSuccess = false,
    schema,
    submitLabel = "Submit",
    ...formProps
  } = props;
  const providerAdapter = useFormAdapter();
  const adapter = localAdapter ?? providerAdapter ?? baseAdapter;
  if (!adapter) {
    throw new Error(
      "No form adapter is available. Wrap this form in FormAdapterProvider, pass a complete adapter to the form, or use an adapter-bound createForm export.",
    );
  }

  const model = useMemo(() => compileForm(schema, config), [config, schema]);
  const initialValues = useMemo(
    () => mergeDefaultValues(
      getDefaultValues(model) as Record<string, unknown>,
      defaultValues,
    ),
    [defaultValues, model],
  );
  const runtimeModel = model as FormModel<unknown, string>;
  const resolver = useMemo(
    () => createStandardResolver(
      schema,
      (values) => prepareValuesForValidation(runtimeModel, values),
      runtimeModel,
    ),
    [runtimeModel, schema],
  );
  useEffect(() => () => resolver.dispose(), [resolver]);
  const methods = useForm<RuntimeValues, unknown, InferOutput<TSchema>>({
    criteriaMode: "firstError",
    defaultValues: initialValues as DefaultValues<RuntimeValues>,
    mode,
    resolver,
    shouldFocusError: true,
    shouldUnregister: false,
  });
  const watchedValues = useWatch({ control: methods.control });
  const values = (watchedValues ?? initialValues) as RuntimeValues;
  const draftRuntime = useDraftPersistence<InferInput<TSchema>>({
    config: draft,
    initialValues,
    methods,
    values,
  });
  const resolvedAction = (action ?? idleAction) as FormSubmissionAction<Data>;
  const [actionState, dispatchAction, actionPending] = useActionState(
    resolvedAction,
    providedSubmissionState,
    permalink,
  );
  const [clientState, setClientState] = useState<SubmissionState<Data>>(
    providedSubmissionState,
  );
  const submission = action ? actionState : clientState;
  const processedSubmission = useRef<SubmissionState<Data> | undefined>(undefined);
  const submitController = useRef<AbortController | undefined>(undefined);
  const valueRevision = useRef(0);
  const actionDispatchPending = useRef(false);
  const actionSubmissionRevision = useRef<number | undefined>(undefined);
  const clientSubmissionRevision = useRef<{
    readonly revision: number;
    readonly submission: SubmissionState<Data>;
  } | undefined>(undefined);
  const registeredErrorFocus = useRef<((path: string) => void) | undefined>(
    undefined,
  );
  const submitGeneration = useRef(0);
  const submitGenerations = useRef(new WeakMap<object, number>());
  const submitSnapshots = useRef(new WeakMap<object, {
    readonly formData: FormData;
    readonly input: InferInput<TSchema>;
    readonly revision: number;
  }>());
  const runtimeValidators = useRef(new Map<
    symbol,
    {
      readonly path: string;
      readonly validate: (values: RuntimeValues) => string | undefined;
    }
  >());
  const pendingErrorFocus = useRef<string | undefined>(undefined);
  const submittedForm = useRef<HTMLFormElement | null>(null);
  const serverErrorPaths = useRef<readonly string[]>([]);
  const pending = methods.formState.isSubmitting || actionPending;
  const effectiveDisabled = disabled ||
    draftRuntime.status === "loading" ||
    pending;
  const focusError = useCallback((path: string): void => {
    const registered = registeredErrorFocus.current;
    if (registered) registered(path);
    else {
      methods.setFocus(path);
      requestAnimationFrame(() => {
        const form = submittedForm.current;
        if (!form) return;
        const control = Array.from(
          form.querySelectorAll<HTMLElement>("[name]"),
        ).find((element) =>
          element.getAttribute("name") === path &&
          !element.hasAttribute("disabled") &&
          !element.closest('[hidden], [inert], [aria-hidden="true"]')
        );
        if (control && document.activeElement !== control) control.focus();
      });
    }
  }, [methods]);
  const registerErrorFocus = useCallback((
    handler: (path: string) => void,
  ): (() => void) => {
    registeredErrorFocus.current = handler;
    return () => {
      if (registeredErrorFocus.current === handler) {
        registeredErrorFocus.current = undefined;
      }
    };
  }, []);
  const registerRuntimeValidator = useCallback((
    path: string,
    validate: (values: RuntimeValues) => string | undefined,
  ): (() => void) => {
    const id = Symbol(path);
    runtimeValidators.current.set(id, { path, validate });
    return () => {
      runtimeValidators.current.delete(id);
    };
  }, []);

  useEffect(() => () => {
    submitGeneration.current += 1;
    submitController.current?.abort();
    submitController.current = undefined;
  }, []);

  useEffect(() => methods.subscribe({
    callback: () => {
      valueRevision.current += 1;
    },
    formState: { values: true },
  }), [methods]);

  useEffect(() => {
    if (!actionPending) actionDispatchPending.current = false;
  }, [actionPending, submission]);

  useEffect(() => {
    if (processedSubmission.current === submission) return;
    processedSubmission.current = submission;
    const submittedRevision = action
      ? actionSubmissionRevision.current
      : clientSubmissionRevision.current?.submission === submission
        ? clientSubmissionRevision.current.revision
        : undefined;
    const valuesAreCurrent = submittedRevision === undefined ||
      submittedRevision === valueRevision.current;
    if (submission.status !== "idle" && serverErrorPaths.current.length > 0) {
      methods.clearErrors([...serverErrorPaths.current]);
      serverErrorPaths.current = [];
    }
    if (submission.status === "error") {
      serverErrorPaths.current = valuesAreCurrent
        ? Object.keys(submission.fieldErrors)
        : [];
      if (submittedRevision !== undefined && valuesAreCurrent) {
        pendingErrorFocus.current = serverErrorPaths.current[0];
      }
      for (const [path, messages] of Object.entries(
        valuesAreCurrent ? submission.fieldErrors : {},
      )) {
        const message = messages[0];
        if (message) {
          const additional = Object.fromEntries(
            messages.slice(1).map((additionalMessage, index) => [
              `server.${index + 1}`,
              additionalMessage,
            ]),
          );
          methods.setError(path, {
            message,
            type: "server",
            ...(messages.length > 1 ? { types: additional } : {}),
          });
        }
      }
    } else if (submission.status === "success") {
      if (valuesAreCurrent) {
        if (resetOnSuccess) methods.reset(initialValues);
        if (draft?.clearOnSuccess ?? true) void draftRuntime.clear();
      }
    }
    if (submission.status !== "idle") onResult?.(submission);
  }, [action, draft?.clearOnSuccess, draftRuntime, initialValues, methods, onResult, resetOnSuccess, submission]);

  const Form = adapter.slots.Form;
  const ErrorSummary = adapter.slots.ErrorSummary;
  const FormMessage = adapter.slots.FormMessage;
  const hookFormErrors = methods.formState.errors as FieldErrors<RuntimeValues>;
  const fieldErrorItems = hookFormErrorItems(hookFormErrors);
  const focusPathForError = useCallback((path: string): string | undefined => {
    const concretePath = path.split(".").map((segment) =>
      /^(?:0|[1-9]\d*)$/.test(segment) ? Number(segment) : segment
    );
    const configPath = pathToConfigPath(concretePath);
    const node = Object.prototype.hasOwnProperty.call(
        runtimeModel.fieldMap,
        configPath,
      )
      ? runtimeModel.fieldMap[configPath]
      : undefined;
    return node
      ? firstFocusablePath(node, path, values, effectiveDisabled)
      : undefined;
  }, [effectiveDisabled, runtimeModel.fieldMap, values]);
  const errorItems = [
    ...fieldErrorItems.map((item) => ({
      ...item,
      ...(item.path
        ? { focusPath: focusPathForError(item.path) }
        : {}),
    })),
    ...(submission.status === "error"
      ? submission.formErrors.map((message) => ({ message }))
      : []),
  ];
  const errorMessages = errorItems.map((item) => item.message);

  useEffect(() => {
    const errorPath = pendingErrorFocus.current;
    if (pending || !errorPath) return;
    pendingErrorFocus.current = undefined;
    const focusPath = focusPathForError(errorPath);
    if (!focusPath) return;
    const frame = requestAnimationFrame(() => focusError(focusPath));
    return () => cancelAnimationFrame(frame);
  }, [focusError, focusPathForError, pending]);

  const handleValidatedSubmit = methods.handleSubmit(
    async (output, event) => {
      const eventGeneration = event
        ? submitGenerations.current.get(event) ??
          submitGenerations.current.get(nativeEventObject(event) ?? event)
        : undefined;
      if (
        !event ||
        eventGeneration !== submitGeneration.current
      ) {
        return;
      }
      const snapshot = submitSnapshots.current.get(event) ??
        submitSnapshots.current.get(nativeEventObject(event) ?? event);
      if (!snapshot || snapshot.revision !== valueRevision.current) return;
      const runtimeErrors: Record<string, readonly string[]> = Object.create(null);
      const currentValues = snapshot.input as RuntimeValues;
      for (const { path, validate } of runtimeValidators.current.values()) {
        const message = validate(currentValues);
        if (!message) continue;
        Object.defineProperty(runtimeErrors, path, {
          configurable: true,
          enumerable: true,
          value: [message],
          writable: true,
        });
        methods.setError(path, { message, type: "runtime" });
      }
      if (Object.keys(runtimeErrors).length > 0) {
        pendingErrorFocus.current = Object.keys(runtimeErrors)[0];
        await onInvalid?.(runtimeErrors);
        return;
      }
      const { formData, input } = snapshot;

      if (action) {
        actionDispatchPending.current = true;
        actionSubmissionRevision.current = snapshot.revision;
        startTransition(() => dispatchAction(formData));
        return;
      }

      submitController.current?.abort();
      const controller = new AbortController();
      submitController.current = controller;
      try {
        const result = await onSubmit?.(output, {
          formData,
          input,
          signal: controller.signal,
        });
        if (
          controller.signal.aborted ||
          submitController.current !== controller
        ) return;
        const nextSubmission = result ?? submissionSuccess<Data>();
        clientSubmissionRevision.current = {
          revision: snapshot.revision,
          submission: nextSubmission,
        };
        setClientState(nextSubmission);
      } catch (error) {
        if (
          controller.signal.aborted ||
          submitController.current !== controller
        ) return;
        const nextSubmission = submissionFailure({
          errorKind: "transport",
          formErrors: [error instanceof Error ? error.message : "Unable to submit the form"],
        });
        clientSubmissionRevision.current = {
          revision: snapshot.revision,
          submission: nextSubmission,
        };
        setClientState(nextSubmission);
      } finally {
        if (submitController.current === controller) {
          submitController.current = undefined;
        }
      }
    },
    async (errors, event) => {
      const eventGeneration = event
        ? submitGenerations.current.get(event) ??
          submitGenerations.current.get(nativeEventObject(event) ?? event)
        : undefined;
      if (
        !event ||
        eventGeneration !== submitGeneration.current
      ) {
        return;
      }
      submitController.current?.abort();
      submitController.current = undefined;
      const typedErrors = errors as FieldErrors<RuntimeValues>;
      const firstErrorPath = hookFormErrorItems(typedErrors)
        .find((item) => item.path !== undefined)?.path;
      pendingErrorFocus.current = firstErrorPath;
      await onInvalid?.(
        flattenHookFormErrors(typedErrors),
      );
    },
  );
  const submit = (event: FormEvent<HTMLFormElement>): Promise<void> => {
    submittedForm.current = event.currentTarget;
    if (action && (actionDispatchPending.current || actionPending)) {
      event.preventDefault();
      return Promise.resolve();
    }
    const generation = submitGeneration.current + 1;
    submitGeneration.current = generation;
    submitGenerations.current.set(event, generation);
    const nativeEvent = nativeEventObject(event);
    if (nativeEvent) submitGenerations.current.set(nativeEvent, generation);
    const input = prepareValuesForValidation(
      runtimeModel,
      methods.getValues(),
    ) as InferInput<TSchema>;
    const browserFormData = formDataFromSubmit(
      event.currentTarget,
      event.nativeEvent,
    );
    const snapshot = {
      formData: buildFormData(runtimeModel, input, browserFormData),
      input,
      revision: valueRevision.current,
    };
    submitSnapshots.current.set(event, snapshot);
    if (nativeEvent) submitSnapshots.current.set(nativeEvent, snapshot);
    if (!action) {
      submitController.current?.abort();
      submitController.current = undefined;
    }
    return handleValidatedSubmit(event);
  };

  return (
    <FormProvider {...methods}>
      <FormRuntimeContext.Provider
        value={{
          adapter,
          clearDraft: draftRuntime.clear,
          disabled: effectiveDisabled,
          draftStatus: draftRuntime.status,
          focusError,
          model: runtimeModel,
          pending,
          registerErrorFocus,
          registerRuntimeValidator,
          submission,
          submitLabel,
          values,
        }}
      >
        <Form
          {...formProps}
          action={action ? dispatchAction : undefined}
          aria-busy={pending || draftRuntime.status === "loading" || undefined}
          noValidate
          onSubmit={submit}
        >
          {draftRuntime.status === "loading" ? (
            <FormMessage kind="info" message="Loading saved progress…" />
          ) : null}
          {(methods.formState.submitCount > 0 || submission.status === "error") && errorMessages.length > 0 ? (
            <ErrorSummary
              errors={errorMessages}
              items={errorItems}
              onSelect={focusError}
              title="Please fix the highlighted fields"
            />
          ) : null}
          {submission.status === "success" && submission.message ? (
            <FormMessage kind="success" message={submission.message} />
          ) : null}
          {children === undefined ? <RuntimeAutoLayout /> : children}
        </Form>
      </FormRuntimeContext.Provider>
    </FormProvider>
  );
}
