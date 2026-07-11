"use client";

import { useEffect, useRef, useState } from "react";

import { InstallSelector } from "./install-selector";

const PACKAGE_MANAGER_OPTIONS = [
  { label: "npm", value: "npm" },
  { label: "pnpm", value: "pnpm" },
  { label: "yarn", value: "yarn" },
  { label: "bun", value: "bun" },
] as const;

const FRAMEWORK_OPTIONS = [
  { label: "React", value: "react" },
] as const;

const UI_OPTIONS = [
  { label: "DaisyUI", value: "daisyui" },
  { label: "shadcn", value: "shadcn" },
  { label: "Bring your own", value: "custom" },
] as const;

type PackageManager = (typeof PACKAGE_MANAGER_OPTIONS)[number]["value"];
type UIChoice = (typeof UI_OPTIONS)[number]["value"];

const PACKAGE_MANAGER_COMMAND: Readonly<Record<PackageManager, string>> = {
  bun: "bun add",
  npm: "npm install",
  pnpm: "pnpm add",
  yarn: "yarn add",
};

const UI_DEPENDENCIES: Readonly<Record<UIChoice, string>> = {
  custom: "@formadapter/react @formadapter/html zod",
  daisyui: "@formadapter/react @formadapter/daisyui zod daisyui",
  shadcn: "@formadapter/react @formadapter/shadcn zod",
};

function keepReact(): void {}

function writeToClipboard(value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!navigator.clipboard) {
      reject(new Error("Clipboard API unavailable"));
      return;
    }

    const timeout = window.setTimeout(
      () => reject(new Error("Clipboard request timed out")),
      800,
    );
    navigator.clipboard.writeText(value).then(
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      (error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export function InstallCommand(): React.JSX.Element {
  const [packageManager, setPackageManager] = useState<PackageManager>("bun");
  const [ui, setUI] = useState<UIChoice>("daisyui");
  const [status, setStatus] = useState<
    "idle" | "copying" | "copied" | "selected"
  >("idle");
  const commandRef = useRef<HTMLElement>(null);
  const command = `${PACKAGE_MANAGER_COMMAND[packageManager]} ${UI_DEPENDENCIES[ui]}`;

  useEffect(() => {
    if (status === "idle" || status === "copying") return;
    const timeout = window.setTimeout(() => setStatus("idle"), 2400);
    return () => window.clearTimeout(timeout);
  }, [status]);

  async function copy(): Promise<void> {
    setStatus("copying");
    try {
      await writeToClipboard(command);
      setStatus("copied");
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      if (selection && commandRef.current) {
        range.selectNodeContents(commandRef.current);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setStatus("selected");
    }
  }

  function choosePackageManager(value: PackageManager): void {
    setPackageManager(value);
    setStatus("idle");
    window.getSelection()?.removeAllRanges();
  }

  function chooseUI(value: UIChoice): void {
    setUI(value);
    setStatus("idle");
    window.getSelection()?.removeAllRanges();
  }

  return (
    <div className="install-configurator">
      <div className="install-selectors">
        <InstallSelector
          disabled={status === "copying"}
          label="Package manager"
          onChange={choosePackageManager}
          options={PACKAGE_MANAGER_OPTIONS}
          value={packageManager}
        />
        <InstallSelector
          disabled={status === "copying"}
          label="Framework"
          onChange={keepReact}
          options={FRAMEWORK_OPTIONS}
          value="react"
        />
        <InstallSelector
          disabled={status === "copying"}
          label="UI"
          onChange={chooseUI}
          options={UI_OPTIONS}
          value={ui}
        />
      </div>
      <div className="install-command">
        <span aria-hidden="true" className="install-prompt">
          $
        </span>
        <code ref={commandRef}>{command}</code>
        <button
          aria-label="Copy install command"
          disabled={status === "copying"}
          onClick={() => void copy()}
          type="button"
        >
          {status === "copying"
            ? "Copying"
            : status === "copied"
              ? "Copied"
              : status === "selected"
                ? "Selected"
                : "Copy"}
        </button>
      </div>
      <output aria-live="polite" className="sr-only">
        {status === "copied"
          ? "Install command copied to clipboard."
          : status === "selected"
            ? "Clipboard access was unavailable. The install command is selected for manual copy."
            : ""}
      </output>
    </div>
  );
}
