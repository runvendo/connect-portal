// Provider + context
/** Root provider. Wrap your app (or the relevant subtree) once. Accepts a ConnectPortalClient. */
export { VendoProvider } from "./VendoProvider.js";
export { PortalContext, VendoProviderMissingError } from "./context.js";
// PortalContextValue is intentionally not re-exported — it exposes internal fields
// (_connectUrl, _baseUrl, _disconnect, _refetchConnection) that are not part of the
// public surface. Import from "./context.js" if you need it inside this package.
export type { PortalState } from "./context.js";
export type { ConnectPortalClient } from "./client.js";

// Headless hooks — use these to build your own UI
/** Returns the list of all connections from the nearest VendoProvider. */
export { useConnections } from "./hooks/useConnections.js";
/** Returns a single connection by integration slug, or undefined while loading. */
export { useConnection } from "./hooks/useConnection.js";
/** Returns connect() and disconnect() actions for managing connections via popup or redirect. */
export { useConnect } from "./hooks/useConnect.js";
export type { ConnectResult } from "./hooks/useConnect.js";
/** Returns billing balance and spend-cap state from the nearest VendoProvider. */
export { useBilling } from "./hooks/useBilling.js";
/** Returns the list of available integrations from the nearest VendoProvider. */
export { useIntegrations } from "./hooks/useIntegrations.js";

// State-aware components — drop-in connection management UI
/** Full grid/list of all integration cards with search, grouping, and theming. */
export { ConnectPortal } from "./components/ConnectPortal.js";
export type { ConnectPortalProps, Category, Theme } from "./components/ConnectPortal.js";
/** State-aware card that renders the correct CTA for each connection status. */
export { ConnectionCard } from "./components/ConnectionCard.js";
/** Bare connect CTA — use inside onboarding flows or deploy modals. */
export { ConnectButton } from "./components/ConnectButton.js";
/** Opens the hosted management dashboard for a connected integration. */
export { ManageButton } from "./components/ManageButton.js";

// Popup primitives — for advanced/custom connect flows
/** Imperative hook for the popup handshake — use when you need custom popup lifecycle control. */
export { usePopupConnect } from "./popup/usePopupConnect.js";
export type { PopupConnectResult } from "./popup/usePopupConnect.js";
export { expectedOrigin, validateMessage, subscribe } from "./popup/postMessageBridge.js";

// Error classes
export { OriginMismatchError, PopupClosedError, ConnectTimeoutError } from "./popup/errors.js";

// SSE types
export type { SseEvent, SseTransport, SseConnection } from "./sse/types.js";
