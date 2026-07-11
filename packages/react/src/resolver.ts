import type {
  FieldError,
  FieldErrors,
  Resolver,
  ResolverResult,
} from "react-hook-form";

import {
  pathToConfigPath,
  resolveFieldState,
  validatePresentationRules,
  type FormModel,
  type FormNode,
  type FormSchema,
  type InferOutput,
  type StandardIssue,
} from "@formadapter/core";
import type { StandardSchemaV1 } from "@standard-schema/spec";

type RuntimeValues = Record<string, unknown>;
type ValidationScope = readonly string[] | undefined;

interface AsyncValidation {
  readonly controller: AbortController;
  readonly promise: Promise<readonly string[]>;
}

interface ResolverInvocation<Output> {
  readonly controller: AbortController;
  readonly scope: ValidationScope;
  promise?: Promise<ResolverResult<RuntimeValues, Output>>;
  supersededBy?: ResolverInvocation<Output>;
}

export type StandardResolver<TSchema extends FormSchema> = Resolver<
  RuntimeValues,
  unknown,
  InferOutput<TSchema>
> & {
  /** Aborts every in-flight field validation owned by this resolver. */
  readonly dispose: () => void;
};

const ABORTED = Symbol("aborted");
const ROOT_ERROR = Symbol("formadapter root error");
const SELF_ERROR = Symbol("formadapter aggregate error");

function fieldErrorMessage(value: unknown): string | undefined {
  return typeof value === "object" && value !== null &&
      Object.prototype.hasOwnProperty.call(value, "message") &&
      typeof (value as Readonly<Record<string, unknown>>).message === "string"
    ? (value as Readonly<Record<string, string>>).message
    : undefined;
}

/** Returns an aggregate node's own error without consuming child errors. */
export function ownHookFormErrorMessage(error: unknown): string | undefined {
  const direct = fieldErrorMessage(error);
  if (direct !== undefined) return direct;
  if (
    typeof error !== "object" ||
    error === null ||
    !Object.prototype.hasOwnProperty.call(error, SELF_ERROR)
  ) return undefined;
  return fieldErrorMessage(
    (error as Readonly<Record<PropertyKey, unknown>>)[SELF_ERROR],
  );
}

function issuePath(
  issue: StandardSchemaV1.Issue,
): readonly (string | number)[] {
  return (issue.path ?? []).flatMap((segment) => {
    const key =
      typeof segment === "object" && segment !== null && "key" in segment
        ? segment.key
        : segment;

    if (typeof key === "number" || typeof key === "string") return [key];
    return [String(key)];
  });
}

function defineOwn(
  target: Record<PropertyKey, unknown>,
  key: PropertyKey,
  value: unknown,
): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

function appendFieldError(
  target: Record<PropertyKey, unknown>,
  key: PropertyKey,
  message: string,
): void {
  if (!Object.prototype.hasOwnProperty.call(target, key)) {
    defineOwn(
      target,
      key,
      { message, type: "schema" } satisfies FieldError,
    );
    return;
  }

  const existing = target[key];
  if (typeof existing !== "object" || existing === null) return;
  const fieldError = existing as Record<string, unknown>;
  if (fieldError.message === message) return;
  const existingTypes = Object.prototype.hasOwnProperty.call(
      fieldError,
      "types",
    ) &&
      typeof fieldError.types === "object" &&
      fieldError.types !== null
    ? fieldError.types as Record<string, unknown>
    : undefined;
  const types = existingTypes ?? {};
  if (!existingTypes) defineOwn(fieldError, "types", types);
  let duplicateIndex = Object.keys(types).length + 1;
  let duplicateKey = `schema.${duplicateIndex}`;
  while (Object.prototype.hasOwnProperty.call(types, duplicateKey)) {
    duplicateIndex += 1;
    duplicateKey = `schema.${duplicateIndex}`;
  }
  defineOwn(types, duplicateKey, message);
}

