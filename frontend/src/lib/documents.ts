/**
 * The agreements other than the Mutual NDA.
 *
 * The NDA is drafted by hand — its cover page, its checkbox options, its
 * transcribed clauses. The other ten are standard terms that name the values
 * they need, so the backend derives their fields from the template and this
 * module holds only what is common to all of them: a flat map of field name to
 * value, and a document built from lines the backend already parsed.
 */

export interface DocumentSummary {
  id: string;
  name: string;
  description: string;
  fields: string[];
}

export interface Segment {
  kind: "text" | "ref" | "heading";
  value: string;
}

export interface Line {
  depth: number;
  marker: string;
  segments: Segment[];
}

export interface DocumentTemplate {
  id: string;
  name: string;
  title: string;
  fields: string[];
  lines: Line[];
}

/** The values collected for an agreement, keyed by the name its template uses. */
export type FieldValues = Record<string, string>;

export const MUTUAL_NDA_ID = "mutual-nda";

/**
 * Folds a patch into a flat map of values. This can add and change a value but
 * never blank one out: an empty answer is the model declining to fill a field,
 * not the user erasing one.
 *
 * The NDA's parties merge by the same rule, but `Party` is a named shape rather
 * than an open map, so it keeps its own two-line merge in `nda.ts` — making this
 * one generic enough to serve both needs casts at every call site, which costs
 * more clarity than the duplication it saves.
 */
export function mergeFields(values: FieldValues, updates: FieldValues): FieldValues {
  const merged = { ...values };
  for (const [field, value] of Object.entries(updates)) {
    if (value) merged[field] = value;
  }
  return merged;
}

/** The fields the agreement still owes, in the order it asks for them. */
export function missingTemplateFields(
  template: DocumentTemplate,
  values: FieldValues,
): string[] {
  return template.fields.filter((field) => !values[field]?.trim());
}

/** A filename a person would recognize in their downloads folder. */
export function templateFileName(
  template: DocumentTemplate,
  values: FieldValues,
): string {
  // Most of these agreements are between a Customer and a Provider; the NDA is
  // the one with two symmetrical parties, and it names its own file.
  const parties = ["Customer", "Provider", "Company", "Partner"]
    .map((field) => values[field]?.trim())
    .filter(Boolean);
  const unique = [...new Set(parties)];
  return unique.length ? `${template.name} - ${unique.join(" and ")}` : template.name;
}
