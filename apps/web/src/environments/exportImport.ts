// src/environments/exportImport.ts
import { EnvironmentSchema, type Environment } from "./types";

export function environmentToJson(e: Environment): string {
  return JSON.stringify(e, null, 2);
}

export function environmentFromJson(text: string): Environment {
  const parsed = JSON.parse(text);
  return EnvironmentSchema.parse(parsed);
}

export function downloadEnvironment(e: Environment): void {
  const blob = new Blob([environmentToJson(e)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${e.name.replace(/\s+/g, "-")}.environment.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function readEnvironmentFile(file: File): Promise<Environment> {
  const text = await file.text();
  return environmentFromJson(text);
}
