"use client";

import type { ReactNode } from "react";
import type { EligibilityRule, Requirement, SchoolLevel } from "@/lib/types";
import { useStored } from "@/lib/use-stored";
import { Sourced } from "./Sourced";

interface Me {
  age: string;
  level: SchoolLevel | "";
  country: string;
}

type Fit = "yes" | "no" | "unknown";

const STORAGE_KEY = "fineprint.me";
const NOBODY: Me = { age: "", level: "", country: "" };

const LEVELS: [SchoolLevel, string][] = [
  ["middle_school", "Middle school"],
  ["high_school", "High school"],
  ["undergraduate", "College or university"],
  ["graduate", "Graduate school"],
  ["not_a_student", "Not a student"],
];

const US = ["us", "usa", "united states", "united states of america", "america"];
const UK = ["uk", "united kingdom", "great britain", "britain", "england"];

function sameCountry(a: string, b: string): boolean {
  const x = a.trim().toLowerCase().replace(/\./g, "");
  const y = b.trim().toLowerCase().replace(/\./g, "");
  if (x === y) return true;
  return (US.includes(x) && US.includes(y)) || (UK.includes(x) && UK.includes(y));
}

function fits(rule: EligibilityRule, me: Me): Fit {
  const age = Number(me.age);
  switch (rule.type) {
    case "min_age":
      return me.age ? (age >= rule.value ? "yes" : "no") : "unknown";
    case "max_age":
      return me.age ? (age <= rule.value ? "yes" : "no") : "unknown";
    case "school_level":
      return me.level ? (rule.levels.includes(me.level) ? "yes" : "no") : "unknown";
    case "country_only":
      return me.country.trim() ? (rule.countries.some((c) => sameCountry(c, me.country)) ? "yes" : "no") : "unknown";
    case "country_excluded":
      return me.country.trim() ? (rule.countries.some((c) => sameCountry(c, me.country)) ? "no" : "yes") : "unknown";
    default:
      return "unknown";
  }
}

const VERDICT: Record<Fit, string> = { yes: "You fit", no: "You don't fit", unknown: "Check yourself" };

export function Eligibility({ requirements, quotes }: { requirements: Requirement[]; quotes: ReactNode[] }) {
  const [saved, save, loaded] = useStored<Partial<Me>>(STORAGE_KEY, NOBODY);
  const me: Me = { ...NOBODY, ...saved };
  const update = (patch: Partial<Me>) => save({ ...me, ...patch });

  const answered = loaded && Boolean(me.age || me.level || me.country.trim());
  const results = requirements.map((r) => fits(r.rule, me));
  const misses = results.filter((r) => r === "no").length;
  const open = results.filter((r) => r === "unknown").length;

  let overall = "";
  if (answered) {
    if (misses) overall = misses === 1 ? "One requirement rules you out." : `${misses} requirements rule you out.`;
    else if (open) overall = `Nothing rules you out so far. ${open} ${open === 1 ? "requirement needs" : "requirements need"} a check by you.`;
    else overall = "You meet every requirement listed.";
  }

  return (
    <>
      <div className="about-you">
        <label>
          Your age
          <input type="number" inputMode="numeric" min={5} max={99} value={me.age} onChange={(e) => update({ age: e.target.value })} />
        </label>
        <label>
          You are in
          <select value={me.level} onChange={(e) => update({ level: e.target.value as Me["level"] })}>
            <option value="">Choose</option>
            {LEVELS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Country
          <input type="text" autoComplete="country-name" value={me.country} onChange={(e) => update({ country: e.target.value })} />
        </label>
        <p className="hint">Fill in what you like to see how the rules apply to you. This stays in your browser and is never sent anywhere.</p>
      </div>

      {overall && (
        <p className="overall" role="status">
          {overall}
        </p>
      )}

      <ul className="lines">
        {requirements.map((r, i) => (
          <li key={i}>
            <Sourced quotes={quotes[i]} badge={answered ? <span className={`verdict ${results[i]}`}>{VERDICT[results[i]]}</span> : null}>
              {r.text}
            </Sourced>
          </li>
        ))}
      </ul>
    </>
  );
}
