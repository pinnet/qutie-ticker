// Minimal LZO1X support for the Qutie raster blocks.
//
// `lzo1xStore` emits a valid LZO1X stream made of one literal run and the
// end-of-stream marker: what lzo1x_1_compress produces for incompressible
// input. Any standard LZO1X decompressor (as in the printer firmware) accepts
// it. It does not shrink the data, which is fine for a 12-byte-wide head; a
// real matcher can replace it later without touching callers.
//
// `lzo1xDecompress` is a straight port of the reference decoder, used by the
// tests to prove the encoder's output and to check captures from the app.

/** Encodes `src` as an uncompressed (literal-only) LZO1X stream. */
export function lzo1xStore(src: Uint8Array): Uint8Array {
  const t = src.length;
  const head: number[] = [];
  if (t > 0) {
    if (t <= 238) {
      head.push(17 + t); // short first literal run
    } else {
      // long run: 0, then (t - 18) as 255-steps of zero bytes plus a remainder
      let tt = t - 18;
      head.push(0);
      while (tt > 255) {
        tt -= 255;
        head.push(0);
      }
      head.push(tt);
    }
  }
  const out = new Uint8Array(head.length + t + 3);
  out.set(head, 0);
  out.set(src, head.length);
  out.set([0x11, 0x00, 0x00], head.length + t); // M4 marker, distance 0 = EOF
  return out;
}

/** Reference LZO1X decompressor (safe variant). Throws on malformed input. */
export function lzo1xDecompress(src: Uint8Array): Uint8Array {
  const out: number[] = [];
  let ip = 0;
  const byte = () => {
    if (ip >= src.length) throw new Error("lzo: input overrun");
    return src[ip++];
  };
  const ext = (base: number) => {
    let n = 0;
    let b: number;
    while ((b = byte()) === 0) n += 255;
    return base + n + b;
  };
  const literals = (n: number) => {
    for (let i = 0; i < n; i++) out.push(byte());
  };
  const copyMatch = (dist: number, len: number) => {
    let p = out.length - dist;
    if (p < 0) throw new Error("lzo: lookbehind overrun");
    for (let i = 0; i < len; i++) out.push(out[p++]);
  };

  let state = 0;
  let t = byte();
  if (t > 17) {
    t -= 17;
    literals(t);
    state = t < 4 ? t : 4;
    t = byte();
  }

  for (;;) {
    let next: number;
    if (t < 16) {
      if (state === 0) {
        const len = (t === 0 ? ext(15) : t) + 3;
        literals(len);
        state = 4;
        t = byte();
        continue;
      } else if (state !== 4) {
        next = t & 3;
        copyMatch(1 + (t >> 2) + (byte() << 2), 2);
      } else {
        next = t & 3;
        copyMatch(1 + 0x0800 + (t >> 2) + (byte() << 2), 3);
      }
    } else if (t >= 64) {
      next = t & 3;
      const dist = 1 + ((t >> 2) & 7) + (byte() << 3);
      copyMatch(dist, (t >> 5) + 1);
    } else if (t >= 32) {
      const len = ((t & 31) === 0 ? ext(31) : t & 31) + 2;
      const le = byte() | (byte() << 8);
      next = le & 3;
      copyMatch(1 + (le >> 2), len);
    } else {
      const high = (t & 8) << 11;
      const len = ((t & 7) === 0 ? ext(7) : t & 7) + 2;
      const le = byte() | (byte() << 8);
      next = le & 3;
      const dist = high + (le >> 2);
      if (dist === 0) break; // end of stream
      copyMatch(dist + 0x4000, len);
    }
    literals(next);
    state = next;
    t = byte();
  }
  return Uint8Array.from(out);
}
