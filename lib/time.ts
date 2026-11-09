// Deadlines are written as wall-clock times in some zone. These helpers pin them to an instant.

const ABBREVIATIONS: Record<string, string> = {
  PT: "America/Los_Angeles",
  PST: "America/Los_Angeles",
  PDT: "America/Los_Angeles",
  MT: "America/Denver",
  MST: "America/Denver",
  MDT: "America/Denver",
  CT: "America/Chicago",
  CST: "America/Chicago",
  CDT: "America/Chicago",
  ET: "America/New_York",
  EST: "America/New_York",
  EDT: "America/New_York",
  AKT: "America/Anchorage",
  AKST: "America/Anchorage",
  AKDT: "America/Anchorage",
  HST: "Pacific/Honolulu",
  UTC: "UTC",
  GMT: "UTC",
  BST: "Europe/London",
  CET: "Europe/Paris",
  CEST: "Europe/Paris",
  IST: "Asia/Kolkata",
  SGT: "Asia/Singapore",
  JST: "Asia/Tokyo",
  AEST: "Australia/Sydney",
  AEDT: "Australia/Sydney",
  AOE: "Etc/GMT+12",
};

function isZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

const US_NAMES: Record<string, string> = {
  PACIFIC: "America/Los_Angeles",
  MOUNTAIN: "America/Denver",
  CENTRAL: "America/Chicago",
  EASTERN: "America/New_York",
};

/** Map what the page wrote ("PST", "Eastern Time") to an IANA zone. The table wins over the model's guess. */
export function resolveZone(zoneText: string, suggested: string): string | null {
  const text = zoneText.trim().toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  for (const token of text.split(" ")) {
    if (ABBREVIATIONS[token]) return ABBREVIATIONS[token];
  }
  // "Pacific Time", "US Eastern Standard Time" — but not "Central European Time".
  const named = /^(?:US )?(PACIFIC|MOUNTAIN|CENTRAL|EASTERN)(?: STANDARD| DAYLIGHT)?(?: TIME)?$/.exec(text);
  if (named) return US_NAMES[named[1]];
  return suggested && isZone(suggested) ? suggested : null;
}

function offsetMinutes(zone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** "2026-11-15T18:00" in America/Los_Angeles → the UTC instant, as an ISO string. */
export function localToUtc(local: string, zone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(local);
  if (!m) return null;
  // A date with no time means "by the end of that day".
  const [y, mo, d, h, mi] = [Number(m[1]), Number(m[2]), Number(m[3]), m[4] ? Number(m[4]) : 23, m[5] ? Number(m[5]) : 59];
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(wall)) return null;
  let guess = wall - offsetMinutes(zone, new Date(wall)) * 60000;
  // Second pass settles times that land near a daylight-saving change.
  guess = wall - offsetMinutes(zone, new Date(guess)) * 60000;
  return new Date(guess).toISOString();
}