function assignError(
  errors: Record<PropertyKey, unknown>,
  path: readonly (string | symbol)[],
  message: string,
  aggregate: boolean,
): void {
  let cursor = errors;
  for (const [index, segment] of path.entries()) {
    const key = segment;
    const last = index === path.length - 1;
    if (last) {
      if (!aggregate) {
        appendFieldError(cursor, key, message);
        return;
      }
      const existing = Object.prototype.hasOwnProperty.call(cursor, key)
        ? cursor[key]
        : undefined;
      const container = typeof existing === "object" && existing !== null
        ? existing as Record<PropertyKey, unknown>
        : {};
      if (container !== existing) defineOwn(cursor, key, container);
      appendFieldError(container, SELF_ERROR, message);
      return;
    }

    const existing = Object.prototype.hasOwnProperty.call(cursor, key)
      ? cursor[key]
      : undefined;
    if (typeof existing === "object" && existing !== null) {
      cursor = existing as Record<PropertyKey, unknown>;
    } else {
      const next: Record<PropertyKey, unknown> = {};
      defineOwn(cursor, key, next);
      cursor = next;
    }
  }
}

export function issuesToHookFormErrors(
  issues: readonly StandardSchemaV1.Issue[],
): FieldErrors<RuntimeValues> {
  const errors: Record<PropertyKey, unknown> = {};
  const normalized = issues.map((issue) => ({
    issue,
    path: issuePath(issue).map(String),
  })).map((entry) => ({
    ...entry,
    path: entry.path.length === 0 ? [ROOT_ERROR] : entry.path,
  }));
  for (const [index, { issue, path }] of normalized.entries()) {
    const aggregate = normalized.some((candidate, candidateIndex) =>
      candidateIndex !== index &&
      candidate.path.length > path.length &&
      path.every((segment, segmentIndex) =>
        candidate.path[segmentIndex] === segment
      )
    );
    assignError(errors, path, issue.message, aggregate);
  }
  return errors as FieldErrors<RuntimeValues>;
}

