import { test } from "node:test";
import assert from "node:assert/strict";
import { formatJarSize, formatPounds, formatWeight, jarsFrom, OZ_PER_LB, parseJarWeight, parseWeight, weightOfJars } from "./weight";

test("a whole number of pounds reads as pounds", () => {
  assert.equal(formatWeight(608), "38 lb");
});

test("a part pound keeps its ounces rather than rounding them away", () => {
  assert.equal(formatWeight(36), "2 lb 4 oz");
});

test("under a pound reads in ounces", () => {
  assert.equal(formatWeight(12), "12 oz");
  assert.equal(formatWeight(0), "0 oz");
});

test("a bare number typed into a weight box means pounds", () => {
  // Batches are weighed in pounds, so this is the common case.
  assert.equal(parseWeight("38"), 608);
  assert.equal(parseWeight("38 lb"), 608);
});

test("ounces are respected when actually written", () => {
  assert.equal(parseWeight("12 oz"), 12);
  assert.equal(parseWeight("12oz"), 12);
});

test("pounds and ounces together are read as one weight", () => {
  assert.equal(parseWeight("2 lb 4 oz"), 36);
});

test("half pounds survive the round trip", () => {
  assert.equal(parseWeight("38.5"), 616);
  assert.equal(formatWeight(616), "38 lb 8 oz");
});

test("nonsense is refused rather than read as zero", () => {
  for (const bad of ["", "   ", "abc", "12 kg", "-4", "1 lb 2"]) {
    assert.throws(() => parseWeight(bad), new RegExp("."), `"${bad}" should be refused`);
  }
});

test("a 16 oz jar takes about a pound", () => {
  assert.equal(weightOfJars(1, 16), 16);
  assert.equal(jarsFrom(608, 16), 38, "38 lb fills 38 of the small jars");
});

test("the same weight fills half as many of the big jars", () => {
  assert.equal(jarsFrom(608, 32), 19);
});

test("a part-full jar is not counted as a jar", () => {
  assert.equal(jarsFrom(40, 16), 2, "40 oz is two jars and a splash");
});

test("a jar with no weight set cannot be filled an infinite number of times", () => {
  assert.equal(jarsFrom(100, 0), 0);
});

test("pounds-only display stays short", () => {
  assert.equal(formatPounds(608), "38 lb");
  assert.equal(formatPounds(616), "38.5 lb");
});

test("a bare number in the jar box is ounces, not pounds", () => {
  assert.equal(parseJarWeight("11"), 11);
  assert.equal(parseJarWeight("16"), 16);
  assert.equal(parseJarWeight(" 32 "), 32);
});

test("the jar box honours a unit when one is spelled out", () => {
  assert.equal(parseJarWeight("11 oz"), 11);
  assert.equal(parseJarWeight("1 lb"), 16);
  assert.equal(parseJarWeight("1 lb 2 oz"), 18);
});

test("a jar has to hold something", () => {
  assert.throws(() => parseJarWeight(""));
  assert.throws(() => parseJarWeight("0"));
  assert.throws(() => parseJarWeight("0 oz"));
  assert.throws(() => parseJarWeight("small"));
  assert.throws(() => parseJarWeight("300 ml"));
});

test("an 11 oz jar fills from a batch like any other size", () => {
  const spare = 19 * OZ_PER_LB; // 304 oz
  assert.equal(jarsFrom(spare, 11), 27, "27 whole sample jars, and 7 oz left over");
  assert.equal(weightOfJars(27, 11), 297);
});

test("a jar size keeps its ounces instead of becoming pounds", () => {
  assert.equal(formatJarSize(11), "11 oz");
  assert.equal(formatJarSize(16), "16 oz");
  assert.equal(formatJarSize(32), "32 oz", "nobody asks for a 2 lb jar");
});
