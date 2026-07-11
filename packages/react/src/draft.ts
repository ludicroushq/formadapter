"use client";

import type { DeepPartial } from "@formadapter/core";

import type { StorageDraftAdapter } from "./types";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function isFileLike(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  if (typeof File !== "undefined" && value instanceof File) return true;
  if (typeof Blob !== "undefined" && value instanceof Blob) return true;
  const tag = Object.prototype.toString.call(value);
  return tag === "[object File]" || tag === "[object Blob]";
}

function storageReplacer(_key: string, value: unknown): unknown {
  return isFileLike(value) ? undefined : value;
}

export function createStorageDraftAdapter(
  getStorage: () => StorageLike,
): StorageDraftAdapter {
  return {
    clear: (key) => getStorage().removeItem(key),
    load: <Values>(key: string) => {
      const stored = getStorage().getItem(key);
      return stored === null
        ? null
        : JSON.parse(stored) as DeepPartial<Values>;
    },
    save: <Values>(key: string, values: DeepPartial<Values>) => {
      getStorage().setItem(key, JSON.stringify(values, storageReplacer));
    },
  };
}

export const localStorageDraftAdapter: StorageDraftAdapter =
  createStorageDraftAdapter(() => window.localStorage);

export const sessionStorageDraftAdapter: StorageDraftAdapter =
  createStorageDraftAdapter(() => window.sessionStorage);
