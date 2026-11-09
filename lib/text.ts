// Turn scraped markdown into plain blocks of text, and find quotes inside them.
// Quotes are matched on words only, so differences in punctuation, case and markdown never matter.

export interface Block {
  text: string;
  /** Nearest heading above this block. */
  section: string;
}

export function toBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  let section = "";
  let para: string[] = [];

  const flush = () => {
    if (para.length) {
      const text = plain(para.join(" "));
      if (text) blocks.push({ text, section });
      para = [];
    }
  };

  for (const raw of markdown.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line || /^([-*_]\s*){3,}$/.test(line)) {
      flush();
      continue;
    }
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      section = plain(heading[1]);
      if (section) blocks.push({ text: section, section });
      continue;
    }
    if (/^([-*+]|\d+[.)])\s+/.test(line) || line.startsWith("|")) {
      flush();
      const text = plain(line.replace(/^([-*+]|\d+[.)])\s+/, "").replace(/\|/g, " "));
      if (text && !/^[-:\s]+$/.test(text)) blocks.push({ text, section });
      continue;
    }
    para.push(line);
  }
  flush();

  // Scraped pages often repeat whole sections (mobile and desktop copies of the same markup).
  // Keep the first copy of anything long enough to be a real sentence.
  const seen = new Set<string>();
  return blocks.filter((b) => {
    if (b.text.length < 30) return true;
    if (seen.has(b.text)) return false;
    seen.add(b.text);
    return true;
  });
}

/** Strip inline markdown down to the words a reader would see. */
export function plain(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\((?:[^()]|\([^)]*\))*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\\([\\`*_{}\[\]()#+\-.!|>~])/g, "$1")
    .replace(/(\*\*|__|~~|`)/g, "")
    .replace(/(^|\s)[*_](\S[^*_]*\S|\S)[*_](?=\s|[.,;:!?)]|$)/g, "$1$2")
    .replace(/^>\s?/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-–•·]\s+/, "");
}

interface Word {
  w: string;
  start: number;
  end: number;
}

function words(text: string): Word[] {
  const out: Word[] = [];
  const re = /[\p{L}\p{N}]+/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({ w: m[0].normalize("NFKC").toLowerCase(), start: m.index, end: m.index + m[0].length });
  }
  return out;
}

function findRun(hay: Word[], needle: string[]): number {
  if (needle.length === 0 || needle.length > hay.length) return -1;
  outer: for (let i = 0; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j].w !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

export interface Located {
  quote: string;
  context: string;
  section: string;
}

/**
 * Find where a quote really appears on a page. Returns the page's own wording
 * (not the model's), or null if the page never says it.
 */
export function locate(blocks: Block[], quote: string): Located | null {
  // A model sometimes joins two fragments with an ellipsis. Keep the longest real fragment.
  const fragments = quote.split(/\.{3,}|…/).map((f) => words(f).map((x) => x.w));
  const needle = fragments.sort((a, b) => b.length - a.length)[0] ?? [];
  if (needle.length === 0) return null;
  // Two or three common words would match almost anywhere, so a very short quote only counts
  // when it carries a number or makes up nearly the whole line it sits on ("Cost: Free").
  const short = needle.length < 3 && !needle.some((w) => /\d/.test(w));

  for (const block of blocks) {
    const hay = words(block.text);
    if (short && hay.length > needle.length + 2) continue;
    const at = findRun(hay, needle);
    if (at === -1) continue;
    const start = hay[at].start;
    let end = hay[at + needle.length - 1].end;
    // Take closing punctuation with the quote so it reads naturally.
    const tail = /^[.!?%+)"'’”]+/.exec(block.text.slice(end));
    if (tail) end += tail[0].length;
    // And a leading currency sign or opening quote.
    let from = start;
    while (from > 0 && /[$€£₹"'“‘(]/.test(block.text[from - 1])) from--;
    return { quote: block.text.slice(from, end).trim(), context: block.text, section: block.section };
  }
  return null;
}

/** A link that opens `url` scrolled to `quote`, using the text-fragment syntax. */
export function fragmentLink(url: string, quote: string): string {
  const enc = (s: string) => encodeURIComponent(s).replace(/-/g, "%2D");
  const parts = quote.split(/\s+/).filter(Boolean);
  const base = url.split("#")[0];
  if (parts.length <= 9) return `${base}#:~:text=${enc(parts.join(" "))}`;
  return `${base}#:~:text=${enc(parts.slice(0, 4).join(" "))},${enc(parts.slice(-4).join(" "))}`;
}
