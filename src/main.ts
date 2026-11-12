// qutie-ticker: prints GitHub Actions results on an HPRT Qutie as ticker tape,
// and serves a build board for the Pi's touchscreen.

import { loadConfig, loadSeen, saveSeen } from "./config.ts";
import { runLines, type WorkflowRun } from "./format.ts";
import { Poller } from "./github.ts";
import { PrintQueue } from "./printer.ts";
import { serveBoard } from "./server.ts";

const cfg = await loadConfig(Deno.args[0] ?? "config.json");
const saved = await loadSeen(cfg.statePath);
const seen = saved ?? new Set<number>();
const poller = new Poller({ token: cfg.token, repos: cfg.repos, seen, skipBacklog: saved === null });
const queue = new PrintQueue(cfg.printer, { flip: cfg.flip }, { density: cfg.density });

/** Most recent runs, newest first, for the touchscreen board. */
const recent: WorkflowRun[] = [];

serveBoard(cfg.uiPort, {
  recent: () => recent,
  reprint: (id) => {
    const run = recent.find((r) => r.id === id);
    if (!run) return Promise.reject(new Error(`run ${id} not on the board`));
    return queue.print(runLines(run));
  },
  printText: (lines) => queue.print(lines),
});

console.log(`qutie-ticker: watching ${cfg.repos.join(", ")} every ${cfg.pollSeconds}s, printing to ${cfg.printer}`);

async function tick() {
  try {
    const runs = await poller.poll();
    for (const run of runs) {
      recent.unshift(run);
      recent.splice(50);
      const lines = runLines(run);
      console.log(lines.join("  |  "));
      if (cfg.printSuccess || run.conclusion !== "success") {
        await queue.print(lines).catch((e) => console.error("print failed:", e.message));
      }
    }
    await saveSeen(cfg.statePath, seen);
  } catch (e) {
    console.error("poll failed:", (e as Error).message);
  }
}

await tick();
setInterval(tick, cfg.pollSeconds * 1000);
