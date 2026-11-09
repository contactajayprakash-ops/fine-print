import assert from "node:assert/strict";
import { test } from "node:test";
import type { Draft, PageText } from "../lib/extract";
import { toBlocks } from "../lib/text";
import { buildBrief } from "../lib/verify";

const pages: PageText[] = [
  { url: "https://contest.test/", title: "Contest", blocks: toBlocks("Entries close **March 3, 2027 at 5:00 PM**.\n\nThe winner receives $500 in cash.\n\nThere are no cash prizes.") },
  { url: "https://contest.test/rules", title: "Rules", blocks: toBlocks("## Entry\n\nA $25 entry fee applies to every team.") },
];

const empty: Draft = {
  title: "Contest", organizer: "", kind: "competition", summary: "", deadline: null, dates: [], eligibility: [], team: null,
  costs: [], prizes: [], submission: [], judging: [], flags: [], openQuestions: [], contactEmail: null,
};

test("items whose quotes are not on the page are dropped and counted", () => {
  const out = buildBrief(
    {
      ...empty,
      prizes: [
        { name: "Winner", value: "$500", kind: "cash", conditions: "", evidence: [{ page: 1, quote: "The winner receives $500 in cash." }] },
        { name: "Winner", value: "A laptop", kind: "physical", conditions: "", evidence: [{ page: 1, quote: "The winner also receives a new laptop." }] },
        { name: "Winner", value: "A trophy", kind: "physical", conditions: "", evidence: [{ page: 9, quote: "The winner receives $500 in cash." }] },
      ],
    },
    pages,
  );
  assert.deepEqual(out.prizes.map((p) => p.value), ["$500"]);
  assert.equal(out.checked, 3);
  assert.equal(out.dropped, 2);
});

test("a contradiction needs both sides confirmed", () => {
  const flag = (second: string) => ({
    type: "contradiction", severity: "high", title: "Cash or no cash", explanation: "The pages disagree.",
    evidence: [{ page: 1, quote: "There are no cash prizes." }, { page: 1, quote: second }],
  });
  assert.equal(buildBrief({ ...empty, flags: [flag("The winner receives $500 in cash.")] }, pages).flags.length, 1);
  assert.equal(buildBrief({ ...empty, flags: [flag("The winner receives $5,000 in cash.")] }, pages).flags.length, 0);
});

test("a deadline with no time zone gets flagged without the model's help", () => {
  const out = buildBrief(
    { ...empty, deadline: { label: "Entries close", local: "2027-03-03T17:00", zoneText: "", ianaZone: "America/New_York", evidence: [{ page: 1, quote: "Entries close March 3, 2027 at 5:00 PM." }] } },
    pages,
  );
  assert.equal(out.deadline?.utc, null);
  assert.equal(out.flags[0]?.type, "deadline");
  assert.equal(out.flags[0]?.evidence[0].href, "https://contest.test/#:~:text=Entries%20close%20March%203%2C%202027%20at%205%3A00%20PM.");
});

test("flags are ordered by severity and junk values fall back safely", () => {
  const out = buildBrief(
    {
      ...empty,
      kind: "pyramid scheme",
      flags: [
        { type: "nonsense", severity: "low", title: "Low one", explanation: "", evidence: [{ page: 1, quote: "There are no cash prizes." }] },
        { type: "fee", severity: "high", title: "There is an entry fee", explanation: "", evidence: [{ page: 2, quote: "A $25 entry fee applies to every team." }] },
      ],
    },
    pages,
  );
  assert.equal(out.kind, "other");
  assert.deepEqual(out.flags.map((f) => [f.type, f.severity]), [["fee", "high"], ["other", "low"]]);
  assert.equal(out.flags[0].evidence[0].section, "Entry");
});
