"use client";

import Link from "next/link";
import { useState } from "react";
import { useNow } from "@/lib/use-stored";

const A_DAY = 24 * 60 * 60 * 1000;

export function BriefActions({ sourceUrl, scannedAt }: { sourceUrl: string; scannedAt: string }) {
  const [copied, setCopied] = useState(false);
  const now = useNow();
  // Briefs are reused for a day; after that the reader can ask for a fresh read.
  const canRescan = now !== null && now - Date.parse(scannedAt) > A_DAY;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="brief-actions">
      <button type="button" className="button quiet" onClick={copyLink}>
        {copied ? "Link copied" : "Copy link to this brief"}
      </button>
      <button type="button" className="button quiet" onClick={() => window.print()}>
        Print
      </button>
      {canRescan && (
        <Link className="button quiet" href={`/?url=${encodeURIComponent(sourceUrl)}`}>
          Read the pages again
        </Link>
      )}
    </div>
  );
}
