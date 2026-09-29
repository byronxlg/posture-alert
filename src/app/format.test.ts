import { describe, expect, it } from "vitest";
import { formatDuration } from "./format.ts";

describe("formatDuration", () => {
  it("says under a minute for the first minute", () => {
    expect(formatDuration(0)).toBe("under a minute");
    expect(formatDuration(59_999)).toBe("under a minute");
  });
  it("counts minutes, then hours and minutes", () => {
    expect(formatDuration(60_000)).toBe("1 min");
    expect(formatDuration(59 * 60_000)).toBe("59 min");
    expect(formatDuration(60 * 60_000)).toBe("1 h");
    expect(formatDuration(65 * 60_000)).toBe("1 h 5 min");
  });
});
