// Check a model's draft against the pages it was written from, and build the brief we actually show.
// Anything whose quotes can't be found on the page is dropped.

import type { Draft, DraftEvidence, DraftWhen, PageText } from "./extract";
import { fragmentLink, locate } from "./text";
import { localToUtc, resolveZone } from "./time";
import type {
  Brief,
  EligibilityRule,
  Evidence,
  Flag,
  FlagType,
  OpportunityKind,
  PrizeKind,
  SchoolLevel,
  Severity,
  WhenInfo,
} from "./types";

const clean = (s: unknown, max = 400) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");
const list = <T>(v: T[] | undefined | null): T[] => (Array.isArray(v) ? v : []);

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function buildBrief(draft: Draft, pages: PageText[]): Omit<Brief, "id" | "url" | "scannedAt" | "pages" | "stats"> & { checked: number; dropped: number } {
  let checked = 0;
  let dropped = 0;

  const confirm = (items: DraftEvidence[] | undefined): Evidence[] => {
    const out: Evidence[] = [];
    for (const item of list(items)) {
      checked++;
      const page = pages[Number(item?.page) - 1];
      const found = page && typeof item.quote === "string" ? locate(page.blocks, item.quote) : null;
      if (!page || !found) {
        dropped++;
        continue;
      }
      if (out.some((e) => e.page === item.page - 1 && e.quote === found.quote)) continue;
      out.push({
        page: item.page - 1,
        quote: found.quote,
        context: found.context.slice(0, 700),
        section: found.section && found.section !== found.context ? found.section : undefined,
        href: fragmentLink(page.url, found.quote),
      });
    }
    return out;
  };

  const toWhen = (d: DraftWhen | null | undefined): WhenInfo | null => {
    if (!d) return null;
    const local = clean(d.local, 20);
    if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(local)) return null;
    const ev = confirm(d.evidence);
    if (ev.length === 0) return null;
    // A time zone only counts if it is written in the passages quoted for this date.
    const claimedZone = clean(d.zoneText, 40);
    const stated = claimedZone && ev.some((e) => e.context.toLowerCase().includes(claimedZone.toLowerCase()));
    const zoneText = stated ? claimedZone : "";
    const zone = resolveZone(zoneText, clean(d.ianaZone, 60));
    return {
      label: clean(d.label, 80) || "Deadline",
      local,
      hasTime: local.includes("T"),
      zoneText,
      zone,
      utc: zone ? localToUtc(local, zone) : null,
      evidence: ev,
    };
  };

  // Keep only items that still have at least one confirmed quote.
  const grounded = <T extends { evidence: DraftEvidence[] }, R>(items: T[] | undefined, make: (item: T, ev: Evidence[]) => R | null): R[] => {
    const out: R[] = [];
    for (const item of list(items)) {
      const ev = confirm(item?.evidence);
      if (ev.length === 0) continue;
      const made = make(item, ev);
      if (made) out.push(made);
    }
    return out;
  };

  const deadline = toWhen(draft.deadline);

  // The model is told to name pages, not number them, but "Page 2" still slips through now and then.
  // The reader never sees page numbers anywhere else, so swap in a name they can recognise.
  const namePages = (text: string): string =>
    text.replace(/\b(the )?page (\d+)\b/gi, (whole, _the, n: string, at: number) => {
      const page = pages[Number(n) - 1];
      if (!page) return whole;
      let name = "the main page";
      try {
        const path = decodeURIComponent(new URL(page.url).pathname).replace(/\/$/, "");
        if (Number(n) > 1 && path) name = `the ${path} page`;
      } catch {
        // keep the generic name
      }
      return at === 0 ? name[0].toUpperCase() + name.slice(1) : name;
    });

  const flags: Flag[] = grounded(draft.flags, (f, ev) => {
    const type = pick<FlagType>(f.type, ["contradiction", "fee", "rights", "eligibility", "deadline", "privacy", "vague", "other"], "other");
    // A contradiction needs both sides on the record.
    if (type === "contradiction" && ev.length < 2) return null;
    const title = namePages(clean(f.title, 120));
    if (!title) return null;
    return {
      type,
      severity: pick<Severity>(f.severity, ["high", "medium", "low"], "medium"),
      title,
      explanation: namePages(clean(f.explanation, 500)),
      evidence: ev.slice(0, 3),
    };
  }).slice(0, 8);

  // This one doesn't need a model: a time with no zone is ambiguous for anyone outside the organizer's city.
  if (deadline && !deadline.zoneText && !flags.some((f) => f.type === "deadline")) {
    flags.push({
      type: "deadline",
      severity: deadline.hasTime ? "medium" : "low",
      title: deadline.hasTime ? "The deadline doesn't say which time zone" : "The deadline has no time of day or time zone",
      explanation: "Depending on where the organizer is, the real cutoff could be hours earlier or later than it looks from where you are. Ask, or submit a day early.",
      evidence: deadline.evidence.slice(0, 1),
    });
  }
  const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  flags.sort((a, b) => rank[a.severity] - rank[b.severity]);

  const levels: readonly SchoolLevel[] = ["middle_school", "high_school", "undergraduate", "graduate", "not_a_student"];

  const contactEv = draft.contactEmail ? confirm(draft.contactEmail.evidence) : [];
  const email = clean(draft.contactEmail?.email, 120);

  return {
    title: clean(draft.title, 140) || "Untitled",
    organizer: clean(draft.organizer, 120),
    kind: pick<OpportunityKind>(draft.kind, ["hackathon", "scholarship", "competition", "program", "fellowship", "internship", "grant", "other"], "other"),
    summary: clean(draft.summary, 320),
    deadline,
    dates: list(draft.dates).map(toWhen).filter((d): d is WhenInfo => d !== null).slice(0, 8),
    eligibility: grounded(draft.eligibility, (e, ev) => {
      const text = clean(e.text, 260);
      if (!text) return null;
      let rule: EligibilityRule = { type: "other" };
      const n = Number(e.number);
      const countries = list(e.countries).map((c) => clean(c, 60)).filter(Boolean);
      const allowed = list(e.levels).filter((l): l is SchoolLevel => levels.includes(l as SchoolLevel));
      if (e.ruleType === "min_age" && n > 0 && n < 100) rule = { type: "min_age", value: n };
      else if (e.ruleType === "max_age" && n > 0 && n < 100) rule = { type: "max_age", value: n };
      else if (e.ruleType === "school_level" && allowed.length) rule = { type: "school_level", levels: allowed };
      else if (e.ruleType === "country_only" && countries.length) rule = { type: "country_only", countries };
      else if (e.ruleType === "country_excluded" && countries.length) rule = { type: "country_excluded", countries };
      return { text, rule, evidence: ev.slice(0, 2) };
    }),
    team: (() => {
      if (!draft.team) return null;
      const ev = confirm(draft.team.evidence);
      const text = clean(draft.team.text, 160);
      return ev.length && text ? { text, evidence: ev.slice(0, 2) } : null;
    })(),
    costs: grounded(draft.costs, (c, ev) => ({ text: clean(c.text, 240), amount: clean(c.amount, 40), evidence: ev.slice(0, 2) })),
    prizes: grounded(draft.prizes, (p, ev) => {
      const value = clean(p.value, 160);
      if (!value) return null;
      return {
        name: clean(p.name, 80),
        value,
        kind: pick<PrizeKind>(p.kind, ["cash", "credit", "subscription", "scholarship", "physical", "recognition", "other"], "other"),
        conditions: clean(p.conditions, 240),
        evidence: ev.slice(0, 2),
      };
    }).slice(0, 24),
    submission: grounded(draft.submission, (s, ev) => {
      const text = clean(s.text, 240);
      if (!text) return null;
      return { text, required: pick(s.required, ["required", "optional", "unclear"] as const, "unclear"), evidence: ev.slice(0, 2) };
    }),
    judging: grounded(draft.judging, (j, ev) => ({ name: clean(j.name, 80), detail: clean(j.detail, 240), evidence: ev.slice(0, 1) })).filter((j) => j.name),
    flags,
    openQuestions: list(draft.openQuestions)
      .map((q) => ({ question: clean(q?.question, 220), why: clean(q?.why, 220) }))
      .filter((q) => q.question)
      .slice(0, 6),
    contact: contactEv.length && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { email, evidence: contactEv.slice(0, 1) } : null,
    checked,
    dropped,
  };
}
