import { assertEquals } from "@std/assert";
import { Poller } from "../src/github.ts";
import type { WorkflowRun } from "../src/format.ts";

const mk = (id: number, updated: string): WorkflowRun => ({
  id,
  name: "CI",
  run_number: id,
  head_branch: "main",
  status: "completed",
  conclusion: "success",
  created_at: updated,
  updated_at: updated,
  html_url: "",
  repository: { name: "r", full_name: "o/r" },
});

/** A fake GitHub that serves `pages` in turn and honours ETags. */
function fakeFetch(pages: WorkflowRun[][]) {
  let i = 0;
  const calls: (string | null)[] = [];
  const f = (_url: string | URL | Request, init?: RequestInit) => {
    const sent = (init?.headers as Record<string, string>)["If-None-Match"] ?? null;
    calls.push(sent);
    const page = pages[Math.min(i, pages.length - 1)];
    const tag = `"p${Math.min(i, pages.length - 1)}"`;
    i++;
    if (sent === tag) return Promise.resolve(new Response(null, { status: 304 }));
    return Promise.resolve(Response.json({ workflow_runs: page }, { headers: { ETag: tag } }));
  };
  return { f: f as typeof fetch, calls };
}

Deno.test("skipBacklog ignores runs present at the first poll", async () => {
  const { f } = fakeFetch([[mk(1, "2026-11-12T10:00:00Z")], [mk(2, "2026-11-12T11:00:00Z"), mk(1, "2026-11-12T10:00:00Z")]]);
  const p = new Poller({ repos: ["o/r"], seen: new Set(), skipBacklog: true, fetch: f });
  assertEquals(await p.poll(), []);
  assertEquals((await p.poll()).map((r) => r.id), [2]);
});

Deno.test("with saved state, runs missed while offline are printed oldest first", async () => {
  const { f } = fakeFetch([[mk(5, "2026-11-12T12:00:00Z"), mk(4, "2026-11-12T11:00:00Z"), mk(3, "2026-11-12T10:00:00Z")]]);
  const p = new Poller({ repos: ["o/r"], seen: new Set([3]), fetch: f });
  assertEquals((await p.poll()).map((r) => r.id), [4, 5]);
  assertEquals((await p.poll()).map((r) => r.id), []);
});

Deno.test("sends the ETag back and treats 304 as no news", async () => {
  const { f, calls } = fakeFetch([[mk(1, "2026-11-12T10:00:00Z")]]);
  const p = new Poller({ repos: ["o/r"], seen: new Set(), fetch: f });
  await p.poll();
  assertEquals(await p.poll(), []);
  assertEquals(calls, [null, '"p0"']);
});
