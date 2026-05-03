# @vendodev/connect-portal

[![CI](https://github.com/runvendo/connect-portal/actions/workflows/ci.yml/badge.svg)](https://github.com/runvendo/connect-portal/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@vendodev/connect-portal)](https://www.npmjs.com/package/@vendodev/connect-portal)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Embeddable React connection management UI for Vendo-powered apps.

> **Browser-only.** This package has no SSR helpers. All components and hooks rely on browser APIs (window, postMessage, EventSource). If you use Next.js or another SSR framework, render these components client-side only (e.g., `"use client"` directive or dynamic import with `ssr: false`).

## Requirements

- React 18+
- [`@vendodev/sdk`](https://www.npmjs.com/package/@vendodev/sdk) 0.1.0+ (peer dependency)
- Node 18+ (build/dev only)

## Install

```bash
npm install @vendodev/connect-portal
```

Then import the stylesheet once near your app root:

```ts
import "@vendodev/connect-portal/styles.css";
```

## Quick start

```tsx
import { VendoProvider, ConnectPortal } from "@vendodev/connect-portal";
import { createClient } from "@vendodev/sdk";

const client = createClient({ apiKey: "vendo_sk_..." });

export function App() {
  return (
    <VendoProvider client={client}>
      <ConnectPortal />
    </VendoProvider>
  );
}
```

That renders the full integration grid grouped by category with search. See [ConnectPortal props](#connectportal----full-grid-embed) for filtering and layout options.

### Just one card

```tsx
import { VendoProvider, ConnectionCard } from "@vendodev/connect-portal";

export function App() {
  return (
    <VendoProvider client={client}>
      <ConnectionCard slug="telegram" />
    </VendoProvider>
  );
}
```

`<ConnectionCard>` reads state from the provider and renders the correct CTA automatically:

| Connection status | Badge | Primary button |
|---|---|---|
| none / available | — | Connect |
| connecting | Connecting… + spinner | Cancel |
| pending_setup | Setup incomplete | Continue setup |
| connected | ● Connected | Manage |
| needs_reauth | ● Reauth needed | Reconnect + Manage |
| error | ● Error: reason | Retry + Manage |

## Components

### `<ConnectionCard slug>`

Full self-contained card. Optional props:

```tsx
<ConnectionCard
  slug="telegram"
  compact                          // 80px tall vs 120px default
  returnTo="/dashboard/connections"
  onConnected={(conn) => console.log("connected", conn)}
  onDisconnected={(conn) => console.log("disconnected", conn)}
  customLogo={<MyLogo />}
  className="my-card"
/>
```

### `<ConnectButton slug>`

Bare CTA — host owns the surrounding layout.

```tsx
<ConnectButton
  slug="telegram"
  returnTo="/dashboard"
  onConnected={(id) => console.log("connection id:", id)}
  onError={(err) => console.error(err)}
>
  Connect Telegram
</ConnectButton>
```

### `<ManageButton slug>`

Opens the hosted management dashboard in a popup.

```tsx
<ManageButton slug="telegram" returnTo="/dashboard" />
```

## Headless hooks

```tsx
const { connect, disconnect } = useConnect();

// Opens a popup; falls back to full-page redirect if popup is blocked.
const result = await connect("telegram", { returnTo: "/dashboard" });
// result.status: "connected" | "cancelled" | "timeout" | "redirect_initiated"

// disconnect requires client.disconnect() to be implemented.
await disconnect("conn_id_123");
```

## `disconnect` support

`useConnect.disconnect(connectionId)` requires the client to implement a `disconnect` method:

```ts
interface ConnectPortalClient {
  disconnect?(connectionId: string): Promise<void>;
  // ...
}
```

If `disconnect` is not implemented on the client, `disconnect()` throws a clear error.

## Popup flow

1. `connect(slug)` calls `window.open(connectUrl, ...)`.
2. If `window.open` returns null (popup blocked), falls back to `window.location.assign(url)` and returns `{ status: "redirect_initiated" }`.
3. The popup runs the OAuth dance on `vendo.run`. On completion it posts:
   ```js
   window.opener.postMessage({ type: "vendo:connection-completed", slug, connectionId }, origin)
   ```
4. The bridge validates origin + slug strictly before resolving.

## `<ConnectPortal>` — full grid embed

Drop in the full integration grid with one component:

```tsx
<VendoProvider client={vendo}>
  <ConnectPortal />
</VendoProvider>
```

Optional props:

```tsx
<ConnectPortal
  categories={["messaging", "ai"]}   // only show these groups
  showSearch={false}                  // hide search input (default: true)
  layout="list"                       // "grid" (default) or "list"
  returnTo="/dashboard/connections"
  onConnected={(conn) => console.log("connected", conn)}
  onDisconnected={(conn) => console.log("disconnected", conn)}
/>
```

Behavior:
- Groups integrations by `category` with a section header per group.
- Within each group: non-available connections sort above available ones, then featured-first, then alphabetically.
- Search filters across slug, name, and description with a 150ms debounce.
- Empty search shows a friendly message with a Clear button.
- `layout="grid"` uses responsive CSS grid (`minmax(280px, 1fr)`); `layout="list"` uses compact single-column.
- Single column forced below 600px regardless of layout.

## Styling

All class names use `vendo-connect-*` / `vendo-portal__*` BEM prefix. Override any design token via CSS custom properties:

```css
:root {
  --vendo-color-brand: #6B4FFF;
  --vendo-color-bg: white;
  --vendo-color-bg-muted: #f8f8fa;
  --vendo-color-border: #e5e5ea;
  --vendo-color-text: #1a1a1a;
  --vendo-color-text-muted: #666;
  --vendo-color-success: #10b981;
  --vendo-color-warning: #f59e0b;
  --vendo-color-error: #ef4444;
  --vendo-radius: 12px;
  --vendo-radius-sm: 8px;
  --vendo-font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  --vendo-card-padding: 16px;
  --vendo-card-padding-compact: 12px;
  --vendo-spacing-xs: 4px;
  --vendo-spacing-sm: 8px;
  --vendo-spacing-md: 12px;
  --vendo-spacing-lg: 16px;
  --vendo-shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
}
```

## Testing helpers

The package ships a `/testing` sub-entry with mock utilities for unit tests. These are never included in production bundles.

```ts
import { MockClient, MockSseTransport } from "@vendodev/connect-portal/testing";
```

## CI

CI runs on every push and pull request via `.github/workflows/ci.yml` (lint, test, build, size gate, Storybook smoke). A tagged release (`v*`) triggers an additional `publish` job that runs `npm publish --access public`. Requires an `NPM_TOKEN` secret configured at [repo settings](https://github.com/runvendo/connect-portal/settings/secrets/actions).
