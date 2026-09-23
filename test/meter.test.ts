import { describe, expect, it } from "vitest";
import * as Meter from "@/core/Meter";

describe("Meter.deltaOf", () => {
  it("reads a rise as a positive delta sized by the magnitude level", () => {
    expect(Meter.deltaOf(0.9, 2)).toBe(8);
  });

  it("reads a fall as a negative delta of the same size", () => {
    expect(Meter.deltaOf(0.1, 2)).toBe(-8);
  });

  it("treats an exact half as a rise, the same threshold `optionsSound` uses", () => {
    expect(Meter.deltaOf(0.5, 1)).toBe(3);
  });

  it("moves nothing at the lowest magnitude level", () => {
    expect(Meter.deltaOf(0.9, 0)).toBe(0);
    expect(Meter.deltaOf(0.1, 0)).toBe(0);
  });

  it("clamps a magnitude score outside the rubric to its nearest level", () => {
    expect(Meter.deltaOf(0.9, 4)).toBe(25);
    expect(Meter.deltaOf(0.9, 10)).toBe(25);
    expect(Meter.deltaOf(0.9, -3)).toBe(0);
  });
});

describe("Meter.apply", () => {
  it("adds a delta and stays within range", () => {
    expect(Meter.apply(50, 8)).toBe(58);
    expect(Meter.apply(50, -8)).toBe(42);
  });

  it("clamps at the top of the scale", () => {
    expect(Meter.apply(95, 25)).toBe(100);
  });

  it("clamps at the bottom of the scale", () => {
    expect(Meter.apply(5, -25)).toBe(1);
  });
});

describe("Meter.goldOf", () => {
  it("reads a ladder rung back as the coin amount it stands for", () => {
    expect(Meter.goldOf("50")).toBe(50);
    expect(Meter.goldOf("800")).toBe(800);
  });

  it("reads the no-transaction rung as zero", () => {
    expect(Meter.goldOf("0")).toBe(0);
  });

  it("falls back to zero for a label that is not on the ladder", () => {
    expect(Meter.goldOf("999")).toBe(0);
    expect(Meter.goldOf("")).toBe(0);
  });
});

describe("Meter.goldLadder", () => {
  it("offers a criterion for every rung, and none for anything else", () => {
    expect(Object.keys(Meter.goldLadderCriteria).sort()).toEqual(
      Meter.goldLadder.map(String).sort(),
    );
  });

  it("starts at zero and ascends, so the nearest rung is always meaningful", () => {
    expect(Meter.goldLadder[0]).toBe(0);
    const ascending = [...Meter.goldLadder].every(
      (coins, index) => index === 0 || coins > Meter.goldLadder[index - 1],
    );
    expect(ascending).toBe(true);
  });

  // `choice` rejects a 256th option with an HTTP 400; staying well under keeps headroom
  // if the ladder ever grows, and is the hard ceiling this list must never cross.
  it("stays under the 255-option cap `choice` enforces", () => {
    expect(Meter.goldLadder.length).toBeLessThan(255);
  });
});

describe("Meter.bandOf", () => {
  it("bands the 1-100 scale into five named ranges", () => {
    expect(Meter.bandOf(5)).toBe("very-low");
    expect(Meter.bandOf(25)).toBe("low");
    expect(Meter.bandOf(50)).toBe("mid");
    expect(Meter.bandOf(75)).toBe("high");
    expect(Meter.bandOf(95)).toBe("very-high");
  });

  it("treats the band edges as belonging to the higher band", () => {
    expect(Meter.bandOf(20)).toBe("low");
    expect(Meter.bandOf(40)).toBe("mid");
    expect(Meter.bandOf(60)).toBe("high");
    expect(Meter.bandOf(80)).toBe("very-high");
  });
});
