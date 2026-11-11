"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { pageLabel } from "@/lib/format";
import type { ScanEvent } from "@/lib/types";

interface LogLine {
  what: string;
  meta?: string;
  skipped?: boolean;
}

export function ScanForm({ initialUrl }: { initialUrl: string }) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [log, setLog] = useState<LogLine[]>([]);
  const startedAt = useRef(0);

  const handle = (event: ScanEvent) => {
    if (event.type === "status") {
      setLog((l) => [...l, { what: event.message }]);
    } else if (event.type === "found") {
      const n = event.count;
      setLog((l) => [...l, { what: n ? `Found ${n} more ${n === 1 ? "page" : "pages"} worth reading: ${event.reading.map(pageLabel).join(", ")}` : "No other pages worth reading on this site" }]);
    } else if (event.type === "page") {
      setLog((l) => [
        ...l,
        event.ok
          ? { what: `Read ${pageLabel(event.url)}`, meta: `${event.chars.toLocaleString()} characters` }
          : { what: pageLabel(event.url), meta: "empty or a repeat, skipped", skipped: true },
      ]);
    } else if (event.type === "error") {
      setError(event.message);
    } else if (event.type === "done") {
      router.push(`/b/${event.id}`);
    }
  };

  /**
   * The scan keeps running on the server even if this connection drops (phone networks do that).
   * So before giving up, check a few times whether the finished brief has turned up.
   */
  const waitForBrief = async (id: string): Promise<boolean> => {
    setLog((l) => [...l, { what: "The connection dropped. Still waiting for the brief" }]);
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const res = await fetch(`/api/brief/${id}`, { cache: "no-store" });
        if (res.ok) {
          const brief = (await res.json()) as { scannedAt?: string };
          if (brief.scannedAt && Date.parse(brief.scannedAt) > startedAt.current - 5000) {
            router.push(`/b/${id}`);
            return true;
          }
        }
      } catch {
        // still offline; try again
      }
    }
    return false;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !url.trim()) return;
    setBusy(true);
    setError("");
    setLog([]);
    startedAt.current = Date.now();
    let finished = false;
    let briefId = "";

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok || !res.body) {
        const problem = await res.json().catch(() => null);
        setError(problem?.error ?? "The scan couldn't start. Try again in a minute.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as ScanEvent;
          if (event.type === "started") briefId = event.id;
          if (event.type === "done" || event.type === "error") finished = true;
          handle(event);
        }
      }
      if (!finished && !(briefId && (await waitForBrief(briefId)))) {
        setError("The connection dropped before the brief was finished. Try again in a minute.");
      }
    } catch {
      if (!(briefId && (await waitForBrief(briefId)))) {
        setError("The connection dropped before the brief was finished. Try again in a minute.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <form className="scan-form" onSubmit={submit}>
        <label htmlFor="url">Link to the hackathon, scholarship or program</label>
        <div className="scan-field">
          <input
            id="url"
            name="url"
            type="text"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="https://example.org/summer-program"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={busy}
            required
          />
          <button className="button" type="submit" disabled={busy}>
            {busy ? "Reading" : "Read the fine print"}
          </button>
        </div>
        {!busy && !error && log.length === 0 && (
          <p className="form-note">Takes about a minute. Works on public pages; it can&rsquo;t log in or read PDFs yet.</p>
        )}
      </form>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {log.length > 0 && (
        <ol className="log" aria-live="polite">
          {log.map((line, i) => (
            <li key={i} className={[line.skipped ? "skipped" : "", busy && i === log.length - 1 ? "now" : ""].join(" ").trim() || undefined}>
              <span className="what">{line.what}</span>
              {line.meta && <span className="meta">{line.meta}</span>}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
