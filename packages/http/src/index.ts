import {
  isSubmissionState,
  submissionFailure,
  submissionSuccess,
  type SubmissionState,
} from "@formadapter/core";

export interface HttpSubmissionContext<Input = unknown> {
  readonly input: Input;
  readonly formData: FormData;
  readonly signal: AbortSignal;
}

export interface HttpSubmissionOptions {
  readonly url: RequestInfo | URL;
  readonly body?: "form-data" | "json";
  readonly fetch?: typeof globalThis.fetch;
  readonly init?:
    | Omit<RequestInit, "body" | "signal">
    | ((context: HttpSubmissionContext) => Omit<RequestInit, "body" | "signal">);
  readonly errorMessage?: string;
}

export type HttpSubmission = (
  output: unknown,
  context: HttpSubmissionContext,
) => Promise<SubmissionState>;

const DEFAULT_NETWORK_ERROR_MESSAGE =
  "Unable to reach the server. Please try again.";
const DEFAULT_RESPONSE_ERROR_MESSAGE =
  "Unable to read the server response. Please try again.";

function transportFailure(message: string): SubmissionState {
  return submissionFailure({
    errorKind: "transport",
    formErrors: [message],
  });
}

function isAbort(error: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;
  try {
    return (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "AbortError"
    );
  } catch {
    return false;
  }
}

function fallbackMessage(
  configured: string | undefined,
  fallback: string,
): string {
  return configured?.trim() ? configured : fallback;
}

function responseErrorMessage(body: unknown): string | undefined {
  if (typeof body === "string") return body.trim() ? body : undefined;
  if (typeof body !== "object" || body === null) return undefined;
  try {
    if (!Object.hasOwn(body, "message")) return undefined;
    const message = (body as Readonly<Record<string, unknown>>).message;
    return typeof message === "string" && message.trim() ? message : undefined;
  } catch {
    return undefined;
  }
}

async function responseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase() ?? "";
  if (contentType === "application/json" || contentType.endsWith("+json")) {
    return response.json();
  }
  const text = await response.text();
  return text || undefined;
}

export function createHttpSubmission(
  options: HttpSubmissionOptions,
): HttpSubmission {
  return async (_output, context) => {
    const request = options.fetch ?? globalThis.fetch;
    const configured = typeof options.init === "function"
      ? options.init(context)
      : options.init ?? {};
    const formDataBody = options.body === "form-data";
    const headers = new Headers(configured.headers);
    if (!formDataBody && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    let response: Response;
    try {
      response = await request(options.url, {
        ...configured,
        body: formDataBody
          ? context.formData
          : JSON.stringify(context.input),
        headers,
        method: configured.method ?? "POST",
        signal: context.signal,
      });
    } catch (error) {
      if (isAbort(error, context.signal)) throw error;
      return transportFailure(
        fallbackMessage(options.errorMessage, DEFAULT_NETWORK_ERROR_MESSAGE),
      );
    }

    let body: unknown;
    try {
      body = await responseBody(response);
    } catch (error) {
      if (isAbort(error, context.signal)) throw error;
      return transportFailure(
        fallbackMessage(options.errorMessage, DEFAULT_RESPONSE_ERROR_MESSAGE),
      );
    }

    if (!response.ok) {
      if (response.status >= 500) {
        return transportFailure(
          fallbackMessage(
            options.errorMessage,
            `Request failed with status ${response.status}`,
          ),
        );
      }
      if (isSubmissionState(body) && body.status === "error") return body;
      const message = responseErrorMessage(body) ?? fallbackMessage(
        options.errorMessage,
        `Request failed with status ${response.status}`,
      );
      return transportFailure(message);
    }
    if (isSubmissionState(body)) return body;
    return submissionSuccess(body);
  };
}
