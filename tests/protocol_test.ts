import { assertEquals } from "@std/assert";
import { buildJob, cmd, rasterBlock } from "../src/protocol.ts";
import { lzo1xDecompress } from "../src/lzo.ts";
import { renderLines, ROW_BYTES } from "../src/render.ts";

const le16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const le32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** Splits a job back into raster blocks: [rows, decompressed data][]. */
function parseBlocks(job: Uint8Array): [number, Uint8Array][] {
  const out: [number, Uint8Array][] = [];
  let o = 0;
  while (o < job.length) {
    if (job[o] === 0x1d && job[o + 1] === 0x76 && job[o + 2] === 0x30 && job[o + 3] === 0x30) {
      const rows = le16(job, o + 6);
      const len = le32(job, o + 8);
      out.push([rows, lzo1xDecompress(job.subarray(o + 12, o + 12 + len))]);
      o += 12 + len;
    } else {
      o++; // skip other commands
    }
  }
  return out;
}

Deno.test("simple commands", () => {
  assertEquals([...cmd.status()], [0x1b, 0x12, 0x73]);
  assertEquals([...cmd.feed(0x0140)], [0x1b, 0x1b, 0x01, 0x40, 0x01]);
  assertEquals([...cmd.density(3)], [0x1d, 0x73, 0x65, 0x74, 0x63, 3]);
});

Deno.test("raster block header", () => {
  const raw = new Uint8Array(ROW_BYTES * 2).fill(0xff);
  const b = rasterBlock(ROW_BYTES, 2, raw);
  assertEquals([...b.subarray(0, 4)], [0x1d, 0x76, 0x30, 0x30]);
  assertEquals(le16(b, 4), ROW_BYTES);
  assertEquals(le16(b, 6), 2);
  assertEquals(le32(b, 8), b.length - 12);
});

Deno.test("a job splits into blocks that reassemble to the raster", () => {
  const r = renderLines(["✔ QUTIE-TICKER #1", "MAIN - CI - 1M05S"]);
  const job = buildJob(r, { blockRows: 100, feedAfter: 64, density: 2 });
  const blocks = parseBlocks(job);
  assertEquals(blocks.length, Math.ceil(r.rows / 100));
  assertEquals(blocks.reduce((n, [rows]) => n + rows, 0), r.rows);
  const joined = new Uint8Array(r.data.length);
  let o = 0;
  for (const [, data] of blocks) {
    joined.set(data, o);
    o += data.length;
  }
  assertEquals(joined, r.data);
  assertEquals([...job.subarray(-5)], [...cmd.feed(64)]);
});
