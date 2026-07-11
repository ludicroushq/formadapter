import {
  createFormFactory,
  type CreateForm,
} from "@formadapter/react";

import { htmlAdapter } from "./adapter";

export { htmlAdapter } from "./adapter";
export { HTMLProvider } from "./provider";
export type { HTMLProviderProps } from "./provider";
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

export const createForm: CreateForm<typeof htmlAdapter> =
  createFormFactory(htmlAdapter);
