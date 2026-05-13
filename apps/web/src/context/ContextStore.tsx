// src/context/ContextStore.tsx
import { createContext, useContext, useReducer, type ReactNode } from "react";
import type { RuntimeContext } from "../blocks/types";

export type ContextAction =
  | { type: "MERGE"; values: Record<string, unknown> }
  | { type: "SET_KEY"; key: string; value: unknown }
  | { type: "RESET" };

export function makeInitialContext(): RuntimeContext {
  return { socketSessionUuid: crypto.randomUUID() };
}

export function contextReducer(state: RuntimeContext, action: ContextAction): RuntimeContext {
  switch (action.type) {
    case "MERGE":
      return { ...state, ...action.values };
    case "SET_KEY":
      return { ...state, [action.key]: action.value };
    case "RESET":
      return makeInitialContext();
  }
}

type StoreValue = {
  context: RuntimeContext;
  dispatch: React.Dispatch<ContextAction>;
};

const StoreCtx = createContext<StoreValue | null>(null);

export function ContextStoreProvider({ children }: { children: ReactNode }) {
  const [context, dispatch] = useReducer(contextReducer, undefined, makeInitialContext);
  return <StoreCtx.Provider value={{ context, dispatch }}>{children}</StoreCtx.Provider>;
}

export function useRuntimeContext(): StoreValue {
  const v = useContext(StoreCtx);
  if (!v) throw new Error("useRuntimeContext must be inside ContextStoreProvider");
  return v;
}
