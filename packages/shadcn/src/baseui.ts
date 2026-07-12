import type { BaseUIShadcnComponents } from "./components";
import { createBaseUIChoiceControls } from "./baseui-controls";
import { createShadcnSetup, type ShadcnSetup } from "./factory";

export type { BaseUIShadcnComponents } from "./components";
export type { ShadcnProviderProps, ShadcnSetup } from "./factory";

export function createShadcn(
  components: BaseUIShadcnComponents,
): ShadcnSetup {
  return createShadcnSetup(
    "shadcn/ui (Base UI)",
    components,
    createBaseUIChoiceControls(components),
  );
}
