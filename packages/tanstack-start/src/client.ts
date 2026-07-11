"use client";

import {
  useCallback,
  useMemo,
} from "react";
import { useServerFn } from "@tanstack/react-start";

import type { SubmissionState } from "@formadapter/core";

export interface FormAdapterSubmissionContext<Input = unknown> {
  readonly input: Input;
  readonly formData: FormData;
  readonly signal: AbortSignal;
}

export interface TanStackStartCallOptions {
  readonly data: FormData;
  readonly signal?: AbortSignal;
  readonly headers?: HeadersInit;
  readonly fetch?: typeof fetch;
}

/** The stable public surface used from a TanStack Start server function. */
export type TanStackStartServerFn<
  Result extends SubmissionState = SubmissionState,
> = ((options: TanStackStartCallOptions) => Promise<Result>) & {
  readonly url: string;
  readonly method?: "GET" | "POST";
};

export interface TanStackStartSubmissionMetadata {
  readonly url: string;
  readonly method: "post";
  readonly encType: "multipart/form-data";
}

type HeadersOption<Values = unknown, Input = unknown> =
  | HeadersInit
  | ((
      values: Values,
      context: FormAdapterSubmissionContext<Input>,
    ) => HeadersInit | undefined);

export interface UseTanStackStartSubmissionOptions<
  Values = unknown,
  Input = unknown,
> {
  /** Override the FormData sent to the server function. */
  readonly getFormData?: (
    values: Values,
    context: FormAdapterSubmissionContext<Input>,
  ) => FormData;
  readonly headers?: HeadersOption<Values, Input>;
  readonly fetch?: typeof fetch;
}

export type TanStackStartSubmissionHandler<
  Result extends SubmissionState = SubmissionState,
  Values = unknown,
  Input = unknown,
> = ((
  values: Values,
  context: FormAdapterSubmissionContext<Input>,
) => Promise<Result>) & {
  /** Copied from the original server function, not the useServerFn callback. */
  readonly url: string;
  readonly metadata: TanStackStartSubmissionMetadata;
};

export function getTanStackStartSubmissionMetadata(
  serverFn: { readonly url: string },
): TanStackStartSubmissionMetadata {
  return {
    encType: "multipart/form-data",
    method: "post",
    url: serverFn.url,
  };
}

/**
 * Creates a FormAdapter `onSubmit` handler backed by TanStack Start's
 * redirect-aware `useServerFn` invocation.
 */
export function useTanStackStartSubmission<
  Result extends SubmissionState,
  Values = unknown,
  Input = unknown,
>(
  serverFn: TanStackStartServerFn<Result>,
  options: UseTanStackStartSubmissionOptions<Values, Input> = {},
): TanStackStartSubmissionHandler<Result, Values, Input> {
  if (serverFn.method !== undefined && serverFn.method !== "POST") {
    throw new Error(
      "FormAdapter submissions require a TanStack Start POST server function.",
    );
  }

  const invoke = useServerFn(serverFn);
  const url = serverFn.url;
  const { fetch: customFetch, getFormData, headers } = options;
  const submit = useCallback(
    async (
      values: Values,
      context: FormAdapterSubmissionContext<Input>,
    ): Promise<Result> => {
      const resolvedHeaders = typeof headers === "function"
        ? headers(values, context)
        : headers;
      const call: TanStackStartCallOptions = {
        data: getFormData?.(values, context) ?? context.formData,
        signal: context.signal,
        ...(resolvedHeaders !== undefined ? { headers: resolvedHeaders } : {}),
        ...(customFetch !== undefined ? { fetch: customFetch } : {}),
      };
      return invoke(call);
    },
    [customFetch, getFormData, headers, invoke],
  );
  const metadata = useMemo(
    () => getTanStackStartSubmissionMetadata({ url }),
    [url],
  );

  return useMemo(
    () => Object.assign(submit, { metadata, url }),
    [metadata, submit, url],
  );
}
