// A one-at-a-time print queue in front of a transport.

import { buildJob, type JobOptions } from "./protocol.ts";
import { renderLines, type RenderOptions } from "./render.ts";
import { FileTransport, RfcommTransport, type Transport } from "./transport.ts";

export function openTransport(spec: string): Transport {
  const [kind, path] = spec.split(/:(.*)/s);
  if (kind === "rfcomm") return new RfcommTransport(path || undefined);
  if (kind === "file") return new FileTransport(path || "out.prn");
  throw new Error(`Unknown printer "${spec}" (use rfcomm:/dev/rfcommN or file:path)`);
}

export class PrintQueue {
  private tail: Promise<void> = Promise.resolve();
  private spec: string;
  private render: RenderOptions;
  private job: JobOptions;
  constructor(spec: string, render: RenderOptions = {}, job: JobOptions = {}) {
    this.spec = spec;
    this.render = render;
    this.job = { feedAfter: 64, ...job };
  }

  /** Queues a strip; resolves once it has been sent. */
  print(lines: string[]): Promise<void> {
    const run = async () => {
      const bytes = buildJob(renderLines(lines, this.render), this.job);
      // A fresh link per strip: the printer powers itself off between builds.
      const t = openTransport(this.spec);
      try {
        await t.write(bytes);
      } finally {
        await t.close();
      }
    };
    const p = this.tail.then(run);
    this.tail = p.catch(() => {});
    return p;
  }
}
