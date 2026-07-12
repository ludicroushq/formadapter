import {
  useCallback,
  useEffect,
  useRef,
  type ChangeEvent,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import {
  changedInputValue,
  inputType,
  inputValue,
  nativeControlProps,
  optionForValue,
  selectedOptionValue,
  serializedOptionValue,
} from "@formadapter/html/native";
import type { ControlComponent, ControlProps } from "@formadapter/react";

import type { CommonShadcnComponents } from "./components";

interface FileMetadata {
  readonly lastModified: number;
  readonly name: string;
  readonly size: number;
  readonly type: string;
}

function isFileMetadata(value: unknown): value is FileMetadata {
  return typeof value === "object" && value !== null &&
    typeof (value as Partial<FileMetadata>).lastModified === "number" &&
    typeof (value as Partial<FileMetadata>).name === "string" &&
    typeof (value as Partial<FileMetadata>).size === "number" &&
    typeof (value as Partial<FileMetadata>).type === "string";
}

function controlledFiles(value: unknown): readonly FileMetadata[] {
  if (isFileMetadata(value)) return [value];
  if (typeof FileList !== "undefined" && value instanceof FileList) {
    return Array.from(value).filter(isFileMetadata);
  }
  if (!Array.isArray(value)) return [];
  return value.filter(isFileMetadata);
}

function nativeFilesMatch(value: unknown, files: FileList | null): boolean {
  const controlled = controlledFiles(value);
  if (controlled.length === 0 || files?.length !== controlled.length) {
    return false;
  }
  return controlled.every((file, index) => {
    const nativeFile = files.item(index);
    return nativeFile !== null &&
      (Object.is(file, nativeFile) ||
        (file.name === nativeFile.name &&
          file.size === nativeFile.size &&
          file.type === nativeFile.type &&
          file.lastModified === nativeFile.lastModified));
  });
}

export interface NativeControls {
  readonly file: ControlComponent;
  readonly input: ControlComponent;
  readonly select: ControlComponent;
  readonly textarea: ControlComponent;
}

export function createNativeControls(
  components: CommonShadcnComponents,
): NativeControls {
  const {
    Input: ShadcnInput,
    NativeSelect,
    NativeSelectOption,
    Textarea: ShadcnTextarea,
  } = components;

  function InputControl({
    controlRef,
    disabled,
    field,
    id,
    inputProps,
    name,
    onBlur,
    onValueChange,
    readOnly,
    required,
    value,
  }: ControlProps): React.JSX.Element {
    const configured = nativeControlProps<InputHTMLAttributes<HTMLInputElement>>(
      field,
    );
    const type = inputType(field);

    return (
      <ShadcnInput
        {...configured.props}
        {...inputProps}
        className={configured.className}
        disabled={disabled || (readOnly && type === "range")}
        id={id}
        max={field.constraints.maximum}
        maxLength={field.constraints.maxLength}
        min={field.constraints.minimum}
        minLength={field.constraints.minLength}
        name={name}
        onBlur={onBlur}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          if (readOnly) return;
          onValueChange(
            changedInputValue(
              field,
              event.currentTarget.value,
              event.currentTarget.valueAsNumber,
            ),
          );
        }}
        pattern={field.constraints.pattern}
        placeholder={field.config.placeholder ?? configured.props.placeholder}
        readOnly={readOnly}
        ref={controlRef}
        required={required}
        step={
          field.constraints.multipleOf ??
          (field.dataType === "integer"
            ? 1
            : field.dataType === "number"
              ? "any"
              : undefined)
        }
        style={configured.style}
        type={type}
        value={inputValue(value, type)}
      />
    );
  }

  function TextareaControl({
    controlRef,
    disabled,
    field,
    id,
    inputProps,
    name,
    onBlur,
    onValueChange,
    readOnly,
    required,
    value,
  }: ControlProps): React.JSX.Element {
    const configured =
      nativeControlProps<TextareaHTMLAttributes<HTMLTextAreaElement>>(field);

    return (
      <ShadcnTextarea
        {...configured.props}
        {...inputProps}
        className={configured.className}
        disabled={disabled}
        id={id}
        maxLength={field.constraints.maxLength}
        minLength={field.constraints.minLength}
        name={name}
        onBlur={onBlur}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          if (!readOnly) onValueChange(event.currentTarget.value);
        }}
        placeholder={field.config.placeholder ?? configured.props.placeholder}
        readOnly={readOnly}
        ref={controlRef}
        required={required}
        style={configured.style}
        value={inputValue(value)}
      />
    );
  }

  function SelectControl({
    controlRef,
    disabled,
    field,
    id,
    inputProps,
    name,
    onBlur,
    onValueChange,
    readOnly,
    required,
    value,
  }: ControlProps): React.JSX.Element {
    const configured =
      nativeControlProps<SelectHTMLAttributes<HTMLSelectElement>>(field);
    const { size: _configuredSize, ...configuredProps } = configured.props;
    const options = field.options ?? [];
    const placeholder = field.config.placeholder ?? "Select an option";

    return (
      <NativeSelect
        {...configuredProps}
        {...inputProps}
        aria-readonly={readOnly || undefined}
        className={configured.className}
        disabled={disabled || readOnly}
        id={id}
        name={name}
        onBlur={onBlur}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => {
          if (readOnly) return;
          const selected = optionForValue(options, event.currentTarget.value);
          onValueChange(selected ? selected.value : "");
        }}
        ref={controlRef}
        required={required}
        style={configured.style}
        value={selectedOptionValue(options, value)}
      >
        <NativeSelectOption disabled={required} value="">
          {placeholder}
        </NativeSelectOption>
        {options.map((option, index) => (
          <NativeSelectOption
            key={`${serializedOptionValue(option.value)}-${index}`}
            value={serializedOptionValue(option.value)}
          >
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    );
  }

  function FileControl({
    controlRef,
    disabled,
    field,
    id,
    inputProps,
    name,
    onBlur,
    onValueChange,
    readOnly,
    required,
    value,
  }: ControlProps): React.JSX.Element {
    const configured = nativeControlProps<InputHTMLAttributes<HTMLInputElement>>(
      field,
    );
    const input = useRef<HTMLInputElement | null>(null);
    const setControlRef = useCallback((instance: HTMLInputElement | null) => {
      input.current = instance;
      controlRef(instance);
    }, [controlRef]);

    useEffect(() => {
      const current = input.current;
      if (current?.value && !nativeFilesMatch(value, current.files)) {
        current.value = "";
      }
    }, [value]);

    return (
      <ShadcnInput
        {...configured.props}
        {...inputProps}
        accept={
          field.constraints.accept ??
          field.constraints.contentMediaType ??
          configured.props.accept
        }
        className={configured.className}
        disabled={disabled || readOnly}
        id={id}
        multiple={field.config.multiple || field.constraints.multiple}
        name={name}
        onBlur={onBlur}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const files = event.currentTarget.files;
          onValueChange(
            field.config.multiple || field.constraints.multiple
              ? Array.from(files ?? [])
              : files?.[0] ?? "",
          );
        }}
        ref={setControlRef}
        required={required}
        style={configured.style}
        type="file"
      />
    );
  }

  return {
    file: FileControl,
    input: InputControl,
    select: SelectControl,
    textarea: TextareaControl,
  };
}
