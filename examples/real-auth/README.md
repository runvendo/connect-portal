# Real-auth playground

Local Vite app that renders this package's components against a **real** Vendo
backend, so you can iterate on `src/` and see the result with live data.

The vite config aliases `@vendodev/connect-portal` to `../../src/index.ts`, so
edits to the package source hot-reload here without a publish step.

## Setup

You need a real `vendo_sk_*` API key. The easiest source is `vendo dev --env`
in the vendo monorepo, which writes `.env.vendo-dev` containing
`VENDO_API_KEY=vendo_sk_...`.

```bash
cp .env.example .env.local
# then edit .env.local — paste your vendo_sk_... key
npm install
npm run dev
```

Open <http://localhost:5174>.

## What it renders

- `<ConnectPortal>` — the full grid against your real connections.
- `<ConnectionCard slug=…>` — single card. Override slug via `?card=slug`.
- `<ConnectButton slug=…>` — bare CTA. Override slug via `?button=slug`.

The popup connect flow opens `https://vendo.run/connect/<slug>` for real,
so connecting an integration here mutates real data on your tenant.

## Pointing at a non-prod backend

Set `VITE_VENDO_BASE_URL` in `.env.local`. Vite proxies `/api/*` and
`/connect/*` to that origin. Defaults to `https://vendo.run`. Use
`http://localhost:3000` to iterate against your local vendo web dev server.

## Why the proxy?

The browser can't call `https://vendo.run/api/*` directly from localhost —
CORS isn't enabled for arbitrary origins. So the playground sets `baseUrl` to
its own origin and Vite forwards `/api` server-to-server.
