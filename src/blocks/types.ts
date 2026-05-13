// src/blocks/types.ts

export type RuntimeContext = Record<string, unknown> & {
  socketSessionUuid: string;
};

export type FieldType = "string" | "password" | "number" | "enum" | "json";

export type FieldSpec = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  fromContextKey?: string;          // auto-fill from context if not overridden
  enumValues?: readonly string[];   // when type === "enum"
  placeholder?: string;
};

export type OutputSpec = {
  jsonPath: string;                 // dot path, e.g. "data.syncToken"
  contextKey: string;               // where to store in context
};

export type AuthMode = "none" | "jwt" | "cookie-or-jwt";

export type HttpRequest = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  headers: Record<string, string>;
  body?: unknown;
};

export type BlockDef = {
  kind: string;
  label: string;
  inputs: FieldSpec[];
  outputs: OutputSpec[];
  auth: AuthMode;
  build: (values: Record<string, unknown>) => HttpRequest;
};

export type BlockInstance = {
  id: string;                       // uuid, stable across runs
  kind: string;
  overrides: Record<string, unknown>; // user-set literal values (empty = use context)
};

export type ResolvedRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
};

export type BlockRunResult =
  | { status: "ok"; httpStatus: number; elapsedMs: number; response: unknown; captured: Record<string, unknown>; request?: ResolvedRequest; subResults?: BlockRunResult[] }
  | { status: "err"; httpStatus?: number; elapsedMs: number; response: unknown; error: string; request?: ResolvedRequest; subResults?: BlockRunResult[] };
