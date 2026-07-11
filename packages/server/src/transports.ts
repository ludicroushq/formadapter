import { submissionFailure } from "@formadapter/core";
import type { FormSchema, SubmissionState } from "@formadapter/core";

import { createSubmissionHandler } from "./submission";
import type {
  CreatedSubmissionHandler,
  RequestHandler,
  ServerAction,
  SubmissionOptions,
  SubmissionValueHandler,
} from "./types";

function jsonResponse(
  state: SubmissionState,
  status: number,
  headers?: HeadersInit,
): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(state), {
    headers: responseHeaders,
    status,
  });
}

function transportFailure(message: string): ReturnType<typeof submissionFailure> {
  return submissionFailure({
    errorKind: "transport",
    formErrors: [message],
  });
}

function responseStatus(state: SubmissionState): number {
  if (state.status !== "error") return 200;
  return state.errorKind === "transport" ? 400 : 422;
}

function serverActionState<Data>(
  state: SubmissionState<Data>,
): SubmissionState<Data> {
  if (state.status !== "error") return state;
  return {
    ...state,
    fieldErrors: Object.fromEntries(
      Object.entries(state.fieldErrors).map(([path, messages]) => [
        path,
        [...messages],
      ]),
    ),
    formErrors: [...state.formErrors],
  };
}

function mediaType(request: Request): string {
  return request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function isJsonMediaType(type: string): boolean {
  return type === "application/json" || type.endsWith("+json");
}

function isFormMediaType(type: string): boolean {
  return type === "multipart/form-data" || type === "application/x-www-form-urlencoded";
}

/** Adapts a reusable submission to React/Next-style `(state, FormData)` actions. */
export function toServerAction<Data>(
  submission: CreatedSubmissionHandler<Data>,
): ServerAction<Data> {
  return async (previousState, formData) =>
    serverActionState(await submission(formData, { previousState }));
}

/** Creates a React/Next-style server action directly from a schema and handler. */
export function createServerAction<
  Schema extends FormSchema,
  Data = unknown,
>(
  schema: Schema,
  handler: SubmissionValueHandler<Schema, Data>,
  options: SubmissionOptions<Schema> = {},
): ServerAction<Data> {
  return toServerAction(createSubmissionHandler(schema, handler, options));
}

/** Adapts a reusable submission to a POST JSON/FormData HTTP request handler. */
export function toRequestHandler<Data>(
  submission: CreatedSubmissionHandler<Data>,
): RequestHandler {
  return async (request): Promise<Response> => {
    if (request.method.toUpperCase() !== "POST") {
      return jsonResponse(
        transportFailure("Only POST requests are supported."),
        405,
        { allow: "POST" },
      );
    }

    const type = mediaType(request);
    if (!isJsonMediaType(type) && !isFormMediaType(type)) {
      return jsonResponse(
        transportFailure("Expected a JSON or form request body."),
        415,
      );
    }

    let payload: unknown;
    try {
      payload = isJsonMediaType(type)
        ? await request.json()
        : await request.formData();
    } catch {
      return jsonResponse(transportFailure("Unable to read the request body."), 400);
    }

    const state = await submission(payload, { request });
    return jsonResponse(state, responseStatus(state));
  };
}

/** Creates a JSON/FormData HTTP handler directly from a schema and handler. */
export function createRequestHandler<
  Schema extends FormSchema,
  Data = unknown,
>(
  schema: Schema,
  handler: SubmissionValueHandler<Schema, Data>,
  options: SubmissionOptions<Schema> = {},
): RequestHandler {
  return toRequestHandler(createSubmissionHandler(schema, handler, options));
}
