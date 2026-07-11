import {
  createAdapter,
  type FormAdapter,
} from "@formadapter/react";

import { Checkbox } from "./controls/checkbox";
import { File } from "./controls/file";
import { Input } from "./controls/input";
import { Radio } from "./controls/radio";
import { Select } from "./controls/select";
import { Textarea } from "./controls/textarea";
import { Array } from "./slots/array";
import { ArrayItem } from "./slots/array-item";
import { Button } from "./slots/button";
import { ErrorSummary } from "./slots/error-summary";
import { Field } from "./slots/field";
import { Form } from "./slots/form";
import { FormMessage } from "./slots/form-message";
import { Group } from "./slots/group";
import { Unsupported } from "./slots/unsupported";
import { Wizard } from "./slots/wizard";

export const daisyUIAdapter: FormAdapter<Record<never, never>> = createAdapter({
  name: "DaisyUI",
  controls: {
    checkbox: Checkbox,
    custom: {},
    file: File,
    input: Input,
    radio: Radio,
    select: Select,
    textarea: Textarea,
  },
  slots: {
    Array,
    ArrayItem,
    Button,
    ErrorSummary,
    Field,
    Form,
    FormMessage,
    Group,
    Unsupported,
    Wizard,
  },
});
