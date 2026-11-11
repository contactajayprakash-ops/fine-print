// The shape of a finished brief, as stored and as rendered.

export type OpportunityKind =
  | "hackathon"
  | "scholarship"
  | "competition"
  | "program"
  | "fellowship"
  | "internship"
  | "grant"
  | "other";

/** A sentence we found on one of the pages, with enough around it to show where it sits. */
export interface Evidence {
  page: number;
  quote: string;
  /** The paragraph or list item the quote was found in. */
  context: string;
  /** Nearest heading above the quote, if the page has one. */
  section?: string;
  /** Link that opens the page scrolled to the quote (browsers that support text fragments). */
  href: string;
}

export interface WhenInfo {
  label: string;
  /** Wall-clock time as written on the page: 2026-11-15T18:00, or 2026-11-15 when no time is given. */
  local: string;
  hasTime: boolean;
  /** Time zone exactly as the page wrote it (PST, ET, "Pacific Time"), or "" if the page gave none. */
  zoneText: string;
  zone: string | null;
  /** Absolute instant, only when we could resolve the zone. */
  utc: string | null;
  evidence: Evidence[];
}

export type SchoolLevel = "middle_school" | "high_school" | "undergraduate" | "graduate" | "not_a_student";

export type EligibilityRule =
  | { type: "min_age"; value: number }
  | { type: "max_age"; value: number }
  | { type: "school_level"; levels: SchoolLevel[] }
  | { type: "country_only"; countries: string[] }
  | { type: "country_excluded"; countries: string[] }
  | { type: "other" };

export interface Requirement {
  text: string;
  rule: EligibilityRule;
  evidence: Evidence[];
}

export type PrizeKind = "cash" | "credit" | "subscription" | "scholarship" | "physical" | "recognition" | "other";

export interface Prize {
  name: string;
  value: string;
  kind: PrizeKind;
  conditions: string;
  evidence: Evidence[];
}

export interface SubmissionItem {
  text: string;
  required: "required" | "optional" | "unclear";
  evidence: Evidence[];
}

export interface Cost {
  text: string;
  amount: string;
  evidence: Evidence[];
}

export interface Criterion {
  name: string;
  detail: string;
  evidence: Evidence[];
}

export type FlagType = "contradiction" | "fee" | "rights" | "eligibility" | "deadline" | "privacy" | "vague" | "other";
export type Severity = "high" | "medium" | "low";

export interface Flag {
  type: FlagType;
  severity: Severity;
  title: string;
  explanation: string;
  evidence: Evidence[];
}

export interface OpenQuestion {
  question: string;
  why: string;
}

export interface PageRead {
  url: string;
  title: string;
  chars: number;
  ok: boolean;
}

export interface Brief {
  id: string;
  url: string;
  scannedAt: string;
  title: string;
  organizer: string;
  kind: OpportunityKind;
  summary: string;
  deadline: WhenInfo | null;
  dates: WhenInfo[];
  eligibility: Requirement[];
  team: { text: string; evidence: Evidence[] } | null;
  costs: Cost[];
  prizes: Prize[];
  submission: SubmissionItem[];
  judging: Criterion[];
  flags: Flag[];
  openQuestions: OpenQuestion[];
  contact: { email: string; evidence: Evidence[] } | null;
  pages: PageRead[];
  stats: {
    version?: number;
    model: string;
    quotesChecked: number;
    quotesDropped: number;
    /** Contradictions the first pass claimed and the second reader did not accept. */
    contradictionsOverruled?: number;
    seconds: number;
  };
}

/** Progress messages streamed to the browser while a scan runs. */
export type ScanEvent =
  | { type: "started"; id: string }
  | { type: "status"; message: string }
  | { type: "page"; url: string; title: string; chars: number; ok: boolean }
  | { type: "found"; count: number; reading: string[] }
  | { type: "done"; id: string; cached: boolean }
  | { type: "error"; message: string };
