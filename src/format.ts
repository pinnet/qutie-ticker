// Turns a GitHub Actions workflow run into the two lines printed on the tape.

/** The fields we use from GET /repos/{owner}/{repo}/actions/runs. */
export interface WorkflowRun {
  id: number;
  name: string | null;
  run_number: number;
  head_branch: string | null;
  status: string | null;
  conclusion: string | null;
  run_started_at?: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  repository: { name: string; full_name: string };
}

const MARK: Record<string, string> = {
  success: "✔",
  failure: "✘",
  timed_out: "✘",
  startup_failure: "✘",
  cancelled: "-",
  skipped: "-",
  neutral: "-",
  action_required: "!",
};

export function mark(conclusion: string | null): string {
  return MARK[conclusion ?? ""] ?? "?";
}

/** "2M13S", "45S", "1H02M". */
export function duration(fromIso: string, toIso: string): string {
  const s = Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}H${String(m).padStart(2, "0")}M`;
  if (m) return `${m}M${String(sec).padStart(2, "0")}S`;
  return `${sec}S`;
}

/** Line 1: mark, repo and run number. Line 2: branch, workflow and duration. */
export function runLines(run: WorkflowRun, maxLen = 40): string[] {
  const start = run.run_started_at ?? run.created_at;
  const line1 = `${mark(run.conclusion)} ${run.repository.name} #${run.run_number}`;
  const line2 = [run.head_branch ?? "", run.name ?? "", duration(start, run.updated_at)]
    .filter(Boolean)
    .join(" - ");
  return [line1, line2].map((l) => clip(l.toUpperCase(), maxLen));
}

function clip(s: string, n: number): string {
  const chars = [...s];
  return chars.length <= n ? s : chars.slice(0, n - 1).join("") + "*";
}
