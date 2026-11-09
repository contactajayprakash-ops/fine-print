"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * A line of the brief with its evidence tucked behind a "Source" button.
 * The quotes are rendered on the server and passed in; this only shows and hides them.
 */
export function Sourced({ children, badge, quotes, align = "between" }: { children?: ReactNode; badge?: ReactNode; quotes: ReactNode; align?: "between" | "start" }) {
  const [open, setOpen] = useState(false);
  const panel = useId();

  return (
    <>
      <div className={`line-head${align === "start" ? " start" : ""}`}>
        {children && <div className="grow">{children}</div>}
        {badge}
        <button type="button" className="source-toggle" aria-expanded={open} aria-controls={panel} onClick={() => setOpen(!open)}>
          {open ? "Hide source" : "Source"}
        </button>
      </div>
      <div id={panel} className="source-panel" hidden={!open}>
        {quotes}
      </div>
    </>
  );
}
