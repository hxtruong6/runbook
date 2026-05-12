import { ScenarioSchema, type Scenario } from "./types";

export function scenarioToJson(s: Scenario): string {
  return JSON.stringify(s, null, 2);
}

export function scenarioFromJson(text: string): Scenario {
  const parsed = JSON.parse(text);
  return ScenarioSchema.parse(parsed);
}

export function downloadScenario(s: Scenario): void {
  const blob = new Blob([scenarioToJson(s)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${s.name.replace(/\s+/g, "-")}.scenario.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function readScenarioFile(file: File): Promise<Scenario> {
  const text = await file.text();
  return scenarioFromJson(text);
}
