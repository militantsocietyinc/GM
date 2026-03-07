# Bantay Pilipinas (Philippine Monitor)

Real-time Philippine-focused intelligence dashboard — geopolitical monitoring, maritime domain awareness (West Philippine Sea), disaster tracking, economic intelligence, and local news aggregation.

## Stack

- **Frontend:** Vanilla TypeScript + Vite + deck.gl/MapLibre → Netlify
- **Backend:** Fastify (Node.js) + cron scrapers + WebSocket → Railway
- **Database:** Neon PostgreSQL (serverless Postgres)

## Development

```bash
npm install
npm run dev:all    # Frontend (localhost:5173) + Backend (localhost:3001)
```

## License

AGPL-3.0 — see [LICENSE](LICENSE) for details.

Forked from [World Monitor](https://github.com/koala73/worldmonitor) (AGPL-3.0, Copyright Elie Habib 2024-2026).
Copyright (C) 2026 Jun / Sage Global Solutions (Philippine Monitor modifications).
