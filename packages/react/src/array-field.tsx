"use client";

import {
  useId,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  useController,
  useFormContext,
  useFormState,
  useWatch,
} from "react-hook-form";

import type { ArrayField } from "@formadapter/core";

import { ARRAY_MARKER } from "./form-data-fields";
import { useFormRuntime, type RuntimeValues } from "./form-context";
import { NodeRenderer } from "./node-renderer";
import { ownHookFormErrorMessage } from "./resolver";
import {
  defaultValueForNode,
  firstFocusablePath,
  resolvePresentation,
  resolveRequired,
  valueAtPath,
} from "./runtime-utils";

export interface ArrayFieldRendererProps {
  readonly field: ArrayField<string, unknown>;
  readonly path: string;
  readonly className?: string | undefined;
  readonly inheritedDisabled?: boolean | undefined;
  readonly inheritedReadOnly?: boolean | undefined;
  readonly unregisterOnUnmount?: boolean | undefined;
}

function moveItem(values: readonly unknown[], from: number, to: number): unknown[] {
  const next = [...values];
  const removed = next.splice(from, 1);
  if (removed.length > 0) next.splice(to, 0, removed[0]);
  return next;
}

interface ArrayKeyState {
  readonly itemKeys: readonly string[];
  readonly nextKey: number;
}

function reconcileItemKeys(
  previousValues: readonly unknown[],
  nextValues: readonly unknown[],
  current: ArrayKeyState,
  generatedId: string,
): ArrayKeyState {
  const nextKeys: Array<string | undefined> = Array.from({
    length: nextValues.length,
  });
  const usedPrevious = new Set<number>();
  const assign = (nextIndex: number, previousIndex: number): boolean => {
    const key = current.itemKeys[previousIndex];
    if (key === undefined || usedPrevious.has(previousIndex)) return false;
    nextKeys[nextIndex] = key;
    usedPrevious.add(previousIndex);
    return true;
  };

  // Stable positions win for duplicate values and ordinary field edits.
  for (const [index, value] of nextValues.entries()) {
    if (Object.is(value, previousValues[index])) assign(index, index);
  }

  // Preserve identity when an external reset or setValue reorders items.
  for (const [nextIndex, value] of nextValues.entries()) {
    if (nextKeys[nextIndex] !== undefined) continue;
    const previousIndex = previousValues.findIndex((candidate, index) =>
      !usedPrevious.has(index) && Object.is(candidate, value)
    );
    if (previousIndex >= 0) assign(nextIndex, previousIndex);
  }

  // Replacements at the same position keep their component identity.
  for (const index of nextValues.keys()) {
    if (nextKeys[index] === undefined) assign(index, index);
  }

  let nextKey = current.nextKey;
  const itemKeys = nextKeys.map((key) => {
    if (key !== undefined) return key;
    const created = `${generatedId}-external-${nextKey}`;
    nextKey += 1;
    return created;
  });
  const unchanged = nextKey === current.nextKey &&
    itemKeys.length === current.itemKeys.length &&
    itemKeys.every((key, index) => key === current.itemKeys[index]);
  return unchanged ? current : { itemKeys, nextKey };
}

