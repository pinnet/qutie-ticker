// Polls GitHub for finished workflow runs. Outbound HTTPS only: nothing on the
// home network is exposed, and runs that finished while the Pi was off are
// picked up on the next poll.

import type { WorkflowRun } from "./format.ts";

export interface PollerOptions {
  token?: string;
  /** "owner/repo" entries, e.g. "pinnet/AtticArc". */
  repos: string[];
  /** Run ids already printed (or deliberately skipped). */
  seen: Set<number>;
  /**
   * Skip whatever is already on GitHub at the first poll of each repo. Set this
   * when there is no saved state yet, so a fresh install doesn't print history.
   * With saved state, runs that finished while the Pi was off still print.
   */
  skipBacklog?: boolean;
  fetch?: typeof fetch;
}

export class Poller {
  private etags = new Map<string, string>();
  private primed = new Set<string>();
  private opts: PollerOptions;
  constructor(opts: PollerOptions) {
    this.opts = opts;
  }

  /** Returns newly completed runs, oldest first. */
  async poll(): Promise<WorkflowRun[]> {
    const fresh: WorkflowRun[] = [];
    for (const repo of this.opts.repos) {
      const runs = await this.fetchRuns(repo);
      if (runs === null) continue; // 304 Not Modified
      const firstLook = !!this.opts.skipBacklog && !this.primed.has(repo);
      this.primed.add(repo);
      for (const run of runs) {
        if (this.opts.seen.has(run.id)) continue;
        this.opts.seen.add(run.id);
        if (!firstLook) fresh.push(run);
      }
    }
    return fresh.sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at));
  }

  private async fetchRuns(repo: string): Promise<WorkflowRun[] | null> {
    const headers: Record<string, string> = {
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "qutie-ticker",
    };
    if (this.opts.token) headers["Authorization"] = `Bearer ${this.opts.token}`;
    const etag = this.etags.get(repo);
    if (etag) headers["If-None-Match"] = etag; // 304s don't count against the rate limit

    const url = `https://api.github.com/repos/${repo}/actions/runs?status=completed&per_page=20`;
    const res = await (this.opts.fetch ?? fetch)(url, { headers });
    if (res.status === 304) return null;
    if (!res.ok) throw new Error(`GitHub ${repo}: ${res.status} ${await res.text()}`);
    const newTag = res.headers.get("ETag");
    if (newTag) this.etags.set(repo, newTag);
    const body = await res.json() as { workflow_runs: WorkflowRun[] };
    return body.workflow_runs;
  }
}
