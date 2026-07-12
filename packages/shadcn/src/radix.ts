import type { RadixShadcnComponents } from "./components";
import { createShadcnSetup, type ShadcnSetup } from "./factory";
import { createRadixChoiceControls } from "./radix-controls";

export type { RadixShadcnComponents } from "./components";
export type { ShadcnProviderProps, ShadcnSetup } from "./factory";

export function createShadcn(
  components: RadixShadcnComponents,
): ShadcnSetup {
  return createShadcnSetup(
    "shadcn/ui (Radix UI)",
    components,
    createRadixChoiceControls(components),
  );
}