export function ArrayFieldRenderer({
  field,
  path,
  className,
  inheritedDisabled = false,
  inheritedReadOnly = false,
  unregisterOnUnmount = false,
}: ArrayFieldRendererProps): ReactNode {
  const generatedId = useId();
  const { adapter, disabled: formDisabled, values: formValues } = useFormRuntime();
  const { clearErrors, control, setFocus } = useFormContext<RuntimeValues>();
  const { field: controlled } = useController({
    control,
    name: path,
    shouldUnregister: unregisterOnUnmount,
  });
  const { errors } = useFormState({ control, exact: false, name: path });
  const watchedValue = useWatch({ control, name: path });
  const presentation = resolvePresentation(
    field,
    formValues,
    formDisabled || inheritedDisabled,
  );
  const readOnly = inheritedReadOnly || presentation.readOnly;
  const values = useMemo<readonly unknown[]>(
    () =>
      Array.isArray(watchedValue)
        ? watchedValue
        : Array.isArray(controlled.value)
          ? controlled.value
          : [],
    [controlled.value, watchedValue],
  );
  const keyState = useRef<ArrayKeyState>({
    itemKeys: values.map((_, index) => `${generatedId}-initial-${index}`),
    nextKey: 0,
  });
  const previousValues = useRef<readonly unknown[]>(values);
  if (
    previousValues.current !== values ||
    keyState.current.itemKeys.length !== values.length
  ) {
    const previous = previousValues.current;
    previousValues.current = values;
    keyState.current = reconcileItemKeys(
      previous,
      values,
      keyState.current,
      generatedId,
    );
  }
  const { itemKeys } = keyState.current;

  if (presentation.hidden) return null;

  const ArraySlot = adapter.slots.Array;
  const ArrayItem = adapter.slots.ArrayItem;
  const Button = adapter.slots.Button;
  const canAdd = field.maxItems === undefined || values.length < field.maxItems;
  const canRemove = values.length > (field.minItems ?? 0);
  const error = ownHookFormErrorMessage(valueAtPath(errors, path));
  const errorId = error ? `formadapter-${generatedId}-error` : undefined;
  const labels = field.config.array;
  const canMutate = !presentation.disabled && !readOnly;
  const required = resolveRequired(field, formValues);

  const focusItem = (index: number): void => {
    const target = firstFocusablePath(
      field.item,
      `${path}.${index}`,
      formValues,
      presentation.disabled,
    );
    if (target) requestAnimationFrame(() => setFocus(target));
  };

  const add = (): void => {
    if (!canAdd || presentation.disabled || readOnly) return;
    const nextValues = [...values, defaultValueForNode(field.item)];
    previousValues.current = nextValues;
    const current = keyState.current;
    keyState.current = {
      itemKeys: [
        ...current.itemKeys,
        `${generatedId}-added-${current.nextKey}`,
      ],
      nextKey: current.nextKey + 1,
    };
    controlled.onChange(nextValues);
    focusItem(values.length);
  };

  const remove = (index: number): void => {
    if (!canRemove || presentation.disabled || readOnly) return;
    const nextValues = values.filter((_, itemIndex) => itemIndex !== index);
    previousValues.current = nextValues;
    keyState.current = {
      ...keyState.current,
      itemKeys: keyState.current.itemKeys.filter((_, keyIndex) =>
        keyIndex !== index
      ),
    };
    clearErrors(path);
    controlled.onChange(nextValues);
    if (values.length > 1) focusItem(Math.min(index, values.length - 2));
  };

  const move = (from: number, to: number): void => {
    if (presentation.disabled || readOnly) return;
    const nextValues = moveItem(values, from, to);
    previousValues.current = nextValues;
    keyState.current = {
      ...keyState.current,
      itemKeys: moveItem(
        keyState.current.itemKeys,
        from,
        to,
      ) as readonly string[],
    };
    clearErrors(path);
    controlled.onChange(nextValues);
    focusItem(to);
  };

  return (
    <ArraySlot
      actions={canMutate ? (
        <Button
          disabled={!canAdd || presentation.disabled || readOnly}
          intent="add"
          onClick={add}
          type="button"
        >
          {labels?.addLabel ?? `Add ${field.label.toLocaleLowerCase()}`}
        </Button>
      ) : null}
      className={className ?? field.config.className}
      disabled={presentation.disabled}
      error={error}
      errorId={errorId}
      field={field}
      itemCount={values.length}
      readOnly={readOnly}
      required={required}
    >
      {required || Array.isArray(watchedValue ?? controlled.value) ? (
        <input name={ARRAY_MARKER} type="hidden" value={path} />
      ) : null}
      {values.map((_, index) => {
        const itemLabel = typeof labels?.itemLabel === "function"
          ? labels.itemLabel(index, values[index], formValues)
          : labels?.itemLabel
            ? `${labels.itemLabel} ${index + 1}`
            : `Item ${index + 1}`;
        const moveUpLabel = labels?.moveUpLabel ?? "Move up";
        const moveDownLabel = labels?.moveDownLabel ?? "Move down";
        const removeLabel = labels?.removeLabel ?? "Remove";
        return (
          <ArrayItem
            actions={canMutate ? (
              <>
                <Button
                  ariaLabel={`${moveUpLabel} ${itemLabel}`}
                  disabled={index === 0 || presentation.disabled || readOnly}
                  intent="move-up"
                  onClick={() => move(index, index - 1)}
                  type="button"
                >
                  {moveUpLabel}
                </Button>
                <Button
                  ariaLabel={`${moveDownLabel} ${itemLabel}`}
                  disabled={
                    index === values.length - 1 ||
                    presentation.disabled ||
                    readOnly
                  }
                  intent="move-down"
                  onClick={() => move(index, index + 1)}
                  type="button"
                >
                  {moveDownLabel}
                </Button>
                <Button
                  ariaLabel={`${removeLabel} ${itemLabel}`}
                  disabled={!canRemove || presentation.disabled || readOnly}
                  intent="remove"
                  onClick={() => remove(index)}
                  type="button"
                >
                  {removeLabel}
                </Button>
              </>
            ) : null}
            field={field}
            index={index}
            label={itemLabel}
            key={itemKeys[index] ?? `${generatedId}-pending-${index}`}
          >
            <NodeRenderer
              field={field.item}
              inheritedDisabled={presentation.disabled}
              inheritedReadOnly={readOnly}
              path={`${path}.${index}`}
              unregisterOnUnmount={false}
            />
          </ArrayItem>
        );
      })}
    </ArraySlot>
  );
}
