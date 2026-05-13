// src/projects/types.ts
import { z } from "zod";
import { BlockDefDataSchema } from "../blocks/dataBlock";
import { ScenarioSchema } from "../scenarios/types";
import { EnvironmentSchema } from "../environments/types";

// ---------------------------------------------------------------------------
// ChangeEntrySchema
// ---------------------------------------------------------------------------

export const ChangeTypeSchema = z.enum([
  "added",
  "modified",
  "deprecated",
  "removed",
  "fixed",
  "note",
]);

export type ChangeType = z.infer<typeof ChangeTypeSchema>;

export const ChangeEntrySchema = z.object({
  type: ChangeTypeSchema,
  target: z.string().optional(),
  summary: z.string(),
  breaking: z.boolean().optional(),
  removeBy: z.string().optional(),
});

export type ChangeEntry = z.infer<typeof ChangeEntrySchema>;

// ---------------------------------------------------------------------------
// VersionSchema
// ---------------------------------------------------------------------------

export const VersionSchema = z.object({
  version: z.string(),
  releasedAt: z.string(),
  releaseNotes: z.string(),
  changes: z.array(ChangeEntrySchema),
  blocks: z.array(BlockDefDataSchema),
  scenarios: z.array(ScenarioSchema),
  environments: z.array(EnvironmentSchema),
  docs: z.record(z.string(), z.string()),
});

export type ProjectVersion = z.infer<typeof VersionSchema>;

// ---------------------------------------------------------------------------
// ProjectBundleSchema
// ---------------------------------------------------------------------------

export const ProjectBundleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.string(),
  versions: z.array(VersionSchema),
});

export type ProjectBundle = z.infer<typeof ProjectBundleSchema>;

// ---------------------------------------------------------------------------
// ProjectsStateSchema
// ---------------------------------------------------------------------------

export const ProjectsStateSchema = z.object({
  bundles: z.array(ProjectBundleSchema),
  activeProjectId: z.string().nullable(),
  activeVersionByProject: z.record(z.string(), z.string()),
});

export type ProjectsState = z.infer<typeof ProjectsStateSchema>;
