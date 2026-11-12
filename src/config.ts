// Settings come from config.json (see config.example.json); the GitHub token
// comes from the GITHUB_TOKEN environment variable so it never lands in git.

export interface Config {
  repos: string[];
  pollSeconds: number;
  /** "rfcomm:/dev/rfcomm0" to print, "file:out.prn" for a dry run. */
  printer: string;
  density?: number;
  flip?: boolean;
  /** Print successful runs too, or only failures. */
  printSuccess: boolean;
  statePath: string;
  /** Port for the touchscreen board. */
  uiPort: number;
}

const defaults: Config = {
  repos: [],
  pollSeconds: 60,
  printer: "rfcomm:/dev/rfcomm0",
  printSuccess: true,
  statePath: "state.json",
  uiPort: 8080,
};

export async function loadConfig(path = "config.json"): Promise<Config & { token?: string }> {
  const raw = JSON.parse(await Deno.readTextFile(path));
  const cfg = { ...defaults, ...raw } as Config;
  if (!cfg.repos.length) throw new Error(`${path}: "repos" is empty`);
  if (cfg.pollSeconds < 15) throw new Error(`${path}: pollSeconds below 15 will hit rate limits`);
  return { ...cfg, token: Deno.env.get("GITHUB_TOKEN") };
}

export async function loadSeen(path: string): Promise<Set<number> | null> {
  try {
    return new Set(JSON.parse(await Deno.readTextFile(path)).seen as number[]);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return null;
    throw e;
  }
}

/** Keeps the newest 500 ids; that is plenty to dedupe a 20-run page per repo. */
export async function saveSeen(path: string, seen: Set<number>): Promise<void> {
  const ids = [...seen].sort((a, b) => b - a).slice(0, 500);
  await Deno.writeTextFile(path, JSON.stringify({ seen: ids }));
}
