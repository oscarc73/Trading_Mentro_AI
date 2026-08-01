import { describe, expect, it } from "vitest";
import { calculateGrossPnl, calculateReturnPercent } from "./trading";

describe("trading calculations", () => {
  it.each([
    ["long", 100, 110, 10],
    ["long", 100, 90, -10],
    ["long", 100, 100, 0],
    ["short", 100, 90, 10],
    ["short", 100, 110, -10],
    ["short", 100, 100, 0],
  ] as const)("calculates %s P&L", (direction, entry, exit, expected) => {
    expect(calculateGrossPnl(direction, entry, exit)).toBe(expected);
  });

  it("uses absolute entry notional for return", () =>
    expect(calculateReturnPercent(10, 100)).toBe(10));
  it.each([[0], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    "rejects invalid entry notional",
    (entry) => {
      expect(() => calculateReturnPercent(10, entry)).toThrow();
    },
  );
});
