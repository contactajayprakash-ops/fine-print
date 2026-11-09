// Decide which other pages of a site are worth reading.

// What a page's address or link text has to mention to be worth a scraping credit, and how much.
const WANTED: [RegExp, number][] = [
  [/\brules?\b|terms|conditions|\blegal\b|official/i, 10],
  [/eligib|who-can|requirements?/i, 9],
  [/\bfaqs?\b|frequently|questions/i, 8],
  [/prizes?\b|awards?\b|rewards?\b|benefits/i, 7],
  [/fees?\b|\bcosts?\b|tuition|pricing|financial-aid/i, 7],
  [/dates?\b|deadline|schedule|timeline/i, 6],
  [/judg|criteria|scoring|selection/i, 6],
  [/submi|how-to-apply|\bapply\b|application|how-it-works/i, 6],
  [/guidelines?|details|overview/i, 5],
  [/resources?|updates?/i, 3],
];

// Pages that mention those words but are about something else.
const OFF_TOPIC = /\/(news|newsevents|press|press-releases|blog|gifted-blog|stories|careers|jobs|team|our-team|leadership|staff|board|sponsors?|partners?|alumni|impact|donate|give|contact|privacy|privacy-policy|cookies?|judges|mentors|volunteer|shop|store|events?)(\/|$)/i;

const SKIP = /\.(png|jpe?g|gif|svg|webp|css|js|ico|zip|mp4|mov|woff2?|pdf|docx?)($|\?)|\/(login|signin|sign-in|signup|sign-up|register|cart|checkout|participants|project-gallery|forum_topics|calendar|users|settings|search|tag|category|author|feed|wp-json|cdn-cgi)\b|mailto:|javascript:|tel:/i;

const MIN_SCORE = 5;

export function normalizeUrl(raw: string): URL | null {
  let text = raw.trim();
  if (!text) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(text) && !/^https?:\/\//i.test(text)) return null;
  if (!/^https?:\/\//i.test(text)) text = "https://" + text;
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

/** Refuse anything that isn't a public web address. Anakin does the fetching, but there's no reason to pass these along. */
export function isPublicHost(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (!host.includes(".")) return false;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":")) return false;
  return true;
}

function sameSite(a: URL, b: URL): boolean {
  const strip = (h: string) => h.replace(/^www\./, "");
  return strip(a.hostname) === strip(b.hostname);
}

/** One spelling per page, so http/https, www and trailing slashes don't make it look like several. */
function canonical(url: URL): string {
  const copy = new URL(url.href);
  copy.protocol = "https:";
  copy.hostname = copy.hostname.replace(/^www\./, "");
  copy.hash = "";
  for (const p of [...copy.searchParams.keys()]) {
    if (/^(utm_|ref|fbclid|gclid|flow)/i.test(p)) copy.searchParams.delete(p);
  }
  let href = copy.href;
  if (href.endsWith("/") && copy.pathname !== "/") href = href.slice(0, -1);
  return href;
}

/** Pull anchors out of raw HTML along with their link text. */
export function anchorsIn(html: string, base: URL): { url: URL; text: string }[] {
  const out: { url: URL; text: string }[] = [];
  const re = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1].replace(/&amp;/g, "&");
    if (href.startsWith("#")) continue;
    try {
      out.push({ url: new URL(href, base), text: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() });
    } catch {
      // not a usable link
    }
  }
  return out;
}

/**
 * Rank candidate pages by how likely they are to hold rules, dates, money or eligibility,
 * and return the best few. `mapped` comes from Anakin's Map endpoint, `html` from the first page.
 */
export function pickPages(start: URL, html: string, mapped: string[], limit: number): string[] {
  const scores = new Map<string, { score: number; href: string }>();
  const startKey = canonical(start);
  const startDepth = start.pathname.split("/").filter(Boolean).length;

  const consider = (url: URL, text: string, bonus: number) => {
    if (!sameSite(url, start) || SKIP.test(url.href) || OFF_TOPIC.test(url.pathname)) return;
    const k = canonical(url);
    if (k === startKey) return;
    const haystack = decodeURIComponent(url.pathname) + " " + text;
    let score = 0;
    for (const [re, weight] of WANTED) if (re.test(haystack)) score = Math.max(score, weight);
    if (score === 0) return;
    // Prefer pages that live under the address the reader pasted, and shallow ones.
    const under = start.pathname.replace(/\/$/, "");
    if (under && url.pathname.startsWith(under + "/")) score += 4;
    const depth = url.pathname.split("/").filter(Boolean).length;
    score -= Math.max(0, depth - startDepth - 1);
    if (url.search) score -= 2;
    scores.set(k, { score: Math.max(scores.get(k)?.score ?? -Infinity, score + bonus), href: scores.get(k)?.href ?? url.href.split("#")[0] });
  };

  for (const a of anchorsIn(html, start)) consider(a.url, a.text, 1);
  for (const link of mapped) {
    try {
      consider(new URL(link), "", 0);
    } catch {
      // skip
    }
  }

  return [...scores.values()]
    .filter((s) => s.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.href.length - b.href.length)
    .slice(0, limit)
    .map((s) => s.href.replace(/\/$/, ""));
}

export function pageTitle(html: string, fallback: string): string {
  const m =
    /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i.exec(html) ??
    /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) ??
    /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const title = m ? decodeEntities(m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()) : "";
  return title.slice(0, 140) || fallback;
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}
