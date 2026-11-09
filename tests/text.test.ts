import assert from "node:assert/strict";
import { test } from "node:test";
import { fragmentLink, locate, plain, toBlocks } from "../lib/text";

const page = toBlocks(`
### 4\\. Submission and Judging

- **Project Demonstration:** A working prototype is required. A demo video under three minutes is optional but recommended.

**Cost:** Free

\\- $2,000 in credits for each team member (for projects built on [Momen](https://momen.app))

Read the [official rules](https://example.com/rules) before you start. Read them twice.
`);

test("markdown is reduced to the words a reader sees", () => {
  assert.equal(plain("**Cost:** Free"), "Cost: Free");
  assert.equal(plain("see the [rules](https://x.test/a_(b)) now"), "see the rules now");
  assert.equal(plain("\\- one item"), "one item");
});

test("a quote is found whatever its punctuation or case", () => {
  const hit = locate(page, "a demo video under three minutes is OPTIONAL but recommended");
  assert.ok(hit);
  assert.equal(hit.quote, "A demo video under three minutes is optional but recommended.");
  assert.equal(hit.section, "4. Submission and Judging");
  assert.match(hit.context, /^Project Demonstration:/);
});

test("the page's wording is returned, not the model's", () => {
  const hit = locate(page, "2,000 in credits for each team member");
  assert.equal(hit?.quote, "$2,000 in credits for each team member");
});

test("a sentence the page never says is rejected", () => {
  assert.equal(locate(page, "A demo video is strictly required for all teams"), null);
  assert.equal(locate(page, ""), null);
});

test("two-word quotes only count when they are nearly the whole line", () => {
  assert.equal(locate(page, "Cost: Free")?.quote, "Cost: Free");
  assert.equal(locate(page, "the official"), null);
});

test("an ellipsis falls back to the longest real fragment", () => {
  const hit = locate(page, "A working prototype... A demo video under three minutes is optional");
  assert.equal(hit?.quote, "A demo video under three minutes is optional");
});

test("text-fragment links survive dashes and long quotes", () => {
  assert.equal(fragmentLink("https://x.test/rules#top", "non-cash rewards"), "https://x.test/rules#:~:text=non%2Dcash%20rewards");
  const long = fragmentLink("https://x.test/", "one two three four five six seven eight nine ten eleven");
  assert.equal(long, "https://x.test/#:~:text=one%20two%20three%20four,eight%20nine%20ten%20eleven");
});

test("repeated sections are only kept once", () => {
  const twice = toBlocks("All prizes are sponsor credits and subscriptions.\n\nShort\n\nAll prizes are sponsor credits and subscriptions.\n\nShort");
  assert.deepEqual(twice.map((b) => b.text), ["All prizes are sponsor credits and subscriptions.", "Short", "Short"]);
});
