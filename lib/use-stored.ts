"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

// Small per-browser settings (your age for the eligibility check, ticked checklist items).
// localStorage can be missing or blocked, so every write also lands in memory.

const CHANGED = "fineprint:stored";
const memory = new Map<string, string>();

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

function read(key: string): string | null {
  if (memory.has(key)) return memory.get(key) ?? null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Returns the stored value, a setter, and whether we're past the first (server-matching) render. */
export function useStored<T>(key: string, fallback: T): [T, (value: T) => void, boolean] {
  const raw = useSyncExternalStore<string | null | undefined>(
    subscribe,
    () => read(key),
    () => undefined,
  );

  const value = useMemo(() => {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }, [raw, fallback]);

  const set = useCallback(
    (next: T) => {
      const text = JSON.stringify(next);
      memory.set(key, text);
      try {
        localStorage.setItem(key, text);
      } catch {
        // kept in memory for this visit only
      }
      window.dispatchEvent(new Event(CHANGED));
    },
    [key],
  );

  return [value, set, raw !== undefined];
}

function everyMinute(onTick: () => void) {
  const timer = setInterval(onTick, 60_000);
  return () => clearInterval(timer);
}

/** The current time, refreshed each minute. Null while rendering on the server. */
export function useNow(): number | null {
  return useSyncExternalStore<number | null>(
    everyMinute,
    () => Math.floor(Date.now() / 60_000) * 60_000,
    () => null,
  );
}
