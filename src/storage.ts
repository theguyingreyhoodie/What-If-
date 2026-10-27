import type { Scenario } from "./model";

const KEY = "what-if:scenarios:v1";

export function loadScenarios(): Scenario[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Scenario[]) : [];
  } catch {
    return [];
  }
}

export function saveScenarios(scenarios: Scenario[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(scenarios));
  } catch {
    // Storage full or unavailable: scenarios still live for this session.
  }
}
