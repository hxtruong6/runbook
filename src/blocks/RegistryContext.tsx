// src/blocks/RegistryContext.tsx
import { createContext, useContext, type ReactNode } from "react";
import type { BlockDef } from "./types";
import { COMPILED_BLOCKS } from "./index";

const RegistryCtx = createContext<Record<string, BlockDef> | null>(null);

export function RegistryProvider({
  registry,
  children,
}: {
  registry: Record<string, BlockDef>;
  children: ReactNode;
}) {
  return <RegistryCtx.Provider value={registry}>{children}</RegistryCtx.Provider>;
}

export function useBlockRegistry(): Record<string, BlockDef> {
  const v = useContext(RegistryCtx);
  return v ?? COMPILED_BLOCKS;
}
