import type { BranchResult, ScenarioResult, SimulateRequest } from "../shared/schema";

// Canned responses for DEMO=1, so the UI can be explored without an API key.

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    });
  });

async function fakeThinking(lines: string[], onThinking: (d: string) => void, signal: AbortSignal) {
  for (const line of lines) {
    await sleep(450, signal);
    onThinking(line + "\n\n");
  }
}

export async function demoSimulate(req: SimulateRequest, onThinking: (d: string) => void, signal: AbortSignal): Promise<ScenarioResult> {
  await fakeThinking(
    [
      "**Locating the divergence.** The demo always uses the Library of Alexandria, whatever you typed.",
      "**Tracing first-order effects.** Surviving texts mean Hero's engines and Archimedes' work stay in circulation.",
      "**Following the cascade.** Earlier print culture, then earlier mechanization. Checking each step for plausibility.",
    ],
    onThinking,
    signal,
  );
  return {
    title: "The Unburned Shelves",
    divergence: {
      year: "48 BCE",
      description: `(Demo data. Your premise was "${req.premise}".) Caesar's fire in Alexandria's harbor is contained before it reaches the warehouses, and the Library's collections survive intact.`,
    },
    summary:
      "With the Library's scrolls preserved and copied, Hellenistic engineering never falls out of use. Mechanical knowledge spreads along Roman trade routes, and an industrial age arrives roughly a thousand years early.",
    events: [
      { year: "30 BCE", title: "Rome inherits the Library", description: "Octavian makes the Library an imperial institution and funds copying workshops in Rome and Antioch. Duplicate collections mean no single fire can ever erase them again.", category: "culture", impact: "major", plausibility: 78 },
      { year: "c. 60 CE", title: "Hero's engine finds a buyer", description: "A Roman mine owner reads Hero's treatises in a Library copy and pays engineers to scale the aeolipile into a pump. It drains flooded silver mines in Hispania faster than slave crews can.", category: "technology", impact: "major", plausibility: 52 },
      { year: "c. 150 CE", title: "The Antikythera school", description: "Workshops building geared astronomical calculators become a prestige trade. Precision gearing spreads from instrument makers to millers and clockmakers.", category: "science", impact: "major", plausibility: 58 },
      { year: "c. 410 CE", title: "The sack that wasn't total", description: "Rome is still sacked, but its scrolls survive in a dozen provincial libraries. The Eastern Empire keeps the technical canon in continuous use.", category: "conflict", impact: "world-changing", plausibility: 65 },
      { year: "c. 800 CE", title: "Steam on the Bosporus", description: "Constantinople's arsenal runs steam-driven bellows and lathes. Byzantine ships carrying pumped Greek fire dominate the Mediterranean for two centuries.", category: "technology", impact: "world-changing", plausibility: 41 },
      { year: "c. 1050 CE", title: "Presses of Baghdad and Byzantium", description: "Rival courts race to print the Library's catalog using carved-block and early movable-type presses. Literacy among merchants explodes.", category: "society", impact: "world-changing", plausibility: 47 },
      { year: "c. 1300 CE", title: "The coal question", description: "Deforestation around industrial cities forces a turn to coal. Smog and labor revolts reshape the politics of the Eastern Empire.", category: "environment", impact: "major", plausibility: 55 },
      { year: "c. 1500 CE", title: "Electric philosophers", description: "Natural philosophers in Alexandria build on Thales' amber experiments and produce the first batteries and telegraph lines.", category: "science", impact: "world-changing", plausibility: 38 },
    ],
    worldToday: [
      { aspect: "Technology", real: "Industrialization began in 18th-century Britain.", alternate: "Industry is roughly 1,000 years older; space flight is centuries old." },
      { aspect: "Geopolitics", real: "A post-Roman patchwork of nation-states.", alternate: "A long-lived Eastern Roman successor state anchors the Mediterranean." },
      { aspect: "Knowledge", real: "Most ancient texts are lost; we know many only by title.", alternate: "Classical literature survives almost whole and is still taught in the original." },
      { aspect: "Climate", real: "Industrial warming became a crisis in the 20th century.", alternate: "Centuries of early coal use forced climate politics in the medieval era." },
    ],
  };
}

export async function demoBranch(
  req: { twist?: string; path: { year: string; title: string }[] },
  onThinking: (d: string) => void,
  signal: AbortSignal,
): Promise<BranchResult> {
  const fork = req.path[req.path.length - 1];
  await fakeThinking(
    [`**Forking after "${fork.title}".** ${req.twist ? `Applying the twist: ${req.twist}.` : "Choosing a different outcome."}`, "**Re-running the cascade.**"],
    onThinking,
    signal,
  );
  return {
    label: req.twist ? "The twist takes hold" : "A quieter path",
    outcome: "(Demo data) The world in this branch moves more slowly but with less upheaval than the original timeline.",
    events: [
      { year: `After ${fork.year}`, title: "The news travels slowly", description: "The fork's consequences take a generation to reach the provinces, which gives rivals time to adapt.", category: "society", impact: "minor", plausibility: 70 },
      { year: "A generation later", title: "A cautious council", description: "Reformers and traditionalists strike a compromise that keeps the new ideas but slows their spread.", category: "politics", impact: "major", plausibility: 62 },
      { year: "A century later", title: "The long equilibrium", description: "Stability lets trade networks deepen instead of fracturing, and the region becomes a center of scholarship.", category: "economy", impact: "major", plausibility: 55 },
    ],
  };
}
