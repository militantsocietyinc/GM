# Cloud API Access and Request Authentication

## Overview

World Monitor desktop uses a **local-first** architecture. API requests go to the local sidecar first, and some paths can fall back to the Vercel deployment if the local route is unavailable.

Two different authentication layers are involved:

- **Local sidecar access** uses the per-session `LOCAL_API_TOKEN` bearer token.
- **Cloud API access** uses origin checks and optional `X-WorldMonitor-Key` validation in `api/_api-key.js`.

## Architecture

```
Desktop App                          Cloud (Vercel)
┌──────────────────┐                ┌──────────────────────┐
│ fetch('/api/...')│                │ api/[domain]/v1/[rpc]│
│        │         │                │        │              │
│ ┌──────▼───────┐ │                │ ┌──────▼───────┐      │
│ │ sidecar try  │ │                │ │ validateApiKey│      │
│ │ (local-first)│ │                │ │ (origin-aware)│      │
│ └──────┬───────┘ │                │ └──────┬───────┘      │
│   fail │         │   fallback     │   pass/fail           │
│ ┌──────▼───────┐ │──────────────► │ ┌──────────────┐      │
│ │  cloud fetch │ │                │ │ route handler │      │
│ └──────────────┘ │                │ └──────────────┘      │
└──────────────────┘                └──────────────────────┘
```

## Cloud Origin-Based Access Control

`api/_api-key.js` (`validateApiKey`) controls access:

- **Desktop origins** (`tauri.localhost`, `tauri://`, `asset://`) — a `X-WorldMonitor-Key` header is required
- **Trusted web origins** (`worldmonitor.app`, approved Vercel previews, localhost in non-production) — allowed without a key
- **Unknown origins with a key** — allowed only if the key matches `WORLDMONITOR_VALID_KEYS`
- **Unknown origins without a key** — rejected

`WORLDMONITOR_VALID_KEYS` is optional. When it is set, the cloud gateway validates `X-WorldMonitor-Key` against that allowlist.

## Desktop fallback behavior

The packaged desktop app normally talks to the local sidecar, not directly to the cloud gateway.

- Local renderer → sidecar calls use `Authorization: Bearer <LOCAL_API_TOKEN>`.
- Sidecar → cloud proxy calls strip desktop-origin headers before forwarding.
- If a desktop renderer is configured to call cloud endpoints directly, `validateApiKey` will treat that request as desktop-origin traffic and require `X-WorldMonitor-Key`.

For that reason, deployment guidance should not describe cloud fallback as “anonymous desktop access.” It is accurate only for trusted browser origins or for sidecar-proxied requests that do not present a desktop origin to the cloud gateway.

## Relevant Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `WORLDMONITOR_VALID_KEYS` | Optional comma-separated allowlist for `X-WorldMonitor-Key` | No |
| `CONVEX_URL` | Convex deployment URL | No (optional, for future use) |

## Files Reference

| File | Role |
|------|------|
| `src/services/runtime.ts` | Client-side sidecar-first fetch patch; direct cloud fallback path when configured |
| `src-tauri/sidecar/local-api-server.mjs` | Local sidecar auth gate and sidecar-to-cloud proxying |
| `api/_api-key.js` | Server-side cloud access control for browser/direct requests |
| `api/[domain]/v1/[rpc].ts` | Sebuf gateway entrypoint that calls `validateApiKey` |
| `api/_cors.js` | CORS headers |
