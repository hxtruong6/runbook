// src/projects/exportImport.ts
import { ProjectBundleSchema, type ProjectBundle } from "./types";

export function bundleToJson(b: ProjectBundle): string {
  return JSON.stringify(b, null, 2);
}

export function bundleFromJson(text: string): ProjectBundle {
  const parsed = JSON.parse(text);
  return ProjectBundleSchema.parse(parsed);
}

export function downloadBundle(b: ProjectBundle): void {
  const blob = new Blob([bundleToJson(b)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${b.id}.bundle.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function readBundleFile(file: File): Promise<ProjectBundle> {
  const text = await file.text();
  return bundleFromJson(text);
}
