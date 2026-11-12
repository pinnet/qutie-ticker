# qutie-ticker design notes

## Idea

Print GitHub Actions results on the PRT/HPRT Qutie label printer as ticker
tape, one strip per finished run, without the HerePrint phone app. A Raspberry
Pi 4 with the 7" touchscreen sits next to the printer, polls GitHub, prints,
and shows a build board.

## Hardware

| Part | Notes |
|---|---|
| HPRT Qutie (sold as "PRT Qutie") | Made by Xiamen Hanin (HPRT). 203 dpi, 96-dot / 12 mm head. The HPRT Q2 speaks the same protocol. |
| Raspberry Pi 4 + 7" touchscreen | Built-in Bluetooth 5.0 (classic + BLE), so no dongle. 800x480 screen. |

### Options considered

- **Proxmox VM with USB passthrough.** Works if the box has Bluetooth (the
  Intel Wi-Fi/BT card's internal USB cable plugged into a header, or a
  dongle). Ruled out for now: Bluetooth range means the server must be within
  a few metres of the printer, and it adds weight to the always-on box.
- **LXC container.** Bluetooth in LXC needs a privileged container plus host
  networking, and the host's `bluetoothd` grabs the adapter. Not worth it.
- **Pi next to the printer.** Chosen. Few watts, built-in Bluetooth, and the
  touchscreen is a free UI. It could also be the QDevice tiebreaker if the two
  Proxmox boxes are ever clustered.

## Architecture

```
GitHub API  <──HTTPS poll──  Pi 4 (Deno)  ──RFCOMM / SPP──>  Qutie
                              │
                              └── 127.0.0.1:8080 build board ── Chromium kiosk on 7" screen
```

- **Polling, not webhooks.** Outbound HTTPS only, so nothing is exposed via
  the home DDNS. ETags make unchanged polls free against the rate limit
  (5,000 requests/hour with a token). Seen run ids live in `state.json`, so
  runs that finished while the Pi was off still print; a fresh install skips
  history.
- **Ticker tape, not lines.** The head is only 12 mm across, so text runs
  *along* the tape: two lines at 3x scale of the 5x7 font fill it nicely.
  A typical strip (`✔ ATTICARC #142` / `MAIN - CI - 2M13S`) is about 39 mm.
- **Deno.** Fits the security model: the start task only grants
  `api.github.com`, `127.0.0.1:8080`, `GITHUB_TOKEN`, the project folder and
  `/dev/rfcomm0`. No Bluetooth API is needed, because the kernel's RFCOMM
  binding turns the printer into a device file.

### Modules

| File | Job |
|---|---|
| `src/font.ts` | 5x7 glyphs, upper case, plus ✔ and ✘ |
| `src/render.ts` | Text → 96-dot-wide 1-bit raster; PBM/ASCII previews |
| `src/lzo.ts` | LZO1X literal-only encoder + reference decoder |
| `src/protocol.ts` | Qutie commands and raster blocks |
| `src/transport.ts` | RFCOMM device file, or a file for dry runs |
| `src/printer.ts` | Serial print queue |
| `src/format.ts` | Workflow run → two tape lines |
| `src/github.ts` | Poller with ETags and backlog handling |
| `src/server.ts`, `src/board.html` | Touchscreen board: recent runs, tap to reprint, print a label |
| `src/main.ts` | Wiring |

## Protocol notes

From the README of [DoctorFrank28/qutie-windows](https://github.com/DoctorFrank28/qutie-windows)
(MIT). Their `src/qutie/protocol.py` is the detailed reference.

- **Transport:** Bluetooth classic SPP on RFCOMM channel 1, or BLE service
  `FF00` (write `FF02`, notify `FF01`, flow control `FF03`). Over BLE, send
  180-byte packets without waiting for acknowledgements, or the printer
  pauses between blocks and leaves gaps.
- **Handshake (optional):** `1B 1C "set mm" k1 k2`. If the printer replies
  `OK`, every later write is XORed with `k1 + k2`. We skip it.
- **Raster block:** `1D 76 30 30`, width in bytes (2), rows (2), LZO length
  (4), LZO1X-compressed data.
- **Gap label end:** `1D 66 nL nH` (label length in dots).
- **Feed:** `1B 1B 01 nL nH`.
- **Density:** `1D "setc" n`.
- **Auto power-off:** `1D "sett" nL nH` (seconds).
- **Status:** `1B 12 73` → 17 bytes; paper type 0 is continuous roll.
- **Info:** `1B 12 64` → 143 bytes.
- qutie-windows waits for a `dithering_finish` reply before closing the link.

### LZO

The firmware wants LZO1X. `lzo1xStore` writes a valid stream that is one
literal run plus the end marker, which is what real LZO produces for data it
can't compress. It's slightly bigger than the raw bitmap, which is fine at
12 bytes a row (a 40 mm strip is about 4 KB). The tests decode it with a port
of the reference decompressor.

## Open questions (check before the first real print)

1. **Byte order** of the width/rows/length fields: assumed little-endian.
   Confirm against `protocol.py`.
2. **Block size limit:** we send 128-row blocks. Check what qutie-windows uses.
3. **Start/end of job:** does the printer need anything before the first
   block, or a `dithering_finish` wait before closing? Without the wait the
   link may close mid-print.
4. **Density range** for `setc`.
5. **Orientation:** which way the text reads as the tape comes out. The
   `flip` setting mirrors it.
6. **Gap labels:** for die-cut rolls, send `1D 66` with the label length so
   each run gets its own sticker.

Quickest way to settle 1–3: run `deno task preview`, send `preview.prn` with
`cat preview.prn > /dev/rfcomm0`, and compare with qutie-windows' output for
the same bitmap.

## Ideas for later

- On failure, print the failed step's name and the last few log lines.
- QR code on the strip linking to the run.
- BLE transport (Web Bluetooth page, or a Deno FFI binding) for machines
  without RFCOMM.
- A real LZO matcher to cut transfer time.
- Watch every repo under an owner rather than a fixed list.
- Use the Pi as a Proxmox QDevice too.
