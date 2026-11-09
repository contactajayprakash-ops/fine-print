"use client";

import { useState } from "react";

/** Turns the open questions into an email the reader can send. */
export function AskOrganizer({ subject, body, email }: { subject: string; body: string; email: string | null }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="ask">
      <button type="button" className="button quiet" onClick={copy}>
        {copied ? "Copied" : "Copy these as an email"}
      </button>
      {email && (
        <a className="button quiet" href={`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}>
          Write to {email}
        </a>
      )}
    </div>
  );
}
