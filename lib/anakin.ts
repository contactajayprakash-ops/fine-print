// Thin client for the Anakin web data API (https://anakin.io/docs).
// Every job is submit-then-poll; status polling is not rate limited.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = "https://api.anakin.io/v1";

export interface ScrapedPage {
  url: string;
  ok: boolean;
  html: string;
  markdown: string;
  error?: string;
}

// Only the fields this app reads. Anakin returns more.
interface PageResult {
  index?: number;
  url?: string;
  finalUrl?: string;
  status?: string;
  statusCode?: number;
  html?: string;
  markdown?: string;
  error?: string;
}

interface Job extends PageResult {
  jobId?: string;
  results?: PageResult[];
  links?: unknown;
  message?: string;
}

export class AnakinError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

function key(): string {
  const k = process.env.ANAKIN_API_KEY;
  if (!k) throw new AnakinError("ANAKIN_API_KEY is not set");
  return k;
}

async function call(pathname: string, body?: unknown): Promise<Job> {
  const res = await fetch(BASE + pathname, {
    method: body ? "POST" : "GET",
    headers: { "X-API-Key": key(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  let data: Job;
  try {
    data = JSON.parse(text) as Job;
  } catch {
    data = { message: text.slice(0, 200) };
  }
  if (!res.ok) {
    throw new AnakinError(`Anakin ${res.status}: ${data.message ?? data.error ?? res.statusText}`, res.status);
  }
  return data;
}

async function waitFor(pathname: string, timeoutMs: number): Promise<Job> {
  const started = Date.now();
  let delay = 1500;
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, delay));
    const job = await call(pathname);
    if (job.status === "completed") return job;
    if (job.status === "failed") throw new AnakinError(job.error ?? "The page could not be fetched");
    delay = Math.min(delay + 500, 3000);
  }
  throw new AnakinError("Timed out waiting for the page to load");
}

function toPage(url: string, r: PageResult): ScrapedPage {
  const ok = r.status === "completed" && typeof r.markdown === "string" && (r.statusCode ?? 200) < 400;
  return { url: r.finalUrl ?? r.url ?? url, ok, html: r.html ?? "", markdown: r.markdown ?? "", error: ok ? undefined : (r.error ?? `status ${r.statusCode ?? r.status}`) };
}

/** Scrape one page. */
export async function scrape(url: string): Promise<ScrapedPage> {
  return cached("scrape", [url], async () => {
    const { jobId } = await call("/url-scraper", { url });
    if (!jobId) throw new AnakinError("Anakin did not start the job");
    return toPage(url, await waitFor(`/url-scraper/${jobId}`, 90_000));
  });
}

/** Scrape up to ten pages in one job. Pages that fail come back with ok: false instead of throwing. */
export async function scrapeMany(urls: string[]): Promise<ScrapedPage[]> {
  if (urls.length === 0) return [];
  if (urls.length > 10) throw new AnakinError("Batch jobs take at most 10 URLs");
  return cached("batch", urls, async () => {
    const { jobId } = await call("/url-scraper/batch", { urls });
    const job = await waitFor(`/url-scraper/${jobId}`, 120_000);
    const results = job.results ?? [];
    return urls.map((u, i) => toPage(u, results.find((r) => r.index === i) ?? { status: "failed" }));
  });
}

/** Ask Anakin for the URLs it can discover on a site (sitemap plus on-page links). */
export async function mapSite(url: string): Promise<string[]> {
  return cached("map", [url], async () => {
    const { jobId } = await call("/map", { url });
    const job = await waitFor(`/map/${jobId}`, 60_000);
    return Array.isArray(job.links) ? job.links.filter((l): l is string => typeof l === "string") : [];
  });
}

// Local development only: keep responses on disk so repeated runs don't spend credits.
async function cached<T>(kind: string, urls: string[], run: () => Promise<T>): Promise<T> {
  const dir = process.env.FINEPRINT_DEV_CACHE;
  if (!dir) return run();
  const name = createHash("sha1").update(kind + "\n" + urls.join("\n")).digest("hex").slice(0, 16);
  const file = path.join(dir, `${kind}-${name}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    const value = await run();
    await mkdir(dir, { recursive: true });
    await writeFile(file, JSON.stringify(value));
    return value;
  }
}
