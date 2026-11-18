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

// Fires when another tab changes the saved scenarios, so tabs don't overwrite each other's history.
// (The storage event never fires in the tab that made the change.)
export function onScenariosChangedElsewhere(callback: (scenarios: Scenario[]) => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) callback(loadScenarios());
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
