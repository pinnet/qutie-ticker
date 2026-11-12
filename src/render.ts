// Renders lines of text as a ticker-tape bitmap for the Qutie.
//
// The print head is 96 dots across the tape, so text runs *along* the tape:
// we lay the text out on a canvas 96 dots tall and N dots long, then emit one
// printer row per canvas column.

import { GLYPH_H, GLYPH_W, glyph } from "./font.ts";

export const HEAD_DOTS = 96; // 12 mm at 203 dpi
export const ROW_BYTES = HEAD_DOTS / 8;

/** 1-bit image in printer order: `rows` rows of ROW_BYTES, MSB = dot 0, 1 = black. */
export interface Raster {
  widthBytes: number;
  rows: number;
  data: Uint8Array;
}

export interface RenderOptions {
  /** Pixel scale for the 5x7 font (2 → 10x14 dots per glyph). */
  scale?: number;
  /** Blank rows (along the tape) before and after the text. 8 rows = 1 mm. */
  margin?: number;
  /** Which way the text reads as the tape comes out. Flip if it prints upside down. */
  flip?: boolean;
}

/** Largest scale at which `lineCount` lines fit across the head. */
export function maxScale(lineCount: number): number {
  // Each line is 7 dots tall plus 1 dot of leading, minus the trailing leading.
  return Math.max(1, Math.floor(HEAD_DOTS / (lineCount * (GLYPH_H + 1) - 1)));
}

export function renderLines(lines: string[], opts: RenderOptions = {}): Raster {
  if (lines.length === 0) throw new Error("renderLines: no lines");
  const scale = opts.scale ?? Math.min(4, maxScale(lines.length));
  const margin = opts.margin ?? 16;
  const advance = (GLYPH_W + 1) * scale;
  const lineH = (GLYPH_H + 1) * scale;
  const textH = lines.length * lineH - scale;
  if (textH > HEAD_DOTS) {
    throw new Error(`renderLines: ${lines.length} lines at scale ${scale} need ${textH} dots, head has ${HEAD_DOTS}`);
  }
  const top = Math.floor((HEAD_DOTS - textH) / 2);
  const longest = Math.max(...lines.map((l) => [...l].length));
  const textLen = longest * advance - scale;
  const rows = margin * 2 + Math.max(textLen, 0);

  const data = new Uint8Array(rows * ROW_BYTES);
  const set = (along: number, across: number) => {
    const dot = opts.flip ? HEAD_DOTS - 1 - across : across;
    data[along * ROW_BYTES + (dot >> 3)] |= 0x80 >> (dot & 7);
  };

  lines.forEach((line, li) => {
    [...line].forEach((ch, ci) => {
      const g = glyph(ch);
      for (let gy = 0; gy < GLYPH_H; gy++) {
        for (let gx = 0; gx < GLYPH_W; gx++) {
          if (!g[gy][gx]) continue;
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const along = margin + ci * advance + gx * scale + sx;
              // Text rows run across the head; flip so the top of the text
              // is on the far edge unless the caller asks otherwise.
              const across = HEAD_DOTS - 1 - (top + li * lineH + gy * scale + sy);
              set(along, across);
            }
          }
        }
      }
    });
  });

  return { widthBytes: ROW_BYTES, rows, data };
}

/** Binary PBM (P4) of the raster as it comes out of the printer, for previews. */
export function toPbm(r: Raster): Uint8Array {
  const header = new TextEncoder().encode(`P4\n${r.widthBytes * 8} ${r.rows}\n`);
  const out = new Uint8Array(header.length + r.data.length);
  out.set(header);
  out.set(r.data, header.length);
  return out;
}

/** ASCII-art dump, handy in tests and on a terminal. */
export function toAscii(r: Raster): string {
  const out: string[] = [];
  for (let y = 0; y < r.rows; y++) {
    let s = "";
    for (let x = 0; x < r.widthBytes * 8; x++) {
      s += r.data[y * r.widthBytes + (x >> 3)] & (0x80 >> (x & 7)) ? "#" : ".";
    }
    out.push(s);
  }
  return out.join("\n");
}
