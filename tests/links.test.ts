import assert from "node:assert/strict";
import { test } from "node:test";
import { isPublicHost, normalizeUrl, pickPages } from "../lib/links";
import { briefId } from "../lib/pipeline";

const html = `
  <a href="/rules">Rules</a> <a href="/participants">Participants</a>
  <a href="/details/dates">Schedule</a> <a href="https://elsewhere.test/faq">FAQ</a>
  <a href="/register?flow=1">Join</a> <a href="/blog/a-day-in-the-life">Stories</a>
  <a href="/logo.png">logo</a> <a href="#prizes">Prizes</a>`;

test("pages about rules and dates are picked; logins, images and other sites are not", () => {
  const start = new URL("https://contest.test/");
  const picked = pickPages(start, html, ["https://contest.test/faq", "https://contest.test/rules/"], 7);
  assert.deepEqual(picked, ["https://contest.test/rules", "https://contest.test/faq", "https://contest.test/details/dates"]);
});

test("the limit is respected and the starting page is never picked again", () => {
  const start = new URL("https://contest.test/rules");
  assert.deepEqual(pickPages(start, html, ["https://contest.test/rules"], 1).length, 1);
  assert.ok(!pickPages(start, html, [], 7).includes("https://contest.test/rules"));
});

test("addresses are tidied, and private ones refused", () => {
  assert.equal(normalizeUrl("contest.devpost.com/#prizes")?.href, "https://contest.devpost.com/");
  assert.equal(normalizeUrl("ftp://x.test"), null);
  assert.equal(normalizeUrl("   "), null);
  assert.equal(isPublicHost(new URL("http://localhost:3000")), false);
  assert.equal(isPublicHost(new URL("http://192.168.1.4/admin")), false);
  assert.equal(isPublicHost(new URL("https://example.org")), true);
});

test("the same page always gets the same brief id", () => {
  const a = briefId(new URL("https://www.Contest.test/apply/"));
  const b = briefId(new URL("https://contest.test/apply"));
  assert.equal(a, b);
  assert.match(a, /^contest-test-apply-[0-9a-f]{6}$/);
});

test("press releases, blogs and staff pages are left alone even when they mention awards", () => {
  const start = new URL("https://org.test/programs/summer-institute");
  const page = `
    <a href="/programs/summer-institute/application-faqs">FAQ</a>
    <a href="/newsevents/press-releases/students-earn-top-awards">Students earn awards</a>
    <a href="/about/leadership">Leadership</a> <a href="/blog/how-to-apply-anywhere">Blog</a>
    <a href="http://www.org.test/programs/apply">Apply</a> <a href="https://org.test/programs/apply/">Apply now</a>`;
  assert.deepEqual(pickPages(start, page, [], 7), ["https://org.test/programs/summer-institute/application-faqs", "http://www.org.test/programs/apply"]);
});
