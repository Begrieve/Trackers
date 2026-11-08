import { test } from "node:test";
import assert from "node:assert/strict";
import { ageInDays, formatAge, shortAge } from "./age";

const NOW = new Date(2026, 10, 8, 14, 0, 0); // 8 Nov 2026, afternoon
const daysBefore = (n: number, hour = 9) =>
  new Date(2026, 10, 8 - n, hour, 0, 0);

test("age counts calendar days, not elapsed hours", () => {
  // Made yesterday evening, read the next morning: one day old, not zero.
  assert.equal(ageInDays(new Date(2026, 10, 7, 23, 0), NOW), 1);
});

test("something made today reads as today", () => {
  assert.equal(formatAge(daysBefore(0), NOW), "today");
  assert.equal(shortAge(daysBefore(0), NOW), "today");
});

test("yesterday is named rather than counted", () => {
  assert.equal(formatAge(daysBefore(1), NOW), "yesterday");
});

test("the first fortnight is counted in days", () => {
  assert.equal(formatAge(daysBefore(9), NOW), "9 days old");
  assert.equal(shortAge(daysBefore(9), NOW), "9d");
});

test("past a fortnight it rounds to weeks", () => {
  assert.equal(formatAge(daysBefore(21), NOW), "3 weeks old");
  assert.equal(shortAge(daysBefore(21), NOW), "3w");
});

test("past two months it rounds to months", () => {
  assert.equal(formatAge(daysBefore(95), NOW), "3 months old");
  assert.equal(shortAge(daysBefore(95), NOW), "3mo");
});

test("a batch dated in the future is not reported as aged", () => {
  assert.equal(formatAge(new Date(2026, 10, 20), NOW), "not yet made");
  assert.equal(shortAge(new Date(2026, 10, 20), NOW), "—");
});

test("a very old batch reads in years", () => {
  assert.equal(formatAge(new Date(2024, 10, 8), NOW), "2 years old");
});
