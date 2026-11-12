import { assertEquals } from "@std/assert";
import { duration, mark, runLines, type WorkflowRun } from "../src/format.ts";

const run = (over: Partial<WorkflowRun> = {}): WorkflowRun => ({
  id: 1,
  name: "CI",
  run_number: 142,
  head_branch: "main",
  status: "completed",
  conclusion: "success",
  run_started_at: "2026-11-12T20:00:00Z",
  created_at: "2026-11-12T19:59:50Z",
  updated_at: "2026-11-12T20:02:13Z",
  html_url: "https://github.com/pinnet/AtticArc/actions/runs/1",
  repository: { name: "AtticArc", full_name: "pinnet/AtticArc" },
  ...over,
});

Deno.test("durations", () => {
  assertEquals(duration("2026-01-01T00:00:00Z", "2026-01-01T00:00:45Z"), "45S");
  assertEquals(duration("2026-01-01T00:00:00Z", "2026-01-01T00:02:13Z"), "2M13S");
  assertEquals(duration("2026-01-01T00:00:00Z", "2026-01-01T01:02:00Z"), "1H02M");
  assertEquals(duration("2026-01-01T00:01:00Z", "2026-01-01T00:00:00Z"), "0S");
});

Deno.test("marks", () => {
  assertEquals(mark("success"), "✔");
  assertEquals(mark("failure"), "✘");
  assertEquals(mark("cancelled"), "-");
  assertEquals(mark(null), "?");
});

Deno.test("run lines", () => {
  assertEquals(runLines(run()), ["✔ ATTICARC #142", "MAIN - CI - 2M13S"]);
  assertEquals(runLines(run({ conclusion: "failure", head_branch: null }))[1], "CI - 2M13S");
});

Deno.test("long lines are clipped", () => {
  const [l1] = runLines(run({ repository: { name: "a-very-long-repository-name", full_name: "x/y" } }), 16);
  assertEquals([...l1].length, 16);
  assertEquals(l1.endsWith("*"), true);
});
