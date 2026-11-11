import { createHash } from "node:crypto";
import { isPublicHost, normalizeUrl } from "@/lib/links";
import { briefId, PIPELINE_VERSION, runScan, ScanError } from "@/lib/pipeline";
import { loadBrief, saveBrief, takeScanSlot } from "@/lib/store";
import type { ScanEvent } from "@/lib/types";

// A scan waits on three network round trips and a model call; give it room.
export const maxDuration = 300;

const FRESH_FOR_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const url = normalizeUrl(typeof body?.url === "string" ? body.url : "");
  if (!url || !isPublicHost(url)) {
    return Response.json({ error: "That doesn't look like a web address. Paste the full link to the page." }, { status: 400 });
  }

  const id = briefId(url);
  // A brief less than a day old is reused; pages rarely change faster than that, and scans cost credits.
  const existing = await loadBrief(id);
  if (existing && existing.stats.version === PIPELINE_VERSION && Date.now() - Date.parse(existing.scannedAt) < FRESH_FOR_MS) {
    return ndjson(async (emit) => emit({ type: "done", id, cached: true }));
  }

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const visitor = createHash("sha256").update(forwarded).digest("hex").slice(0, 16);
  const slot = await takeScanSlot(visitor);
  if (!slot.ok) return Response.json({ error: slot.reason }, { status: 429 });

  return ndjson(async (emit) => {
    try {
      // Sent first so the browser knows where the brief will be, even if its connection drops mid-scan.
      emit({ type: "started", id });
      const brief = await runScan(url, emit);
      await saveBrief(brief);
      emit({ type: "done", id: brief.id, cached: false });
    } catch (e) {
      console.error("scan failed", url.href, e);
      emit({ type: "error", message: e instanceof ScanError ? e.message : "Something went wrong while reading that page. Try again in a minute." });
    }
  });
}

/**
 * Stream events to the browser as one JSON object per line. A blank line goes out every few seconds
 * so proxies and phone networks don't close a connection that looks idle while the model is working.
 */
function ndjson(run: (emit: (e: ScanEvent) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const write = (text: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          open = false; // the reader went away; the scan still finishes and is saved
        }
      };
      const heartbeat = setInterval(() => write("\n"), 8000);
      try {
        await run((e) => write(JSON.stringify(e) + "\n"));
      } finally {
        clearInterval(heartbeat);
        if (open) controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
