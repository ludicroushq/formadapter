"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { UseFormReturn } from "react-hook-form";

import type { DeepPartial } from "@formadapter/core";

import { localStorageDraftAdapter } from "./draft";
import type { RuntimeValues } from "./form-context";
import { mergeDefaultValues } from "./runtime-utils";
import type { DraftAdapter, DraftConfig } from "./types";

export type DraftStatus = "idle" | "loading" | "ready" | "saving" | "error";

const CANCELLED_LOAD = Symbol("cancelled draft load");

export interface DraftRuntime {
  readonly clear: () => Promise<void>;
  readonly status: DraftStatus;
}

type DraftFormMethods = Pick<UseFormReturn<RuntimeValues>, "reset"> & {
  readonly formState: { readonly isDirty: boolean };
};

export function useDraftPersistence<Values>(options: {
  readonly config?: DraftConfig<Values> | undefined;
  readonly initialValues: RuntimeValues;
  readonly methods: DraftFormMethods;
  readonly values: RuntimeValues;
}): DraftRuntime {
  const { config, initialValues, methods, values } = options;
  const adapter = (config?.adapter ?? localStorageDraftAdapter) as unknown as DraftAdapter<Values>;
  const enabled = config !== undefined;
  const key = config?.key;
  const debounceMs = config?.debounceMs ?? 300;
  const [status, setStatus] = useState<DraftStatus>(config ? "loading" : "idle");
  const loaded = useRef(!config);
  const writeChain = useRef(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const generation = useRef(0);
  const mounted = useRef(true);
  const initialValuesRef = useRef(initialValues);
  const onErrorRef = useRef(config?.onError);
  const resetRef = useRef(methods.reset);

  initialValuesRef.current = initialValues;
  onErrorRef.current = config?.onError;
  resetRef.current = methods.reset;

  const cancelTimer = useCallback((): void => {
    if (timer.current === undefined) return;
    clearTimeout(timer.current);
    timer.current = undefined;
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      cancelTimer();
    };
  }, [cancelTimer]);

  useEffect(() => {
    cancelTimer();
    const currentGeneration = ++generation.current;

    if (!enabled || key === undefined) {
      loaded.current = true;
      setStatus("idle");
      return;
    }

    let cancelled = false;
    const baseValues = initialValuesRef.current;
    loaded.current = false;
    setStatus("loading");
    void Promise.resolve().then(() => {
      if (cancelled || currentGeneration !== generation.current) {
        return CANCELLED_LOAD;
      }
      return adapter.load(key);
    }).then((draft) => {
      if (
        draft === CANCELLED_LOAD ||
        cancelled ||
        currentGeneration !== generation.current
      ) return;
      const merged = draft
        ? mergeDefaultValues(baseValues, draft)
        : baseValues;
      resetRef.current(merged);
      loaded.current = true;
      if (mounted.current) setStatus("ready");
    }).catch((error: unknown) => {
      if (cancelled || currentGeneration !== generation.current) return;
      loaded.current = true;
      if (mounted.current) setStatus("error");
      onErrorRef.current?.(error);
    });

    return () => {
      cancelled = true;
    };
  }, [adapter, cancelTimer, enabled, key]);

  useEffect(() => {
    if (!enabled || key === undefined || !loaded.current || !methods.formState.isDirty) {
      return;
    }
    const currentGeneration = generation.current;
    const delay = Math.max(0, debounceMs);
    const snapshot = values as DeepPartial<Values>;
    const timeout = setTimeout(() => {
      if (timer.current === timeout) timer.current = undefined;
      if (currentGeneration !== generation.current) return;
      if (mounted.current) setStatus("saving");
      const pending = writeChain.current
        .catch(() => undefined)
        .then(() => {
          if (currentGeneration !== generation.current) return;
          return adapter.save(key, snapshot);
        })
        .then(() => {
          if (currentGeneration === generation.current && mounted.current) {
            setStatus("ready");
          }
        })
        .catch((error: unknown) => {
          if (currentGeneration !== generation.current) return;
          if (mounted.current) setStatus("error");
          onErrorRef.current?.(error);
        });
      writeChain.current = pending;
    }, delay);
    timer.current = timeout;
    return () => {
      if (timer.current !== timeout) return;
      clearTimeout(timeout);
      timer.current = undefined;
    };
  }, [adapter, debounceMs, enabled, key, methods.formState.isDirty, values]);

  const clear = useCallback(async (): Promise<void> => {
    if (!enabled || key === undefined) return;
    cancelTimer();
    const currentGeneration = ++generation.current;
    loaded.current = true;
    const pending = writeChain.current
      .catch(() => undefined)
      .then(() => adapter.clear(key))
      .then(() => {
        if (currentGeneration === generation.current && mounted.current) {
          setStatus("ready");
        }
      })
      .catch((error: unknown) => {
        if (currentGeneration !== generation.current) return;
        if (mounted.current) setStatus("error");
        onErrorRef.current?.(error);
      });
    writeChain.current = pending;
    await pending;
  }, [adapter, cancelTimer, enabled, key]);

  return { clear, status };
}
