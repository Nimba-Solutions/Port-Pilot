# Port Pilot

**Free & open-source visual localhost port manager for Windows.**

See every listening port, what process owns it, and kill it with one click. No more `netstat | findstr` or "something is already using port 3000."

## Features

- **Live port table** — See all listening TCP ports with process name, PID, and address
- **One-click kill** — Stop any process directly from the dashboard
- **Open in browser** — Jump to `localhost:<port>` instantly
- **Smart hints** — Auto-detects common dev stacks (React, Vite, Django, PostgreSQL, etc.)
- **Pin ports** — Keep important ports at the top
- **Notes** — Label ports with custom notes (e.g. "My API server")
- **Search & filter** — Find by port number, process name, or note
- **Dev filter** — Show only common development ports
- **Auto-refresh** — Configurable refresh interval (default 3s)
- **System tray** — Runs in background with quick access
- **Copy URL** — One-click copy `http://localhost:<port>` to clipboard

## Download

Grab the latest portable `.exe` from [Releases](https://github.com/Nimba-Solutions/Port-Pilot/releases).

No installation required — just run it.

## Requirements

- Windows 10/11

## Build from source

```bash
npm install
npm run build
```

The portable `.exe` appears in `dist/`.

## Development

```bash
npm start
```

## How it works

Port Pilot queries Windows `Get-NetTCPConnection` via PowerShell to enumerate listening TCP connections, then resolves owning process info via `Get-Process`. Everything runs locally — no network calls, no telemetry.

## License

[BSL 1.1](LICENSE.md) — Converts to Apache 2.0 after four years per release.

**Author:** [Cloud Nimbus LLC](https://cloudnimbusllc.com)
