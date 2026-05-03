import React, { useContext } from "react";
import { useConnection } from "../hooks/useConnection.js";
import { PortalContext } from "../context.js";

interface ManageButtonProps {
  /** Integration slug — used to look up the connection ID. */
  slug: string;
  /** URL to return to after the manage session. Passed as a query param. */
  returnTo?: string;
  children?: React.ReactNode;
  className?: string;
}

/** Opens the Vendo-hosted connection management dashboard in a popup.
 *  The URL is `{apiBaseRoot}/dashboard/connections/{connection.id}`.
 *  Use this for a standalone manage trigger outside of <ConnectionCard>.
 */
export function ManageButton({
  slug,
  returnTo,
  children,
  className,
}: ManageButtonProps): React.ReactElement {
  const { connection } = useConnection(slug);
  const ctx = useContext(PortalContext);

  function handleClick(): void {
    if (!connection || !ctx) return;

    const baseRoot = ctx._baseUrl.replace(/\/api\/?$/, "");
    // Use the UUID (id) so the dashboard route query (.eq("id", connectionId)) succeeds
    const url = new URL(`${baseRoot}/dashboard/connections/${connection.id}`);
    if (returnTo) url.searchParams.set("return_to", returnTo);

    window.open(url.toString(), "vendo-manage", "width=960,height=720,popup");
  }

  return (
    <button
      className={["vendo-manage-btn", className].filter(Boolean).join(" ")}
      onClick={handleClick}
      disabled={!connection}
    >
      {children ?? "Manage"}
    </button>
  );
}
