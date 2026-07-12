import type { ComponentType, ReactNode } from "react";

import {
  createAdapter,
  createFormFactory,
  FormAdapterProvider,
  type ControlComponent,
  type CreateForm,
  type FormAdapter,
} from "@formadapter/react";

import type { CommonShadcnComponents } from "./components";
import { createNativeControls } from "./native-controls";
import { createSlots } from "./slots";

type EmptyControls = Record<never, never>;
type ShadcnFormAdapter = FormAdapter<EmptyControls>;

export interface ShadcnProviderProps {
  readonly children: ReactNode;
}

export interface ShadcnSetup {
  readonly adapter: ShadcnFormAdapter;
  readonly createForm: CreateForm<ShadcnFormAdapter>;
  readonly Provider: ComponentType<ShadcnProviderProps>;
}

export interface ChoiceControls {
  readonly checkbox: ControlComponent;
  readonly radio: ControlComponent;
}

export function createShadcnSetup(
  name: string,
  components: CommonShadcnComponents,
  choices: ChoiceControls,
): ShadcnSetup {
  const native = createNativeControls(components);
  const adapter: ShadcnFormAdapter = createAdapter({
    name,
    controls: {
      checkbox: choices.checkbox,
      custom: {},
      file: native.file,
      input: native.input,
      radio: choices.radio,
      select: native.select,
      textarea: native.textarea,
    },
    slots: createSlots(components),
  });

  function Provider({ children }: ShadcnProviderProps): ReactNode {
    return (
      <FormAdapterProvider adapter={adapter}>
        {children}
      </FormAdapterProvider>
    );
  }

  return {
    adapter,
    createForm: createFormFactory(adapter),
    Provider,
  };
}
