import type { Brief, Evidence, OpportunityKind, PrizeKind } from "./types";

export const KIND_LABEL: Record<OpportunityKind, string> = {
  hackathon: "Hackathon",
  scholarship: "Scholarship",
  competition: "Competition",
  program: "Program",
  fellowship: "Fellowship",
  internship: "Internship",
  grant: "Grant",
  other: "Opportunity",
};

export const PRIZE_LABEL: Record<PrizeKind, string> = {
  cash: "Cash",
  credit: "Credits",
  subscription: "Subscription",
  scholarship: "Scholarship",
  physical: "Physical item",
  recognition: "Recognition",
  other: "Other",
};

/** Short name for a page: its path, or the site name for the front page. */
export function pageLabel(url: string): string {
  try {
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname).replace(/\/$/, "");
    return path ? path : `${u.hostname.replace(/^www\./, "")} front page`;
  } catch {
    return url;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Split a paragraph around the quoted sentence so the quote can be highlighted in place. */
export function around(e: Evidence): { before: string; quote: string; after: string } {
  const at = e.context.indexOf(e.quote);
  if (at === -1) return { before: "", quote: e.quote, after: "" };
  return { before: e.context.slice(0, at), quote: e.quote, after: e.context.slice(at + e.quote.length) };
}

export function flagTally(brief: Brief): string {
  const n = brief.flags.length;
  if (n === 0) return "Nothing flagged";
  const high = brief.flags.filter((f) => f.severity === "high").length;
  const base = `${n} ${n === 1 ? "thing" : "things"} to check`;
  return high ? `${base}, ${high} serious` : base;
}

/** "2026-11-15T18:00" → "Sunday, November 15, 2026 at 6:00 PM", with no zone conversion. */
export function asWritten(local: string, hasTime: boolean): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(local);
  if (!m) return local;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0)));
  const date = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(d);
  if (!hasTime) return date;
  const time = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit" }).format(d);
  return `${date} at ${time}`;
}
