import { describe, expect, it } from "vitest";

import {
  applyUpdates,
  DEFAULT_VALUES,
  describeMndaTerm,
  documentFileName,
  formatEffectiveDate,
  missingFields,
  type NdaValues,
  resolveField,
  updatedCoverPageFields,
} from "./nda";
import { STANDARD_TERMS } from "./standard-terms";

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
});

describe("applyUpdates", () => {
  it("fills in the fields the AI learned", () => {
    const merged = applyUpdates(values(), {
      governingLaw: "Delaware",
      jurisdiction: "Wilmington, Delaware",
    });

    expect(merged.governingLaw).toBe("Delaware");
    expect(merged.jurisdiction).toBe("Wilmington, Delaware");
  });

  it("merges a party without dropping the details already gathered", () => {
    const current = values({
      party1: {
        company: "Acme",
        signatoryName: "Ada",
        title: "CEO",
        noticeAddress: "",
      },
    });

    const merged = applyUpdates(current, {
      party1: { noticeAddress: "1 Main St" },
    });

    expect(merged.party1).toEqual({
      company: "Acme",
      signatoryName: "Ada",
      title: "CEO",
      noticeAddress: "1 Main St",
    });
  });

  it("leaves a settled value alone when the patch omits it", () => {
    const current = values({ governingLaw: "Delaware" });

    const merged = applyUpdates(current, { jurisdiction: "Wilmington" });

    expect(merged.governingLaw).toBe("Delaware");
  });

  it("cannot blank out a value the user already gave", () => {
    // A patch adds and changes; it never erases. A null from the model for an
    // untouched field must not wipe the answer behind it.
    const current = values({ governingLaw: "Delaware" });

    const merged = applyUpdates(current, {
      governingLaw: null,
      party1: null,
    });

    expect(merged.governingLaw).toBe("Delaware");
    expect(merged.party1).toEqual(current.party1);
  });

  it("records a change to the standard terms", () => {
    // Nothing else can set this now the form is gone, so the AI is the only way
    // the modifications section ever says anything but "None."
    const merged = applyUpdates(values(), {
      modifications: "Section 5 term extended to 3 years.",
    });

    expect(merged.modifications).toBe("Section 5 term extended to 3 years.");
  });

  it("switches the term to run until terminated", () => {
    const merged = applyUpdates(values(), { mndaTermKind: "untilTerminated" });

    expect(describeMndaTerm(merged)).toBe(
      "until terminated in accordance with the terms of the MNDA",
    );
  });
});

describe("updatedCoverPageFields", () => {
  it("names the cover-page fields a patch touched", () => {
    expect(
      updatedCoverPageFields({ governingLaw: "Delaware", purpose: "Evaluating" }),
    ).toEqual(["purpose", "governingLaw"]);
  });

  it("maps either half of the term onto the field the document shows", () => {
    expect(updatedCoverPageFields({ mndaTermYears: "2" })).toEqual(["mndaTerm"]);
    expect(updatedCoverPageFields({ confidentialityKind: "inPerpetuity" })).toEqual([
      "termOfConfidentiality",
    ]);
  });

  it("names nothing when the AI only filled in a party", () => {
    // Party details are not cover-page fields, so there is nothing to light up.
    expect(updatedCoverPageFields({ party1: { company: "Acme" } })).toEqual([]);
  });
});
