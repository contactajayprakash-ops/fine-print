import { around, pageLabel } from "@/lib/format";
import type { Evidence, PageRead } from "@/lib/types";

/** One quoted sentence, highlighted inside the paragraph it came from. */
export function Quote({ evidence, pages }: { evidence: Evidence; pages: PageRead[] }) {
  const { before, quote, after } = around(evidence);
  const page = pages[evidence.page];
  return (
    <div className="quote">
      <blockquote cite={page?.url}>
        {before}
        <mark>{quote}</mark>
        {after}
      </blockquote>
      <p className="where">
        {page ? pageLabel(page.url) : "Source page"}
        {evidence.section ? `, under “${evidence.section}”` : ""}.{" "}
        <a href={evidence.href} target="_blank" rel="noopener noreferrer">
          Open the page at this sentence
        </a>
      </p>
    </div>
  );
}

export function Quotes({ evidence, pages }: { evidence: Evidence[]; pages: PageRead[] }) {
  return (
    <>
      {evidence.map((e, i) => (
        <Quote key={i} evidence={e} pages={pages} />
      ))}
    </>
  );
}
