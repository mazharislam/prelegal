/**
 * Domain model for the Common Paper Mutual NDA (Version 1.0).
 *
 * The cover page holds the negotiated values; the standard terms reference them
 * by name. `CoverPageField` is the shared vocabulary between the two — it is
 * what the form edits, what the document renders, and what the cross-reference
 * highlighting keys off.
 */

export type CoverPageField =
  | "purpose"
  | "effectiveDate"
  | "mndaTerm"
  | "termOfConfidentiality"
  | "governingLaw"
  | "jurisdiction";

export const COVER_PAGE_FIELD_LABELS: Record<CoverPageField, string> = {
  purpose: "Purpose",
  effectiveDate: "Effective Date",
  mndaTerm: "MNDA Term",
  termOfConfidentiality: "Term of Confidentiality",
  governingLaw: "Governing Law",
  jurisdiction: "Jurisdiction",
};

export interface Party {
  company: string;
  signatoryName: string;
  title: string;
  noticeAddress: string;
}

export interface NdaValues {
  purpose: string;
  effectiveDate: string;
  /** "expires" after a fixed number of years, or runs "untilTerminated". */
  mndaTermKind: "expires" | "untilTerminated";
  mndaTermYears: string;
  /** Confidentiality survives for a number of "years", or "inPerpetuity". */
  confidentialityKind: "years" | "inPerpetuity";
  confidentialityYears: string;
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  party1: Party;
  party2: Party;
}

const EMPTY_PARTY: Party = {
  company: "",
  signatoryName: "",
  title: "",
  noticeAddress: "",
};

/**
 * Common Paper ships the MNDA with the most common answers pre-selected. We
 * keep those defaults so the document reads as a complete agreement from the
 * first render, and the user only edits what they actually negotiated.
 */
export const DEFAULT_VALUES: NdaValues = {
  purpose:
    "Evaluating whether to enter into a business relationship with the other party.",
  effectiveDate: "",
  mndaTermKind: "expires",
  mndaTermYears: "1",
  confidentialityKind: "years",
  confidentialityYears: "1",
  governingLaw: "",
  jurisdiction: "",
  modifications: "",
  party1: { ...EMPTY_PARTY },
  party2: { ...EMPTY_PARTY },
};

/** Formats an ISO `yyyy-mm-dd` date the way a contract spells it out. */
export function formatEffectiveDate(isoDate: string): string {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function pluralizeYears(years: string): string {
  return `${years} year${years === "1" ? "" : "s"}`;
}

/** The MNDA Term as the standard terms refer to it (§5). */
export function describeMndaTerm(values: NdaValues): string {
  if (values.mndaTermKind === "untilTerminated") {
    return "until terminated in accordance with the terms of the MNDA";
  }
  if (!values.mndaTermYears) return "";
  return `${pluralizeYears(values.mndaTermYears)} from the Effective Date`;
}

/** The Term of Confidentiality as the standard terms refer to it (§5). */
export function describeTermOfConfidentiality(values: NdaValues): string {
  if (values.confidentialityKind === "inPerpetuity") return "in perpetuity";
  if (!values.confidentialityYears) return "";
  return `${pluralizeYears(values.confidentialityYears)} from the Effective Date`;
}

/** Resolves a cover-page field to the text the document should show for it. */
export function resolveField(
  field: CoverPageField,
  values: NdaValues,
): string {
  switch (field) {
    case "purpose":
      return values.purpose;
    case "effectiveDate":
      return formatEffectiveDate(values.effectiveDate);
    case "mndaTerm":
      return describeMndaTerm(values);
    case "termOfConfidentiality":
      return describeTermOfConfidentiality(values);
    case "governingLaw":
      return values.governingLaw;
    case "jurisdiction":
      return values.jurisdiction;
  }
}

/**
 * The fields that must be filled in for the NDA to be signable. Party details
 * are excluded: parties routinely print the agreement and complete the
 * signature block by hand.
 */
export const REQUIRED_FIELDS: CoverPageField[] = [
  "purpose",
  "effectiveDate",
  "mndaTerm",
  "termOfConfidentiality",
  "governingLaw",
  "jurisdiction",
];

/** Cover-page fields still missing a value, in document order. */
export function missingFields(values: NdaValues): CoverPageField[] {
  return REQUIRED_FIELDS.filter((field) => !resolveField(field, values).trim());
}

/**
 * A patch from the AI: only the fields it learned this turn. Everything else is
 * absent or null, so merging can add and change values but never blank one out.
 */
export interface NdaUpdates {
  purpose?: string | null;
  effectiveDate?: string | null;
  mndaTermKind?: NdaValues["mndaTermKind"] | null;
  mndaTermYears?: string | null;
  confidentialityKind?: NdaValues["confidentialityKind"] | null;
  confidentialityYears?: string | null;
  governingLaw?: string | null;
  jurisdiction?: string | null;
  modifications?: string | null;
  party1?: Partial<Party> | null;
  party2?: Partial<Party> | null;
}

function mergeParty(party: Party, update: Partial<Party> | null | undefined): Party {
  if (!update) return party;
  const merged = { ...party };
  for (const [key, value] of Object.entries(update) as [keyof Party, string][]) {
    if (value) merged[key] = value;
  }
  return merged;
}

/** Applies an AI patch to the document. */
export function applyUpdates(values: NdaValues, updates: NdaUpdates): NdaValues {
  const merged = { ...values };
  const scalars = [
    "purpose",
    "effectiveDate",
    "mndaTermKind",
    "mndaTermYears",
    "confidentialityKind",
    "confidentialityYears",
    "governingLaw",
    "jurisdiction",
    "modifications",
  ] as const;

  for (const key of scalars) {
    const value = updates[key];
    if (value) merged[key] = value as never;
  }

  merged.party1 = mergeParty(values.party1, updates.party1);
  merged.party2 = mergeParty(values.party2, updates.party2);
  return merged;
}

/**
 * The cover-page fields a patch touched, so the document can light up what the
 * AI just filled in — the same highlight the form drove with focus.
 */
export function updatedCoverPageFields(updates: NdaUpdates): CoverPageField[] {
  const touched: CoverPageField[] = [];
  if (updates.purpose) touched.push("purpose");
  if (updates.effectiveDate) touched.push("effectiveDate");
  if (updates.mndaTermKind || updates.mndaTermYears) touched.push("mndaTerm");
  if (updates.confidentialityKind || updates.confidentialityYears) {
    touched.push("termOfConfidentiality");
  }
  if (updates.governingLaw) touched.push("governingLaw");
  if (updates.jurisdiction) touched.push("jurisdiction");
  return touched;
}

/** A filename a person would recognize in their downloads folder. */
export function documentFileName(values: NdaValues): string {
  const parties = [values.party1.company, values.party2.company]
    .map((company) => company.trim().replace(/[^\w\s-]/g, ""))
    .filter(Boolean)
    .join(" and ");
  return parties ? `Mutual NDA - ${parties}` : "Mutual NDA";
}
