# Raspberry Pi 4 setup

**Raspberry Pi OS (64-bit, with desktop)** and the official 7" touchscreen.
The desktop image makes it easy for the screen to show both the build board
and Grafana dashboards from the home network. Steps 1–4 work the same on Lite
if you'd rather go headless; step 5 covers both.

## 1. Deno

```sh
curl -fsSL https://deno.land/install.sh | sh
```

## 2. Pair the printer and bind RFCOMM

Switch the Qutie on, then:

```sh
bluetoothctl
  power on
  scan on            # look for "Qutie-XXXX" and note its MAC
  pair  AA:BB:CC:DD:EE:FF
  trust AA:BB:CC:DD:EE:FF
  quit
sudo rfcomm bind 0 AA:BB:CC:DD:EE:FF 1   # creates /dev/rfcomm0 (SPP channel 1)
```

`rfcomm` comes from the `bluez` package. If it's missing on your release, it
may be in `bluez-deprecated-tools`.

To make the binding survive a reboot, install `deploy/rfcomm-qutie.service`
after putting the printer's MAC in it:

```sh
sudo cp deploy/rfcomm-qutie.service /etc/systemd/system/
sudo systemctl enable --now rfcomm-qutie
```

Let your user write to the device:

```sh
sudo usermod -aG dialout $USER   # log out and in again
```

## 3. First print, without GitHub

```sh
deno task preview "HELLO" "QUTIE"
cat preview.prn > /dev/rfcomm0
```

If the text comes out mirrored or upside down, set `"flip": true` in
`config.json`.

## 4. Configure and run

```sh
cp config.example.json config.json   # edit the repo list
export GITHUB_TOKEN=github_pat_...   # fine-grained, read-only "Actions" on the chosen repos
deno task start
```

For a run without the printer, `deno task dry` writes to `dry.prn` instead.

Install `deploy/qutie-ticker.service` to run it at boot. Put the token in
`/etc/qutie-ticker.env` as `GITHUB_TOKEN=...` (mode 600).

## 5. Touchscreen kiosk

### Desktop image (default)

Open the board and a Grafana dashboard full-screen at login (labwc):

```sh
mkdir -p ~/.config/labwc
cat >> ~/.config/labwc/autostart <<'AUTOSTART'
chromium --kiosk --noerrdialogs --disable-infobars \
  http://127.0.0.1:8080 \
  "http://grafana.local:3000/d/<dashboard-uid>?kiosk" &
AUTOSTART
```

- `?kiosk` hides Grafana's menus. Give the Pi a Grafana service account
  token, or enable anonymous Viewer access, so it never sits at a login page.
- To rotate between the two tabs, use a tab-cycling Chromium extension, or a
  small `wtype -M ctrl -k Tab` loop in a user systemd timer.

### Lite alternative

Lite has no desktop. `cage` runs one app full-screen with nothing around it:

```sh
sudo apt install cage chromium
cage -- chromium --kiosk --noerrdialogs --disable-infobars http://127.0.0.1:8080
```

Start it from a systemd service or autologin on tty1.
