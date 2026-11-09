"use client";

import { asWritten } from "@/lib/format";
import type { WhenInfo } from "@/lib/types";
import { useNow } from "@/lib/use-stored";

function timeLeft(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days >= 2) return `${days} days and ${hours} ${hours === 1 ? "hour" : "hours"} from now`;
  if (days === 1) return `1 day and ${hours} ${hours === 1 ? "hour" : "hours"} from now`;
  if (hours >= 1) return `${hours} ${hours === 1 ? "hour" : "hours"} and ${minutes % 60} minutes from now`;
  return `${Math.max(minutes, 0)} minutes from now`;
}

/** The deadline in the reader's own time zone, once the browser can tell us what that is. */
export function Deadline({ when }: { when: WhenInfo }) {
  const now = useNow();

  const written = `${asWritten(when.local, when.hasTime)}${when.zoneText ? ` ${when.zoneText}` : ""}`;

  if (!when.utc) {
    // With no zone we can't name the exact minute, but a day and a half later it has passed everywhere on Earth.
    const latest = Date.parse(`${when.local.slice(0, 10)}T23:59:00Z`) + 14 * 60 * 60 * 1000;
    return (
      <>
        <p className="answer">{written}</p>
        {now !== null && now > latest ? (
          <p className="passed">This deadline has passed.</p>
        ) : (
          <p className="answer-sub">
            The pages don&rsquo;t give a time zone, so this is the organizer&rsquo;s clock. It may not match yours.
          </p>
        )}
      </>
    );
  }

  const at = new Date(when.utc);
  if (now === null) {
    // Same on server and first client render; the local version replaces it after mount.
    return (
      <>
        <p className="answer">{written}</p>
        <p className="answer-sub muted">Working out your local time&hellip;</p>
      </>
    );
  }

  const mine = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: when.hasTime ? "numeric" : undefined,
    minute: when.hasTime ? "2-digit" : undefined,
    timeZoneName: when.hasTime ? "short" : undefined,
  }).format(at);
  const passed = at.getTime() < now;

  return (
    <>
      <p className="answer">{mine}</p>
      {passed ? (
        <p className="passed">This deadline has passed.</p>
      ) : (
        <p className="answer-sub">That&rsquo;s {timeLeft(at.getTime() - now)}, in your time zone.</p>
      )}
      <p className="answer-sub muted">On the page: {written}</p>
    </>
  );
}
