import {
  useCallback,
  useEffect,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

import type { ControlProps } from "@formadapter/react";
import { nativeControlProps } from "@formadapter/html/native";

import { classNames } from "../class-names";
import { useDaisyUIClassNames } from "../prefix";
import { mergeControlStyle } from "./control-style";

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

function nativeFilesMatch(
  value: unknown,
  files: FileList | null,
): boolean {
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

export function File({
  controlRef,
  disabled,
  field,
  id,
  inputProps,
  invalid,
  name,
  onBlur,
  onValueChange,
  readOnly,
  required,
  value,
}: ControlProps): ReactNode {
  const configured = nativeControlProps<InputHTMLAttributes<HTMLInputElement>>(
    field,
  );
  const daisyClassName = useDaisyUIClassNames(
    "file-input",
    invalid && "file-input-error",
  );
  const input = useRef<HTMLInputElement | null>(null);
  const setControlRef = useCallback((instance: HTMLInputElement | null) => {
    input.current = instance;
    controlRef(instance);
  }, [controlRef]);
  useEffect(() => {
    const current = input.current;
    if (current?.value && !nativeFilesMatch(value, current.files)) {
      // Browsers forbid assigning a non-empty file selection. Clear a stale
      // native label rather than displaying file A while form state submits B.
      current.value = "";
    }
  }, [value]);

  return (
    <input
      {...configured.props}
      {...inputProps}
      accept={
        field.constraints.accept ??
        field.constraints.contentMediaType ??
        configured.props.accept
      }
      className={classNames(
        daisyClassName,
        configured.className,
      )}
      disabled={disabled || readOnly}
      id={id}
      multiple={
        field.config.multiple ||
        field.constraints.multiple
      }
      name={name}
      onBlur={onBlur}
      onChange={(event) => {
        const files = event.currentTarget.files;
        onValueChange(
          field.config.multiple ||
          field.constraints.multiple
            ? Array.from(files ?? [])
            : files?.[0] ?? "",
        );
      }}
      ref={setControlRef}
      required={required}
      style={mergeControlStyle(configured.style)}
      type="file"
    />
  );
}
