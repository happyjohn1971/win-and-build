# AGENTS.md

This guide is for OpenAI Codex/ChatGPT and Grok Bot working on this repo.

## Project

Win & Build is a UK LEGO prize competition site at winandbuild.co.uk.
It is in preview/demo stage and has no real payments yet. Real payments,
accounts, draws and postal entry are still to come.

The site is hosted on Render as the `win-and-build` Node web service in
Frankfurt, on the free plan. Its Render root directory is `server`; the build
command is `npm install` and the start command is `npm start`. Render
auto-deploys every commit to `main`.

## Repository layout

- `dist/` is the frontend. The main browser code is `dist/app.js` and the
  admin page is `dist/admin.html`, served at `/admin.html`.
- `server/` is the Node/Express server. Important files include `admin.js`,
  `app.js`, `index.js`, `store.js` and `seed-data.js`.
- `server/store.js` uses Postgres when `DATABASE_URL` is set; otherwise it
  stores competitions in a JSON file under the configured data directory.
- Run the server tests from `server/` with `npm test`.
- `render.yaml` contains the Render service configuration. Do not commit
  local data, secrets or `.env` files.

## Prize data and API

The competitions store, edited through the admin page, is the single source
of truth for prize data. Published public prizes are served by:

- `GET /api/prizes` — public prize data, with correct answers removed.
- `POST /api/prizes/:id/check-answer` — checks one submitted answer.
- `GET /api/prizes/:id/image` — serves an uploaded prize image.

The separate SwiftUI iPhone app reads `GET /api/prizes`. Do not change that
JSON shape without calling it out clearly in the pull request.

## Working rules

- Never push directly to `main`. Start from the latest `origin/main`, create
  a branch, and open a pull request with a plain-English description.
- Run `npm test` in `server/` before opening a pull request.
- Keep changes small and focused, and explain tests in the pull request.
- Never expose correct answers in public responses.
- Never commit secrets or `.env` files.
- Do not change Auth0 configuration, Render plans or Render environment
  variables.
- John Cowling owns the project and merges pull requests.
