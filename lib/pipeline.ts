// One scan, start to finish: find the pages, read them, draft the brief, check it.

import { createHash } from "node:crypto";
import { AnakinError, mapSite, scrape, scrapeMany, type ScrapedPage } from "./anakin";
import { confirmContradictions, draftBrief, type PageText } from "./extract";
import { pageTitle, pickPages } from "./links";
import { toBlocks } from "./text";
import type { Brief, ScanEvent } from "./types";
import { buildBrief } from "./verify";

const EXTRA_PAGES = 7;

/** Bump this when the prompt or the checks change, so briefs made by an older version are redone on request. */
export const PIPELINE_VERSION = 6;

export function briefId(url: URL): string {
  const key = url.hostname.replace(/^www\./, "") + url.pathname.replace(/\/+$/, "") + url.search;
  const slug = key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `${slug}-${createHash("sha1").update(key.toLowerCase()).digest("hex").slice(0, 6)}`;
}

export class ScanError extends Error {}

export async function runScan(start: URL, emit: (e: ScanEvent) => void): Promise<Brief> {
  const began = Date.now();
  const host = start.hostname.replace(/^www\./, "");

  emit({ type: "status", message: `Opening ${host}` });
  // The first page and the site map are independent, so fetch them together.
  const [first, mapped] = await Promise.all([
    scrape(start.href).catch((e: unknown) => {
      throw new ScanError(e instanceof AnakinError ? `That page wouldn't load (${e.message}).` : "That page wouldn't load.");
    }),
    mapSite(start.href).catch(() => [] as string[]),
  ]);
  if (!first.ok || first.markdown.trim().length < 200) {
    throw new ScanError("That page loaded but had almost no text on it. If it needs a login, Fine Print can't read it.");
  }

  const scraped: ScrapedPage[] = [first];
  emit({ type: "page", url: first.url, title: pageTitle(first.html, host), chars: first.markdown.length, ok: true });

  const more = pickPages(new URL(first.url), first.html, mapped, EXTRA_PAGES);
  emit({ type: "found", count: more.length, reading: more });

  if (more.length) {
    const rest = await scrapeMany(more).catch(() => [] as ScrapedPage[]);
    const seen = new Set([fingerprint(first.markdown)]);
    for (const page of rest) {
      const usable = page.ok && page.markdown.trim().length >= 200 && !seen.has(fingerprint(page.markdown));
      emit({ type: "page", url: page.url, title: pageTitle(page.html, page.url), chars: page.markdown.length, ok: usable });
      if (usable) {
        seen.add(fingerprint(page.markdown));
        scraped.push(page);
      }
    }
  }

  console.log(`[scan] ${host}: ${scraped.length} pages scraped in ${Math.round((Date.now() - began) / 1000)}s`);
  const pages: PageText[] = scraped.map((p) => ({ url: p.url, title: pageTitle(p.html, p.url), blocks: toBlocks(p.markdown) }));

  emit({ type: "status", message: pages.length > 1 ? `Comparing ${pages.length} pages against each other` : "Reading the page closely" });
  const { draft, model } = await draftBrief(pages, new Date().toISOString().slice(0, 10)).catch((e: unknown) => {
    throw new ScanError(`The pages were read, but writing the brief failed. Try again in a minute. (${e instanceof Error ? e.message.slice(0, 160) : "unknown error"})`);
  });

  emit({ type: "status", message: "Checking every quote against the page it came from" });
  const { checked, dropped, ...body } = buildBrief(draft, pages);

  // Contradictions are the strongest claim the brief makes about someone else's website,
  // so each one gets a second opinion from a reader who sees only the two passages.
  const claimed = body.flags.filter((f) => f.type === "contradiction");
  let overruled = 0;
  if (claimed.length) {
    emit({ type: "status", message: claimed.length === 1 ? "Getting a second opinion on one contradiction" : `Getting a second opinion on ${claimed.length} contradictions` });
    const agreed = await confirmContradictions(claimed.map((f) => ({ title: f.title, a: f.evidence[0].context, b: f.evidence[1].context })));
    const rejected = new Set(claimed.filter((_, i) => !agreed[i]));
    overruled = rejected.size;
    body.flags = body.flags.filter((f) => !rejected.has(f));
  }

  return {
    id: briefId(start),
    url: start.href,
    scannedAt: new Date().toISOString(),
    ...body,
    pages: pages.map((p, i) => ({ url: p.url, title: p.title, chars: scraped[i].markdown.length, ok: true })),
    stats: { version: PIPELINE_VERSION, model, quotesChecked: checked, quotesDropped: dropped, contradictionsOverruled: overruled, seconds: Math.round((Date.now() - began) / 1000) },
  };
}

function fingerprint(markdown: string): string {
  return createHash("sha1").update(markdown.replace(/\s+/g, " ").trim()).digest("hex");
}