export function createStandardResolver<TSchema extends FormSchema>(
  schema: TSchema,
  prepare: (values: RuntimeValues) => unknown = (values) => values,
  model?: FormModel<unknown, string>,
): StandardResolver<TSchema> {
  type Output = InferOutput<TSchema>;
  type Result = ResolverResult<RuntimeValues, Output>;

  const validations = new Map<string, AsyncValidation>();
  const activeInvocations = new Set<ResolverInvocation<Output>>();
  let latestVisibleAsyncNames = new Set<string>();

  const overlaps = (left: string, right: string): boolean =>
    left === right || left.startsWith(`${right}.`) || right.startsWith(`${left}.`);

  const scopesOverlap = (
    left: ValidationScope,
    right: ValidationScope,
  ): boolean => {
    if (!left || !right) return true;
    return left.some((leftName) =>
      right.some((rightName) => overlaps(leftName, rightName))
    );
  };

  const mergeScopes = (
    left: ValidationScope,
    right: ValidationScope,
  ): ValidationScope => {
    if (!left || !right) return undefined;
    return [...new Set([...left, ...right])];
  };

  const isInScope = (name: string, scope: ValidationScope): boolean =>
    !scope || scope.some((candidate) => overlaps(candidate, name));

  const cancelValidations = (scope: ValidationScope): void => {
    for (const [name, validation] of validations) {
      if (!isInScope(name, scope)) continue;
      validation.controller.abort();
      validations.delete(name);
    }
  };

  const valueAt = (value: unknown, path: readonly (number | string)[]): unknown =>
    path.reduce<unknown>((current, segment) => {
      if (typeof current !== "object" || current === null) return undefined;
      const key = String(segment);
      return Object.prototype.hasOwnProperty.call(current, key)
        ? (current as Readonly<Record<string, unknown>>)[key]
        : undefined;
    }, value);

  const collectAsyncFields = (
    node: FormNode<string, unknown>,
    value: unknown,
    path: readonly (number | string)[],
    rootValues: RuntimeValues,
    inheritedHidden: boolean,
    target: Array<{
      readonly node: FormNode<string, unknown>;
      readonly path: readonly (number | string)[];
      readonly value: unknown;
    }>,
  ): void => {
    const hidden = inheritedHidden || resolveFieldState(
      node.config.hidden,
      rootValues,
      false,
    );
    if (hidden) return;

    if (node.config.asyncValidate) target.push({ node, path, value });
    if (node.kind === "object") {
      for (const child of node.children) {
        collectAsyncFields(
          child,
          valueAt(value, [child.key]),
          [...path, child.key],
          rootValues,
          hidden,
          target,
        );
      }
    } else if (node.kind === "array" && Array.isArray(value)) {
      for (const [index, item] of value.entries()) {
        collectAsyncFields(
          node.item,
          item,
          [...path, index],
          rootValues,
          hidden,
          target,
        );
      }
    }
  };

  const wait = (milliseconds: number, signal: AbortSignal): Promise<void> =>
    new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      const onAbort = (): void => {
        clearTimeout(timeout);
        signal.removeEventListener("abort", onAbort);
        reject(signal.reason);
      };
      const timeout = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, milliseconds);
      signal.addEventListener("abort", onAbort, { once: true });
    });

  const raceWithAbort = async <Value>(
    promise: Promise<Value>,
    signal: AbortSignal,
  ): Promise<Value | typeof ABORTED> => {
    if (signal.aborted) return ABORTED;
    let onAbort: (() => void) | undefined;
    const aborted = new Promise<typeof ABORTED>((resolve) => {
      onAbort = () => resolve(ABORTED);
      signal.addEventListener("abort", onAbort, { once: true });
    });
    try {
      return await Promise.race([promise, aborted]);
    } finally {
      if (onAbort) signal.removeEventListener("abort", onAbort);
    }
  };

  const runAsync = (
    field: {
      readonly node: FormNode<string, unknown>;
      readonly path: readonly (number | string)[];
      readonly value: unknown;
    },
    values: RuntimeValues,
  ): Promise<readonly string[]> => {
    const name = field.path.map(String).join(".");
    const controller = new AbortController();
    const promise = (async (): Promise<readonly string[]> => {
      try {
        await wait(field.node.config.asyncValidationDebounceMs, controller.signal);
        const result = await raceWithAbort(
          Promise.resolve().then(() => field.node.config.asyncValidate?.(
            field.value,
            values,
            { signal: controller.signal },
          )),
          controller.signal,
        );
        if (result === ABORTED) return [];
        if (typeof result === "string") return [result];
        return result ?? [];
      } catch (error) {
        if (controller.signal.aborted) return [];
        return [error instanceof Error ? error.message : "Validation failed"];
      }
    })();
    const validation = { controller, promise } satisfies AsyncValidation;
    validations.set(name, validation);
    return promise.finally(() => {
      if (validations.get(name) === validation) validations.delete(name);
    });
  };

  const resolveInvocation = async (
    values: RuntimeValues,
    scope: ValidationScope,
    signal: AbortSignal,
  ): Promise<Result> => {
    const result = await schema["~standard"].validate(prepare(values));
    const issues: StandardIssue[] = [
      ...(result.issues ?? []),
      ...(model ? validatePresentationRules(model, values) : []),
    ];
    if (result.issues !== undefined && result.issues.length === 0) {
      issues.push({ message: "Schema validation failed" });
    }

    if (model && !signal.aborted) {
      const fields: Array<{
        readonly node: FormNode<string, unknown>;
        readonly path: readonly (number | string)[];
        readonly value: unknown;
      }> = [];
      collectAsyncFields(model.root, values, [], values, false, fields);
      const schemaErrorNames = new Set(
        issues.map((issue) => issuePath(issue).map(String).join(".")),
      );
      const hasRootError = schemaErrorNames.has("");
      const relevant = fields.filter((field) => {
        const name = field.path.map(String).join(".");
        const configured = pathToConfigPath(field.path);
        return (
          field.node.path === configured &&
          isInScope(name, scope) &&
          latestVisibleAsyncNames.has(name) &&
          !hasRootError &&
          ![...schemaErrorNames].some((error) => error && overlaps(error, name))
        );
      });
      const results = await Promise.all(
        relevant.map(async (field) => ({
          field,
          messages: await runAsync(field, values),
        })),
      );
      for (const { field, messages } of results) {
        for (const message of messages) {
          if (message) issues.push({ message, path: field.path });
        }
      }
    }

    if (issues.length > 0) {
      return {
        errors: issuesToHookFormErrors(issues),
        values: {},
      };
    }

    if (result.issues) return { errors: {}, values: {} };

    return {
      errors: {},
      values: result.value,
    };
  };

  const resolver: Resolver<RuntimeValues, unknown, Output> = (
    values,
    _context,
    options,
  ) => {
    if (model) {
      const visibleFields: Array<{
        readonly node: FormNode<string, unknown>;
        readonly path: readonly (number | string)[];
        readonly value: unknown;
      }> = [];
      collectAsyncFields(
        model.root,
        values,
        [],
        values,
        false,
        visibleFields,
      );
      latestVisibleAsyncNames = new Set(
        visibleFields.map((field) => field.path.map(String).join(".")),
      );
      for (const [name, validation] of validations) {
        if (latestVisibleAsyncNames.has(name)) continue;
        validation.controller.abort();
        validations.delete(name);
      }
    }

    const requestedNames = options.names?.map(String);
    let scope: ValidationScope = requestedNames && requestedNames.length > 0
      ? requestedNames
      : undefined;
    const superseded = new Set<ResolverInvocation<Output>>();
    let foundOverlap = true;
    while (foundOverlap) {
      foundOverlap = false;
      for (const active of activeInvocations) {
        if (active.supersededBy || superseded.has(active)) continue;
        if (!scopesOverlap(scope, active.scope)) continue;
        superseded.add(active);
        scope = mergeScopes(scope, active.scope);
        foundOverlap = true;
      }
    }

    const invocation: ResolverInvocation<Output> = {
      controller: new AbortController(),
      scope,
    };
    for (const active of superseded) {
      active.supersededBy = invocation;
      active.controller.abort();
    }
    activeInvocations.add(invocation);
    cancelValidations(scope);

    const promise = resolveInvocation(
      values,
      scope,
      invocation.controller.signal,
    ).then(async (result) => {
      const successor = invocation.supersededBy;
      return successor?.promise ? successor.promise : result;
    });
    invocation.promise = promise;
    return promise.finally(() => activeInvocations.delete(invocation));
  };

  const dispose = (): void => {
    cancelValidations(undefined);
    for (const invocation of activeInvocations) {
      invocation.controller.abort();
    }
  };

  return Object.assign(resolver, { dispose });
}

