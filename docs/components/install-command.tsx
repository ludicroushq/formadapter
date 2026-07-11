"use client";

import { useEffect, useRef, useState } from "react";

const command = "bun add @formadapter/react @formadapter/daisyui zod daisyui";

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
  const [status, setStatus] = useState<
    "idle" | "copying" | "copied" | "selected"
  >("idle");
  const commandRef = useRef<HTMLElement>(null);

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

  return (
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
