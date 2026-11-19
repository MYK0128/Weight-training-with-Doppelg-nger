import assert from "node:assert/strict";
import test from "node:test";
import { localDate } from "../lib/local-date";

test("date input uses the browser calendar day, including across UTC midnight", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "Asia/Tokyo";
    assert.equal(localDate(new Date("2026-11-19T15:30:00Z")), "2026-11-20");
    process.env.TZ = "America/Los_Angeles";
    assert.equal(localDate(new Date("2026-11-20T01:30:00Z")), "2026-11-19");
    assert.equal(localDate(new Date("2026-01-02T12:00:00Z")), "2026-01-02");
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
