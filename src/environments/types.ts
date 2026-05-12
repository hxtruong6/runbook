// src/environments/types.ts
import { z } from "zod";

export const AuthConfigSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("bearer"), token: z.string() }),
  z.object({ kind: z.literal("cookie"), token: z.string().optional() }),
  z.object({
    kind: z.literal("apiKey"),
    in: z.enum(["header", "query"]),
    name: z.string(),
    value: z.string(),
  }),
  z.object({ kind: z.literal("basic"), username: z.string(), password: z.string() }),
  z.object({ kind: z.literal("none") }),
]);

export const EnvironmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseUrl: z.string().url(),
  auth: AuthConfigSchema,
  headers: z.record(z.string(), z.string()).default({}),
  createdAt: z.string(),
});

export const EnvironmentsStateSchema = z.object({
  environments: z.array(EnvironmentSchema),
  activeId: z.string().nullable(),
});

export type AuthConfig = z.infer<typeof AuthConfigSchema>;
export type Environment = z.infer<typeof EnvironmentSchema>;
export type EnvironmentsState = z.infer<typeof EnvironmentsStateSchema>;
