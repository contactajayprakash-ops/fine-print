// Decide which other pages of a site are worth reading.

const WANTED: [RegExp, number][] = [
  [/rules?\b|terms|conditions|legal|official/i, 10],
  [/eligib|who-can|requirements?/i, 9],
  [/faq|questions/i, 8],
  [/prize|award|reward/i, 7],
  [/dates?|deadline|schedule|timeline|calendar/i, 6],
  [/judg|criteria|scoring/i, 6],
  [/submi|apply|application|how-to/i, 5],
  [/resources?|guidelines?|details|about|overview|info/i, 4],
  [/updates?|announce|news/i, 3],
  [/fees?|cost|tuition|pricing|financial/i, 7],
  [/privacy|code-of-conduct|conduct/i, 2],
];

const SKIP = /\.(png|jpe?g|gif|svg|webp|css|js|ico|zip|mp4|mov|woff2?)($|\?)|\/(login|signin|sign-in|signup|sign-up|register|cart|checkout|participants|project-gallery|forum_topics|calendar|users|settings|search|tag|category|author|feed|wp-json|cdn-cgi)\b|mailto:|javascript:|tel:/i;

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

function canonical(url: URL): string {
  const copy = new URL(url.href);
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
  const scores = new Map<string, number>();
  const startKey = canonical(start);
  const startDepth = start.pathname.split("/").filter(Boolean).length;

  const consider = (url: URL, text: string, bonus: number) => {
    if (!sameSite(url, start) || SKIP.test(url.href)) return;
    const k = canonical(url);
    if (k === startKey) return;
    const haystack = decodeURIComponent(url.pathname) + " " + text;
    let score = 0;
    for (const [re, weight] of WANTED) if (re.test(haystack)) score = Math.max(score, weight);
    if (score === 0) return;
    // Prefer pages that live under the address the reader pasted, and shallow ones.
    if (start.pathname !== "/" && url.pathname.startsWith(start.pathname)) score += 3;
    const depth = url.pathname.split("/").filter(Boolean).length;
    score -= Math.max(0, depth - startDepth - 1);
    if (url.search) score -= 2;
    scores.set(k, Math.max(scores.get(k) ?? -Infinity, score + bonus));
  };

  for (const a of anchorsIn(html, start)) consider(a.url, a.text, 1);
  for (const link of mapped) {
    try {
      consider(new URL(link), "", 0);
    } catch {
      // skip
    }
  }

  return [...scores.entries()]
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
    .slice(0, limit)
    .map(([u]) => u);
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
