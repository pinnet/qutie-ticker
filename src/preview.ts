// Renders text to a PBM image (and optionally the printer byte stream) without
// touching Bluetooth. Usage:
//   deno task preview "✔ ATTICARC #142" "MAIN - BUILD - 2M13S"
// Writes preview.pbm (opens in GIMP, IrfanView, `display`, …) and preview.prn.

import { buildJob } from "./protocol.ts";
import { renderLines, toPbm } from "./render.ts";

const lines = Deno.args.length ? Deno.args : ["✔ QUTIE-TICKER #1", "MAIN - CI - 1M05S"];
const raster = renderLines(lines);
await Deno.writeFile("preview.pbm", toPbm(raster));
await Deno.writeFile("preview.prn", buildJob(raster, { feedAfter: 64 }));
console.log(`${raster.rows} rows (${(raster.rows / 8).toFixed(1)} mm) -> preview.pbm, preview.prn`);
