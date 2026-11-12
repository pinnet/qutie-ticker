// HPRT Qutie / Q2 command builders.
//
// Source: the protocol notes in DoctorFrank28/qutie-windows (MIT), see
// docs/design.md. Multi-byte fields are assumed little-endian, as in ESC/POS;
// check that against their src/qutie/protocol.py before the first real print.

import { lzo1xStore } from "./lzo.ts";
import type { Raster } from "./render.ts";

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];

export const cmd = {
  /** Status query; the printer answers with 17 bytes. */
  status: () => Uint8Array.from([0x1b, 0x12, 0x73]),
  /** Info query; the printer answers with 143 bytes. */
  info: () => Uint8Array.from([0x1b, 0x12, 0x64]),
  /** Print density (darkness). Range not yet confirmed. */
  density: (n: number) => Uint8Array.from([0x1d, ...ascii("setc"), n & 0xff]),
  /** Auto power-off after `seconds`. */
  autoOff: (seconds: number) => Uint8Array.from([0x1d, ...ascii("sett"), ...u16(seconds)]),
  /** Feed `dots` rows of tape. */
  feed: (dots: number) => Uint8Array.from([0x1b, 0x1b, 0x01, ...u16(dots)]),
  /** Marks the end of a gap (die-cut) label `dots` long. */
  gapLabelEnd: (dots: number) => Uint8Array.from([0x1d, 0x66, ...u16(dots)]),
};

/** One `1D 76 30 30` raster block: width bytes, rows, LZO length, LZO data. */
export function rasterBlock(widthBytes: number, rows: number, raw: Uint8Array): Uint8Array {
  if (raw.length !== widthBytes * rows) throw new Error("rasterBlock: size mismatch");
  const lzo = lzo1xStore(raw);
  return Uint8Array.from([0x1d, 0x76, 0x30, 0x30, ...u16(widthBytes), ...u16(rows), ...u32(lzo.length), ...lzo]);
}

export interface JobOptions {
  density?: number;
  /** Rows per raster block. Smaller blocks keep each write short. */
  blockRows?: number;
  /** Tape to feed after the print so it clears the cutter, in dots. */
  feedAfter?: number;
}

/** Builds the complete byte stream for one print. */
export function buildJob(r: Raster, opts: JobOptions = {}): Uint8Array {
  const parts: Uint8Array[] = [];
  if (opts.density !== undefined) parts.push(cmd.density(opts.density));
  const blockRows = opts.blockRows ?? 128;
  for (let y = 0; y < r.rows; y += blockRows) {
    const rows = Math.min(blockRows, r.rows - y);
    const slice = r.data.subarray(y * r.widthBytes, (y + rows) * r.widthBytes);
    parts.push(rasterBlock(r.widthBytes, rows, slice));
  }
  if (opts.feedAfter) parts.push(cmd.feed(opts.feedAfter));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
