import React, { useMemo, useState, useEffect, useRef } from "react";
import type { Connection } from "@vendodev/sdk";
import { useIntegrations } from "../hooks/useIntegrations.js";
import { useConnections } from "../hooks/useConnections.js";
import { ConnectionCard } from "./ConnectionCard.js";

/** The `category` string union used to filter groups. Matches Integration.category. */
export type Category = string;

export interface ConnectPortalProps {
  /** Filter to these categories only. Default: show all groups. */
  categories?: Category[];
  /** Show the search input. Default: true. */
  showSearch?: boolean;
  /** Card layout. Default: "grid". */
  layout?: "grid" | "list";
  className?: string;
  /** Forwarded to each ConnectionCard. */
  onConnected?: (conn: Connection) => void;
  /** Forwarded to each ConnectionCard. */
  onDisconnected?: (conn: Connection) => void;
  /** Forwarded to each ConnectionCard. */
  returnTo?: string;
}

/** Non-available statuses — cards with these sort above "available" within each group. */
const NON_AVAILABLE_STATUSES = new Set([
  "connected",
  "needs_reauth",
  "error",
  "pending_setup",
  "connecting",
]);

/** Title-case a category string for display. */
function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Full grid/list of all integration cards, grouped by category with search.
 * Wrap in <VendoProvider> — reads integrations + connections from context.
 */
export function ConnectPortal({
  categories,
  showSearch = true,
  layout = "grid",
  className,
  onConnected,
  onDisconnected,
  returnTo,
}: ConnectPortalProps): React.ReactElement {
  const { integrations } = useIntegrations();
  const { connections } = useConnections();
  const [rawSearch, setRawSearch] = useState("");
  const [search, setSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref for returning focus to the search input after Clear is clicked.
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search input by 150ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(rawSearch), 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [rawSearch]);

  // Build the full slug set: catalog + any connected slugs not in catalog (defensive).
  const slugsFromCatalog = useMemo(
    () => new Map(integrations.map((i) => [i.slug, i])),
    [integrations],
  );

  const connectionBySlug = useMemo(
    () => new Map(connections.map((c) => [c.slug, c])),
    [connections],
  );

  // Union: catalog slugs + connection slugs not already in catalog
  const allSlugs = useMemo(() => {
    const set = new Set<string>(slugsFromCatalog.keys());
    for (const c of connections) set.add(c.slug);
    return Array.from(set);
  }, [slugsFromCatalog, connections]);

  // Group slugs by category — categoryFor logic inlined so deps are explicit.
  const grouped = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const slug of allSlugs) {
      const cat =
        slugsFromCatalog.get(slug)?.category ??
        connectionBySlug.get(slug)?.category ??
        "other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(slug);
    }
    return map;
  }, [allSlugs, slugsFromCatalog, connectionBySlug]);

  // Filter to requested categories
  const categoryKeys = useMemo(() => {
    const keys = Array.from(grouped.keys()).sort();
    return categories ? keys.filter((k) => categories.includes(k)) : keys;
  }, [grouped, categories]);

  // Build visible groups after search + category filter.
  // sortSlugs and matchesSearch are closures defined inside the memo so the
  // deps array only needs to list the values they actually close over.
  const lc = search.toLowerCase();
  const visibleGroups = useMemo(() => {
    function matchesSearch(slug: string): boolean {
      if (!lc) return true;
      const integration = slugsFromCatalog.get(slug);
      return (
        slug.toLowerCase().includes(lc) ||
        (integration?.name.toLowerCase().includes(lc) ?? false) ||
        (integration?.description.toLowerCase().includes(lc) ?? false)
      );
    }

    function sortSlugs(slugs: string[]): string[] {
      return [...slugs].sort((a, b) => {
        const connA = connectionBySlug.get(a);
        const connB = connectionBySlug.get(b);
        const statusA = connA?.status ?? "available";
        const statusB = connB?.status ?? "available";
        const nonAvailA = NON_AVAILABLE_STATUSES.has(statusA) ? 0 : 1;
        const nonAvailB = NON_AVAILABLE_STATUSES.has(statusB) ? 0 : 1;
        if (nonAvailA !== nonAvailB) return nonAvailA - nonAvailB;

        // Within the same availability tier, featured first then alphabetical
        const intA = slugsFromCatalog.get(a);
        const intB = slugsFromCatalog.get(b);
        const featA = intA?.featured ? 0 : 1;
        const featB = intB?.featured ? 0 : 1;
        if (featA !== featB) return featA - featB;

        const nameA = intA?.name ?? a;
        const nameB = intB?.name ?? b;
        return nameA.localeCompare(nameB);
      });
    }

    return categoryKeys
      .map((cat) => {
        const slugs = sortSlugs(
          (grouped.get(cat) ?? []).filter(matchesSearch),
        );
        return { cat, slugs };
      })
      .filter(({ slugs }) => slugs.length > 0);
  }, [categoryKeys, grouped, lc, slugsFromCatalog, connectionBySlug]);

  const isEmpty = visibleGroups.length === 0 && lc.length > 0;

  const rootClass = [
    "vendo-portal",
    `vendo-portal--${layout}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} role="region" aria-label="Vendo connections">
      {showSearch && (
        <div className="vendo-portal__search-wrap">
          <div className="vendo-portal__search-row">
            <input
              ref={inputRef}
              type="search"
              className="vendo-portal__search"
              placeholder="Search integrations…"
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              aria-label="Search integrations"
            />
            {rawSearch.length > 0 && (
              <button
                className="vendo-portal__search-clear"
                aria-label="Clear search"
                onClick={() => {
                  setRawSearch("");
                  setSearch("");
                  // Return focus to the input so keyboard users stay in flow.
                  inputRef.current?.focus();
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {isEmpty ? (
        <div className="vendo-portal__empty">
          {/* rawSearch (not the debounced value) reflects what the user typed right now. */}
          <span>No integrations match &ldquo;{rawSearch}&rdquo;</span>
          <button
            className="vendo-portal__clear-btn"
            onClick={() => {
              setRawSearch("");
              setSearch("");
              // Return focus to the input so keyboard users stay in flow.
              inputRef.current?.focus();
            }}
          >
            Clear
          </button>
        </div>
      ) : (
        visibleGroups.map(({ cat, slugs }) => (
          <section key={cat} className="vendo-portal__group">
            <h3 className="vendo-portal__group-title">{titleCase(cat)}</h3>
            <ul className="vendo-portal__cards" role="list">
              {slugs.map((slug) => (
                <li key={slug}>
                  <ConnectionCard
                    slug={slug}
                    compact={layout === "list"}
                    returnTo={returnTo}
                    onConnected={onConnected}
                    onDisconnected={onDisconnected}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
