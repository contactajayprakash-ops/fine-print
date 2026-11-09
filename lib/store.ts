// Where finished briefs live. On Vercel that's a private Blob store; on a laptop it's a folder.
// Example briefs ship with the repo so the site has something to show even with no storage attached.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { examples } from "@/data/examples";
import type { Brief } from "./types";

const onBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
// Vercel's filesystem is read-only apart from /tmp, which only lasts as long as the instance does.
// That is enough to try the app without storage attached, but briefs won't survive for long.
const localDir = () => (process.env.VERCEL ? "/tmp/fine-print" : path.join(process.cwd(), ".data"));

async function readJson<T>(name: string): Promise<T | null> {
  try {
    if (onBlob()) {
      const hit = await get(name, { access: "private", useCache: false });
      if (!hit || hit.statusCode !== 200) return null;
      return (await new Response(hit.stream).json()) as T;
    }
    return JSON.parse(await readFile(path.join(localDir(), name), "utf8")) as T;
  } catch {
    return null;
  }
}

async function writeJson(name: string, value: unknown): Promise<void> {
  const body = JSON.stringify(value);
  if (onBlob()) {
    await put(name, body, { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
    return;
  }
  const file = path.join(localDir(), name);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

export async function loadBrief(id: string): Promise<Brief | null> {
  if (!/^[a-z0-9-]{3,90}$/.test(id)) return null;
  return (await readJson<Brief>(`briefs/${id}.json`)) ?? examples.find((b) => b.id === id) ?? null;
}

export async function saveBrief(brief: Brief): Promise<void> {
  await writeJson(`briefs/${brief.id}.json`, brief);
}

// Fresh scans cost scraping credits, so they are counted per day and per visitor.
interface Usage {
  total: number;
  byVisitor: Record<string, number>;
}

const DAILY_TOTAL = Number(process.env.SCANS_PER_DAY ?? 40);
const DAILY_EACH = Number(process.env.SCANS_PER_VISITOR ?? 5);

export async function takeScanSlot(visitor: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const name = `usage/${new Date().toISOString().slice(0, 10)}.json`;
  const usage = (await readJson<Usage>(name)) ?? { total: 0, byVisitor: {} };
  if (usage.total >= DAILY_TOTAL) {
    return { ok: false, reason: "Fine Print has read as many new pages as it can afford today. Briefs that already exist still open, and the counter resets at midnight UTC." };
  }
  if ((usage.byVisitor[visitor] ?? 0) >= DAILY_EACH) {
    return { ok: false, reason: `You've started ${DAILY_EACH} new scans today, which is the limit. Briefs that already exist still open.` };
  }
  usage.total += 1;
  usage.byVisitor[visitor] = (usage.byVisitor[visitor] ?? 0) + 1;
  await writeJson(name, usage).catch(() => {});
  return { ok: true };
}
