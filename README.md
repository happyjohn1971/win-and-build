# Win & Build

Prize competition website for building-set fans.

This repository contains the website, server, and Render deployment configuration.

## Prize feed

Published competitions are the single source of truth for the website and the iPhone app.

- `GET /api/prizes` — published competitions without correct answers (CORS `*`, cached 60s)
- `POST /api/prizes/:id/check-answer` — `{questionIndex, answer}` → `{correct}`
- `GET /api/prizes/:id/image` — serves uploaded `data:` images; HTTPS image URLs (e.g. the seeded LEGO artwork) stay as absolute URLs in the feed so payloads stay small

## Storage

Set `DATABASE_URL` to use Postgres (table created automatically). Without it, competitions are stored in `competitions.json` under `ADMIN_DATA_DIR` (default `server/data/`). On Render’s free web plan the filesystem is ephemeral — create a Postgres database and set its internal URL as `DATABASE_URL` so admin edits survive restarts.
