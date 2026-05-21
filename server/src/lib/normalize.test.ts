import { describe, it, expect } from "vitest";
import { matchCountry, normalize } from "./normalize.js";

describe("normalize", () => {
  it("strips accents and lowercases", () => {
    expect(normalize("États-Unis")).toBe("etats unis");
    expect(normalize("  CÔTE  D'IVOIRE  ")).toBe("cote d ivoire");
  });
});

describe("matchCountry (normal)", () => {
  it("matches by official name, alias, ISO, numeric", () => {
    expect(matchCountry("France", "normal")?.isoCode).toBe("FR");
    expect(matchCountry("USA", "normal")?.isoCode).toBe("US");
    expect(matchCountry("etats-unis", "normal")?.isoCode).toBe("US");
    expect(matchCountry("United Kingdom", "normal")?.isoCode).toBe("GB");
    expect(matchCountry("UK", "normal")?.isoCode).toBe("GB");
    expect(matchCountry("840", "normal")?.isoCode).toBe("US");
  });
  it("rejects fuzzy in normal mode", () => {
    expect(matchCountry("franse", "normal")).toBeNull();
  });
});

describe("matchCountry (easy)", () => {
  it("accepts small typos", () => {
    expect(matchCountry("franse", "easy")?.isoCode).toBe("FR");
    expect(matchCountry("germny", "easy")?.isoCode).toBe("DE");
  });
});
