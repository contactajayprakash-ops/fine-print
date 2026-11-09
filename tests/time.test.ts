import assert from "node:assert/strict";
import { test } from "node:test";
import { localToUtc, resolveZone } from "../lib/time";

test("zone abbreviations map to real zones, and the table beats the model's guess", () => {
  assert.equal(resolveZone("PST", ""), "America/Los_Angeles");
  assert.equal(resolveZone("Pacific Time (PT)", "Asia/Tokyo"), "America/Los_Angeles");
  assert.equal(resolveZone("ET", ""), "America/New_York");
  assert.equal(resolveZone("Central European Time", "Europe/Berlin"), "Europe/Berlin");
  assert.equal(resolveZone("", "America/Chicago"), null);
  assert.equal(resolveZone("somewhere", "Not/AZone"), null);
});

test("wall-clock times become the right instant on both sides of a clock change", () => {
  assert.equal(localToUtc("2026-11-15T18:00", "America/Los_Angeles"), "2026-11-16T02:00:00.000Z");
  assert.equal(localToUtc("2026-07-01T18:00", "America/Los_Angeles"), "2026-07-02T01:00:00.000Z");
  assert.equal(localToUtc("2026-03-31T23:59", "Asia/Kolkata"), "2026-03-31T18:29:00.000Z");
});

test("a date with no time means the end of that day", () => {
  assert.equal(localToUtc("2026-07-01", "America/New_York"), "2026-07-02T03:59:00.000Z");
  assert.equal(localToUtc("July 1", "America/New_York"), null);
});
