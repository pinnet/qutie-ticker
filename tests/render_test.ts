import { assert, assertEquals, assertThrows } from "@std/assert";
import { HEAD_DOTS, maxScale, renderLines, ROW_BYTES, toAscii, toPbm } from "../src/render.ts";

const black = (data: Uint8Array) => data.reduce((n, b) => n + popcount(b), 0);
function popcount(b: number) {
  let n = 0;
  for (; b; b &= b - 1) n++;
  return n;
}

Deno.test("raster is head-wide and as long as the text plus margins", () => {
  const r = renderLines(["AB"], { scale: 2, margin: 10 });
  assertEquals(r.widthBytes, ROW_BYTES);
  // 2 glyphs * 6 * 2 - 2 trailing spacing = 22 rows of text
  assertEquals(r.rows, 10 + 22 + 10);
  assertEquals(r.data.length, r.rows * ROW_BYTES);
});

Deno.test("margins are blank and text is inked", () => {
  const r = renderLines(["HELLO"], { scale: 2, margin: 16 });
  assertEquals(black(r.data.subarray(0, 16 * ROW_BYTES)), 0);
  assertEquals(black(r.data.subarray((r.rows - 16) * ROW_BYTES)), 0);
  assert(black(r.data) > 0);
});

Deno.test("dot count matches glyph pixels times scale squared", () => {
  // "I" has 11 dots in the 5x7 font.
  assertEquals(black(renderLines(["I"], { scale: 3 }).data), 11 * 9);
});

Deno.test("flip mirrors across the head", () => {
  const a = toAscii(renderLines(["F"], { scale: 1, margin: 0 })).split("\n");
  const b = toAscii(renderLines(["F"], { scale: 1, margin: 0, flip: true })).split("\n");
  assertEquals(a.map((row) => [...row].reverse().join("")), b);
});

Deno.test("scale is limited by the head width", () => {
  assertEquals(maxScale(1), 13);
  assertEquals(maxScale(2), 6);
  assertThrows(() => renderLines(["A", "B"], { scale: 7 }));
  const two = renderLines(["A", "B"]);
  assert(two.rows > 0);
});

Deno.test("PBM header describes the raster", () => {
  const r = renderLines(["OK"]);
  const head = new TextDecoder().decode(toPbm(r).subarray(0, 20)).split("\n");
  assertEquals(head[0], "P4");
  assertEquals(head[1], `${HEAD_DOTS} ${r.rows}`);
});
