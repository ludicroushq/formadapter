"use client";

import { createShadcn } from "@formadapter/shadcn/radix";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/radix-ui/alert";
import { Button } from "@/components/radix-ui/button";
import { Checkbox } from "@/components/radix-ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/radix-ui/field";
import { Input } from "@/components/radix-ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/radix-ui/native-select";
import { Progress } from "@/components/radix-ui/progress";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/radix-ui/radio-group";
import { Spinner } from "@/components/radix-ui/spinner";
import { Textarea } from "@/components/radix-ui/textarea";

export const shadcnRadix = createShadcn({
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Checkbox,
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
  Input,
  NativeSelect,
  NativeSelectOption,
  Progress,
  RadioGroup,
  RadioGroupItem,
  Spinner,
  Textarea,
});

export const ShadcnRadixProvider = shadcnRadix.Provider;
