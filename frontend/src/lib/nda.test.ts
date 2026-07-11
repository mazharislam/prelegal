import { describe, expect, it } from "vitest";

import {
  DEFAULT_VALUES,
  documentFileName,
  formatEffectiveDate,
  missingFields,
  type NdaValues,
  resolveField,
} from "./nda";
import { clausesReferencing, STANDARD_TERMS } from "./standard-terms";

const values = (overrides: Partial<NdaValues> = {}): NdaValues => ({
  ...DEFAULT_VALUES,
  ...overrides,
});

describe("formatEffectiveDate", () => {
  it("spells out an ISO date the way a contract does", () => {
    expect(formatEffectiveDate("2026-07-11")).toBe("July 11, 2026");
  });

  it("does not shift the day across time zones", () => {
    expect(formatEffectiveDate("2026-01-01")).toBe("January 1, 2026");
  });

  it("returns nothing for an empty or malformed date", () => {
    expect(formatEffectiveDate("")).toBe("");
    expect(formatEffectiveDate("not-a-date")).toBe("");
  });
});

describe("resolveField", () => {
  it("pluralizes a multi-year term but not a single year", () => {
    expect(resolveField("mndaTerm", values({ mndaTermYears: "1" }))).toBe(
      "1 year from the Effective Date",
    );
    expect(resolveField("mndaTerm", values({ mndaTermYears: "3" }))).toBe(
      "3 years from the Effective Date",
    );
  });

  it("describes a term that runs until terminated", () => {
    expect(resolveField("mndaTerm", values({ mndaTermKind: "untilTerminated" })))
      .toBe("until terminated in accordance with the terms of the MNDA");
  });

  it("describes perpetual confidentiality", () => {
    expect(
      resolveField(
        "termOfConfidentiality",
        values({ confidentialityKind: "inPerpetuity" }),
      ),
    ).toBe("in perpetuity");
  });

  it("treats a cleared year count as unanswered", () => {
    expect(resolveField("mndaTerm", values({ mndaTermYears: "" }))).toBe("");
  });
});

describe("missingFields", () => {
  it("reports the blanks a fresh document still owes", () => {
    // Purpose and both terms are pre-filled by Common Paper's defaults.
    expect(missingFields(DEFAULT_VALUES)).toEqual([
      "effectiveDate",
      "governingLaw",
      "jurisdiction",
    ]);
  });

  it("is empty once every cover-page value is answered", () => {
    const complete = values({
      effectiveDate: "2026-07-11",
      governingLaw: "Delaware",
      jurisdiction: "New Castle County, Delaware",
    });
    expect(missingFields(complete)).toEqual([]);
  });

  it("counts whitespace as a blank", () => {
    expect(missingFields(values({ purpose: "   " }))).toContain("purpose");
  });
});

describe("documentFileName", () => {
  it("names the file after both parties", () => {
    const named = values({
      party1: { ...DEFAULT_VALUES.party1, company: "Acme Inc." },
      party2: { ...DEFAULT_VALUES.party2, company: "Globex" },
    });
    expect(documentFileName(named)).toBe("Mutual NDA - Acme Inc and Globex");
  });

  it("falls back to a generic name before the parties are known", () => {
    expect(documentFileName(DEFAULT_VALUES)).toBe("Mutual NDA");
  });
});

describe("standard terms", () => {
  it("transcribes all eleven clauses", () => {
    expect(STANDARD_TERMS).toHaveLength(11);
  });

  it("knows which clauses a cover-page value governs", () => {
    // The Purpose limits both the disclosure (§1) and the permitted use (§2).
    expect(clausesReferencing("purpose")).toEqual([1, 2]);
    expect(clausesReferencing("governingLaw")).toEqual([9]);
    expect(clausesReferencing("effectiveDate")).toEqual([5]);
  });
});
