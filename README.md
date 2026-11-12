# qutie-ticker

Prints GitHub Actions results on an HPRT Qutie Bluetooth label printer as
ticker tape, no phone app needed, and shows a build board on a Raspberry Pi
touchscreen.

```
 ✘ ATTICARC #142
 MAIN - CI - 2M13S
```

One strip per finished run, about 40 mm long. Tap a run on the touchscreen to
reprint it, or type a label to print.

> **Status: 0.1 skeleton.** Rendering, LZO framing, the command builders and
> the GitHub poller are written and tested. It hasn't printed on a real Qutie
> yet; see the open questions in [docs/design.md](docs/design.md).

## Quick start

```sh
deno task test                             # unit tests
deno task preview "HELLO" "WORLD"          # writes preview.pbm and preview.prn
cp config.example.json config.json         # list your repos
GITHUB_TOKEN=github_pat_... deno task start
```

Pi setup (Bluetooth pairing, RFCOMM binding, kiosk mode, systemd):
[docs/pi-setup.md](docs/pi-setup.md).

## How it works

- Polls the GitHub API for completed workflow runs (outbound HTTPS only).
- Renders two lines of 5x7 text rotated along the 12 mm tape.
- Wraps the bitmap in Qutie raster blocks (`1D 76 30 30` + LZO1X).
- Writes the bytes to `/dev/rfcomm0` (Bluetooth SPP).

Design notes and protocol details: [docs/design.md](docs/design.md).

## Tasks

| Task | What it does |
|---|---|
| `deno task start` | Poll, print and serve the board (tight Deno permissions) |
| `deno task dry` | Same, but print to `dry.prn` using `config.dry.json` |
| `deno task preview "a" "b"` | Render text to `preview.pbm` / `preview.prn` |
| `deno task test` | Unit tests |
| `deno task check` | Type check, lint, format check |

## Credits

The protocol comes from
[DoctorFrank28/qutie-windows](https://github.com/DoctorFrank28/qutie-windows)
(MIT). See also [H3adsho0ot/qutie-studio](https://github.com/H3adsho0ot/qutie-studio).

## Licence

MIT
