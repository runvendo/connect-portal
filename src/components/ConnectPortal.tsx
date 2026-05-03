import React, { useMemo, useState, useEffect, useRef } from "react";
import type { Connection } from "@vendodev/sdk";
import { useIntegrations } from "../hooks/useIntegrations.js";
import { useConnections } from "../hooks/useConnections.js";
import { ConnectionCard } from "./ConnectionCard.js";

/** The `category` string union used to filter groups. Matches Integration.category. */
export type Category = string;

/** Built-in theme presets. Override individual tokens via CSS custom properties
 *  on a wrapper element for finer control. */
export type Theme = "light" | "beige" | "dark";

export interface ConnectPortalProps {
  /** Filter to these categories only. Default: show all groups. */
  categories?: Category[];
  /** Show the search input. Default: true. */
  showSearch?: boolean;
  /** Show the category filter pill row. Default: true. Filters override one
   *  another (single-select); set false to render all categories at once. */
  showCategoryFilter?: boolean;
  /** Card layout. Default: "grid". */
  layout?: "grid" | "list";
  /** Built-in theme preset. Default: "light". For custom palettes, set
   *  --vendo-color-* CSS custom properties on a wrapper element. */
  theme?: Theme;
  /** Initial number of cards rendered per group. Groups with more than this
   *  many slugs render a "Show all N" toggle instead of dumping the full
   *  list. Pass 0 to disable pagination (render all). Default: 6. */
  pageSize?: number;
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

/** Title-case a category for display, but uppercase well-known acronyms.
 *  The DB seeds lowercase ("ai", "communication", "voice", "other"); a
 *  generic title-case yields "Ai" which reads as a typo. */
const ACRONYM_CATEGORIES = new Set(["ai", "api", "ml", "ai-ml", "ai_ml"]);
function titleCase(s: string): string {
  if (ACRONYM_CATEGORIES.has(s.toLowerCase())) return s.toUpperCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Full grid/list of all integration cards, grouped by category with search.
 * Wrap in <VendoProvider> — reads integrations + connections from context.
 */
export function ConnectPortal({
  categories,
  showSearch = true,
  showCategoryFilter = true,
  layout = "grid",
  theme = "light",
  pageSize = 6,
  className,
  onConnected,
  onDisconnected,
  returnTo,
}: ConnectPortalProps): React.ReactElement {
  const { integrations, status } = useIntegrations();
  const { connections } = useConnections();
  const [rawSearch, setRawSearch] = useState("");
  const [search, setSearch] = useState("");
  // Single-select category filter: null = show all groups. Pill row drives this.
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  // Per-category set of categories whose "Show all" has been clicked. Tracked
  // here (not inside Group) so collapse/expand persists across re-renders
  // when search debounces.
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(),
  );
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

  // Filter to requested categories. The `categories` prop scopes which groups
  // are eligible at all; the activeCategory pill UI then filters that subset
  // further to one selected group.
  const allowedCategories = useMemo(() => {
    const keys = Array.from(grouped.keys()).sort();
    return categories ? keys.filter((k) => categories.includes(k)) : keys;
  }, [grouped, categories]);

  // Reset the active filter if it ever points at a group that isn't allowed
  // anymore (e.g. consumer narrowed the categories prop).
  useEffect(() => {
    if (activeCategory && !allowedCategories.includes(activeCategory)) {
      setActiveCategory(null);
    }
  }, [activeCategory, allowedCategories]);

  const categoryKeys = useMemo(
    () =>
      activeCategory
        ? allowedCategories.filter((k) => k === activeCategory)
        : allowedCategories,
    [allowedCategories, activeCategory],
  );

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
    theme !== "light" ? `vendo-theme-${theme}` : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // Render skeleton cards while the provider is still fetching the catalog.
  // Avoids a single jumpy paint when integrations land — keeps the layout
  // shape stable and gives consumers a clear "loading" affordance.
  if (status === "loading") {
    return (
      <div className={rootClass} role="region" aria-label="Vendo connections" aria-busy="true">
        {showSearch && (
          <div className="vendo-portal__search-wrap">
            <div className="vendo-portal__search-row">
              <div className="vendo-portal__search vendo-portal__search--skeleton" aria-hidden />
            </div>
          </div>
        )}
        <ul className="vendo-portal__cards" role="list">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i}>
              <div className="vendo-connect-card vendo-connect-card--skeleton" aria-hidden>
                <div className="vendo-connect-card__logo-skeleton" />
                <div className="vendo-connect-card__info">
                  <div className="vendo-skeleton-line vendo-skeleton-line--name" />
                  <div className="vendo-skeleton-line vendo-skeleton-line--badge" />
                </div>
                <div className="vendo-skeleton-line vendo-skeleton-line--cta" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

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

      {showCategoryFilter && allowedCategories.length > 1 && (
        <div className="vendo-portal__filter" role="tablist" aria-label="Filter by category">
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === null}
            className={`vendo-portal__filter-pill${activeCategory === null ? " vendo-portal__filter-pill--active" : ""}`}
            onClick={() => setActiveCategory(null)}
          >
            All
          </button>
          {allowedCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={activeCategory === cat}
              className={`vendo-portal__filter-pill${activeCategory === cat ? " vendo-portal__filter-pill--active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {titleCase(cat)}
            </button>
          ))}
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
        visibleGroups.map(({ cat, slugs }) => {
          // Pagination: clamp to pageSize unless this group has been expanded
          // or the user is searching/filtering (those modes already cull
          // the list and a "Show all" pretense would be confusing).
          const collapsed =
            pageSize > 0 &&
            !expandedCategories.has(cat) &&
            !lc &&
            !activeCategory &&
            slugs.length > pageSize;
          const visibleSlugs = collapsed ? slugs.slice(0, pageSize) : slugs;
          const hiddenCount = slugs.length - visibleSlugs.length;
          return (
            <section key={cat} className="vendo-portal__group">
              <h3 className="vendo-portal__group-title">{titleCase(cat)}</h3>
              <ul className="vendo-portal__cards" role="list">
                {visibleSlugs.map((slug) => (
                  <li key={slug}>
                    <ConnectionCard
                      slug={slug}
                      compact={layout === "list"}
                      theme={theme}
                      returnTo={returnTo}
                      onConnected={onConnected}
                      onDisconnected={onDisconnected}
                    />
                  </li>
                ))}
              </ul>
              {hiddenCount > 0 ? (
                <button
                  type="button"
                  className="vendo-portal__show-more"
                  onClick={() =>
                    setExpandedCategories((prev) => {
                      const next = new Set(prev);
                      next.add(cat);
                      return next;
                    })
                  }
                >
                  Show all {slugs.length} {titleCase(cat).toLowerCase()}
                </button>
              ) : expandedCategories.has(cat) && pageSize > 0 && slugs.length > pageSize ? (
                <button
                  type="button"
                  className="vendo-portal__show-more"
                  onClick={() =>
                    setExpandedCategories((prev) => {
                      const next = new Set(prev);
                      next.delete(cat);
                      return next;
                    })
                  }
                >
                  Show fewer
                </button>
              ) : null}
            </section>
          );
        })
      )}
    </div>
  );
}
