"use client";

import type { ReactNode } from "react";
import type { SubmissionItem } from "@/lib/types";
import { useStored } from "@/lib/use-stored";
import { Sourced } from "./Sourced";

const NONE: number[] = [];
const LABEL = { required: "Required", optional: "Optional", unclear: "Not clear if required" } as const;

/** What to hand in, as boxes the reader can tick. Ticks are kept in the browser, per brief. */
export function Checklist({ briefId, items, quotes }: { briefId: string; items: SubmissionItem[]; quotes: ReactNode[] }) {
  const [saved, save] = useStored<number[]>(`fineprint.done.${briefId}`, NONE);
  const done = Array.isArray(saved) ? saved : NONE;
  const toggle = (i: number) => save(done.includes(i) ? done.filter((n) => n !== i) : [...done, i]);

  return (
    <ul className="lines">
      {items.map((item, i) => (
        <li key={i}>
          <div className="check">
            <input type="checkbox" id={`item-${i}`} checked={done.includes(i)} onChange={() => toggle(i)} />
            <div>
              <Sourced quotes={quotes[i]} badge={<span className={`req ${item.required}`}>{LABEL[item.required]}</span>}>
                <label htmlFor={`item-${i}`} className={done.includes(i) ? "done" : undefined}>
                  {item.text}
                </label>
              </Sourced>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
