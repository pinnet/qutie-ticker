import { assertEquals, assertThrows } from "@std/assert";
import { lzo1xDecompress, lzo1xStore } from "../src/lzo.ts";

function bytes(n: number, seed = 1): Uint8Array {
  const b = new Uint8Array(n);
  let x = seed;
  for (let i = 0; i < n; i++) b[i] = (x = (x * 1103515245 + 12345) >>> 0) >>> 24;
  return b;
}

Deno.test("store stream round-trips at the short/long run boundary and beyond", () => {
  for (const n of [1, 3, 4, 12, 18, 19, 237, 238, 239, 240, 255 + 18, 256 + 18, 510 + 18, 1536, 12 * 128]) {
    const src = bytes(n, n);
    assertEquals(lzo1xDecompress(lzo1xStore(src)), src, `length ${n}`);
  }
});

Deno.test("store stream has the expected framing", () => {
  assertEquals([...lzo1xStore(Uint8Array.from([0xaa, 0xbb]))], [19, 0xaa, 0xbb, 0x11, 0, 0]);
  const long = lzo1xStore(new Uint8Array(250));
  assertEquals([...long.subarray(0, 2)], [0, 250 - 18]);
  assertEquals([...long.subarray(-3)], [0x11, 0, 0]);
});

Deno.test("decoder handles real back-references", () => {
  // 3 literals "abc", then an M2 match of 8 bytes (M2's maximum) at distance 3.
  // M2: t = ((len - 1) << 5) | ((dist - 1) & 7) << 2, then (dist - 1) >> 3.
  const stream = Uint8Array.from([17 + 3, 0x61, 0x62, 0x63, ((8 - 1) << 5) | ((3 - 1) << 2), 0, 0x11, 0, 0]);
  assertEquals(new TextDecoder().decode(lzo1xDecompress(stream)), "abcabcabcab");
});

Deno.test("decoder rejects truncated input", () => {
  const ok = lzo1xStore(bytes(50));
  assertThrows(() => lzo1xDecompress(ok.subarray(0, ok.length - 2)));
});
