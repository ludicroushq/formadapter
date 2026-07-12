import type { RadixShadcnComponents } from "./components";
import { createShadcnSetup, type ShadcnSetup } from "./factory";
import { createRadixChoiceControls } from "./radix-controls";

export type { RadixShadcnComponents } from "./components";
export type { ShadcnProviderProps, ShadcnSetup } from "./factory";

export function createShadcn<const Components extends RadixShadcnComponents>(
  components: Components,
): ShadcnSetup {
  return createShadcnSetup(
    "shadcn/ui (Radix UI)",
    components,
    createRadixChoiceControls(components),
  );
}
