# Architecture

See CLAUDE.md for full architecture documentation.

## Deployment Stack

| Layer | Service | Purpose |
|---|---|---|
| Frontend | Netlify | Static site hosting, CDN |
| Backend | Railway | Persistent Node.js server (Fastify) |
| Database | Neon PostgreSQL | Time-series data, news, vessel tracks |

## Data Flow

```
External Sources → Server Scrapers → Neon PostgreSQL → API Routes → Frontend
AISStream WebSocket → Server → WebSocket Relay → Frontend Map
```