export interface HookFormErrorItem {
  readonly message: string;
  readonly path?: string | undefined;
}

export function hookFormErrorItems(
  errors: FieldErrors<RuntimeValues>,
): readonly HookFormErrorItem[] {
  const items: HookFormErrorItem[] = [];
  const visited = new WeakSet<object>();

  const visit = (value: unknown, path: string): void => {
    if (typeof value !== "object" || value === null) return;
    if (visited.has(value)) return;
    visited.add(value);
    const error = value as Readonly<Record<PropertyKey, unknown>>;

    if (
      Object.prototype.hasOwnProperty.call(error, "message") &&
      typeof error.message === "string"
    ) {
      const itemPath = path || undefined;
      const messages = [
        error.message,
        ...(
          Object.prototype.hasOwnProperty.call(error, "types") &&
            typeof error.types === "object" &&
            error.types !== null
            ? Object.values(error.types).filter(
                (message): message is string =>
                  typeof message === "string" && message !== error.message,
              )
            : []
        ),
      ];
      for (const message of messages) {
        items.push({
          message,
          ...(itemPath === undefined ? {} : { path: itemPath }),
        });
      }
    } else if (
      Object.prototype.hasOwnProperty.call(error, "type") &&
      typeof error.type === "string"
    ) {
      return;
    }

    if (path === "" && Object.prototype.hasOwnProperty.call(error, ROOT_ERROR)) {
      visit(error[ROOT_ERROR], "");
    }
    if (Object.prototype.hasOwnProperty.call(error, SELF_ERROR)) {
      visit(error[SELF_ERROR], path);
    }

    for (const [key, child] of Object.entries(value)) {
      if (
        typeof error.message === "string" &&
        (key === "message" || key === "ref" || key === "type" || key === "types")
      ) {
        continue;
      }
      visit(child, path ? `${path}.${key}` : key);
    }
  };

  visit(errors, "");
  return items;
}

export function flattenHookFormErrors(
  errors: FieldErrors<RuntimeValues>,
): Readonly<Record<string, readonly string[]>> {
  const flattened: Record<string, string[]> = {};
  for (const item of hookFormErrorItems(errors)) {
    const path = item.path ?? "root";
    const existing = Object.prototype.hasOwnProperty.call(flattened, path)
      ? flattened[path] ?? []
      : [];
    Object.defineProperty(flattened, path, {
      configurable: true,
      enumerable: true,
      value: [...existing, item.message],
      writable: true,
    });
  }
  return flattened;
}
