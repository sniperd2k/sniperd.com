import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PADS, JACKPOT, initialState, applyHit } from "../src/awesome-pad.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "awesome.html"), "utf8");

describe("awesome box", () => {
  it("keeps the three facts, GA4, and Web Audio on the page", () => {
    for (const pad of PADS) {
      expect(html).toContain(`data-id="${pad.id}"`);
      expect(html).toContain(pad.line);
      expect(html).toContain(pad.kind);
    }
    expect(html).toContain("the Koponen (K-O-P-O-N-E-N) are awesome");
    expect(html).toContain("the Underwoods are awesome");
    expect(html).toContain("they had an awesome time at the Canonicus");
    expect(html).toContain("G-3Z1GXBW9W2");
    expect(html).toContain("webkitAudioContext");
    expect(html).toContain("AudioContext");
    expect(html).not.toMatch(/Copeland/i);
    expect(html).not.toMatch(/Kopanen/);
    expect(html).not.toContain("canonicus-family-dinner");
    expect(html).not.toMatch(/\bautoplay\b/i);
  });

  it("scores hits and only lights the sign after every family pad", () => {
    const kinds = new Set(PADS.map((p) => p.kind));
    expect(kinds.size).toBe(PADS.length);

    let state = initialState();
    state = applyHit(state, "underwoods");
    expect(state.unlocked).toBe(false);
    expect(state.score).toBe(100);

    state = applyHit(state, "canonicus");
    expect(state.unlocked).toBe(false);

    state = applyHit(state, "tubular");
    expect(state.unlocked).toBe(false);
    expect(state.score).toBe(225);

    state = applyHit(state, "koponen");
    expect(state.justUnlocked).toBe(true);
    expect(state.unlocked).toBe(true);
    expect(state.score).toBe(225 + 100 + JACKPOT);
    expect(state.pad.line).toBe("the Koponen (K-O-P-O-N-E-N) are awesome");

    const again = applyHit(state, "koponen");
    expect(again.justUnlocked).toBe(false);
    expect(again.pressed.filter((id) => id === "koponen")).toHaveLength(1);
    expect(again.score).toBe(state.score + 100);

    expect(() => applyHit(state, "nope")).toThrow(/unknown pad/);
  });
});
