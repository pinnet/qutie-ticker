// Touchscreen build board: a single page plus a tiny JSON API, meant for
// Chromium in kiosk mode on the Pi's 7" screen (800x480).

import type { WorkflowRun } from "./format.ts";

export interface BoardHandlers {
  recent: () => WorkflowRun[];
  reprint: (runId: number) => Promise<void>;
  printText: (lines: string[]) => Promise<void>;
}

const page = await Deno.readTextFile(new URL("./board.html", import.meta.url));

export function serveBoard(port: number, h: BoardHandlers) {
  // Bound to localhost: the board is for the Pi's own screen.
  return Deno.serve({ port, hostname: "127.0.0.1" }, async (req) => {
    const url = new URL(req.url);
    try {
      if (req.method === "GET" && url.pathname === "/") {
        return new Response(page, { headers: { "content-type": "text/html; charset=utf-8" } });
      }
      if (req.method === "GET" && url.pathname === "/api/runs") {
        return Response.json(h.recent());
      }
      if (req.method === "POST" && url.pathname === "/api/reprint") {
        const { id } = await req.json();
        await h.reprint(Number(id));
        return Response.json({ ok: true });
      }
      if (req.method === "POST" && url.pathname === "/api/print") {
        const { lines } = await req.json();
        if (!Array.isArray(lines) || !lines.length || lines.length > 3) {
          return Response.json({ error: "lines: 1-3 strings" }, { status: 400 });
        }
        await h.printText(lines.map(String));
        return Response.json({ ok: true });
      }
      return new Response("Not found", { status: 404 });
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 500 });
    }
  });
}
