import { describe, it, expect } from "vitest";
import { schedulerFrom, defaultsFromSamples, supportFor, ecosystemOf, dimensionsFor } from "@/media/civitai";

// Everything here was learned the expensive way, against the live API with real Buzz. These pin it
// down so the next change to model resolution cannot quietly undo any of it.

describe("schedulerFrom", () => {
  it("maps sampler names as written in image metadata onto Civitai's enum", () => {
    expect(schedulerFrom("Euler a")).toBe("eulerA");
    expect(schedulerFrom("Euler")).toBe("euler");
    expect(schedulerFrom("DPM++ 2M Karras")).toBe("dpM2MKarras");
    expect(schedulerFrom("DPM++ SDE Karras")).toBe("dpmsdeKarras");
    expect(schedulerFrom("UniPC")).toBe("uniPC");
  });

  it("ignores case and punctuation, since metadata is not consistent about either", () => {
    expect(schedulerFrom("euler_a")).toBe("eulerA");
    expect(schedulerFrom("dpm++ 2m karras")).toBe("dpM2MKarras");
  });

  it("returns undefined for anything it does not know rather than guessing", () => {
    expect(schedulerFrom("Restart")).toBeUndefined();
    expect(schedulerFrom(42)).toBeUndefined();
    expect(schedulerFrom(undefined)).toBeUndefined();
  });
});

describe("defaultsFromSamples", () => {
  it("takes the most common value of each field across the samples", () => {
    const images = [
      { meta: { steps: 30, cfgScale: 4, sampler: "Euler a" } },
      { meta: { steps: 30, cfgScale: 4, sampler: "Euler a" } },
      { meta: { steps: 50, cfgScale: 8, sampler: "DPM++ 2M Karras" } },
    ];
    expect(defaultsFromSamples(images)).toEqual({ steps: 30, cfgScale: 4, scheduler: "eulerA" });
  });

  it("skips samples that carry a workflow dump instead of parameters", () => {
    const images = [{ meta: { comfy: { prompt: {} } } }, { meta: { steps: 25, cfgScale: 6, sampler: "Euler" } }];
    expect(defaultsFromSamples(images)).toEqual({ steps: 25, cfgScale: 6, scheduler: "euler" });
  });

  it("omits fields it cannot fill rather than inventing them", () => {
    expect(defaultsFromSamples([{ meta: { steps: 20 } }])).toEqual({ steps: 20 });
    expect(defaultsFromSamples([{ meta: { sampler: "Nonsense" } }])).toEqual({});
  });

  it("is empty for no samples, missing samples, or samples without metadata", () => {
    expect(defaultsFromSamples([])).toEqual({});
    expect(defaultsFromSamples(undefined)).toEqual({});
    expect(defaultsFromSamples([{}, { meta: null }])).toEqual({});
  });
});

describe("supportFor", () => {
  it("recognises the bases confirmed to generate", () => {
    for (const base of ["SDXL 1.0", "Pony", "Illustrious", "Flux.1 D", "SD 1.5", "NoobAI"]) {
      expect(supportFor(base), base).toBe("supported");
    }
  });

  it("refuses Anima, which was accepted, charged and failed on every attempt", () => {
    expect(supportFor("Anima")).toBe("unsupported");
    expect(supportFor("anima")).toBe("unsupported");
  });

  it("only cautions about a base it has never seen, since the lists will age", () => {
    expect(supportFor("Something New")).toBe("unknown");
    expect(supportFor("")).toBe("unknown");
  });
});

describe("ecosystemOf", () => {
  it("reads the ecosystem segment out of an AIR without any lookup", () => {
    expect(ecosystemOf("urn:air:anima:checkpoint:civitai:1318945@3289643")).toBe("anima");
    expect(ecosystemOf("urn:air:sdxl:checkpoint:civitai:101055@128078")).toBe("sdxl");
  });

  it("is empty for something that is not an AIR", () => {
    expect(ecosystemOf("not an air")).toBe("");
    expect(ecosystemOf("")).toBe("");
  });
});

describe("dimensionsFor", () => {
  it("maps each offered ratio to an SDXL training bucket", () => {
    expect(dimensionsFor("1:1")).toEqual({ width: 1024, height: 1024 });
    expect(dimensionsFor("16:9")).toEqual({ width: 1344, height: 768 });
    expect(dimensionsFor("2:3")).toEqual({ width: 832, height: 1216 });
  });

  it("falls back to square for a ratio it does not know", () => {
    expect(dimensionsFor("5:4")).toEqual({ width: 1024, height: 1024 });
  });
});
