"use client";

import { createFormFactory, type CreateForm } from "@formadapter/react";

import { shadcnAdapter } from "./adapter";

export { shadcnAdapter } from "./adapter";
export { ShadcnProvider } from "./provider";
export type { ShadcnProviderProps } from "./provider";
export { Checkbox } from "./controls/checkbox";
export { File } from "./controls/file";
export { Input } from "./controls/input";
export { Radio } from "./controls/radio";
export { Select } from "./controls/select";
export { Textarea } from "./controls/textarea";
export { Array } from "./slots/array";
export { ArrayItem } from "./slots/array-item";
export { Button } from "./slots/button";
export { ErrorSummary } from "./slots/error-summary";
export { Field } from "./slots/field";
export { Form } from "./slots/form";
export { FormMessage } from "./slots/form-message";
export { Group } from "./slots/group";
export { Unsupported } from "./slots/unsupported";
export { Wizard } from "./slots/wizard";

export const createForm: CreateForm<typeof shadcnAdapter> =
  createFormFactory(shadcnAdapter);
