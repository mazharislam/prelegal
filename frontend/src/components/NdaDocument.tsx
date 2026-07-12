import type { ReactNode } from "react";

import { Disclaimer } from "@/components/Disclaimer";
import {
  COVER_PAGE_FIELD_LABELS,
  type CoverPageField,
  type NdaValues,
  type Party,
  resolveField,
} from "@/lib/nda";
import { STANDARD_TERMS } from "@/lib/standard-terms";

interface DocumentProps {
  values: NdaValues;
  /** The cover-page value the assistant most recently filled in, if any. */
  activeField: CoverPageField | null;
}

/**
 * A value the user supplied, or the blank it still owes. Both light up when the
 * assistant has just filled the field, so the user can see where their answer lands.
 */
function Value({
  field,
  values,
  activeField,
}: DocumentProps & { field: CoverPageField }) {
  const text = resolveField(field, values);
  const lit = activeField === field ? " lit" : "";

  if (!text) {
    return <span className={`blank${lit}`}>{COVER_PAGE_FIELD_LABELS[field]}</span>;
  }
  return <span className={`filled${lit}`}>{text}</span>;
}

/**
 * A reference from the standard terms back to a cover-page term. It shows the
 * defined term, not the value — substituting the text inline would break the
 * sentence and, more to the point, is not how the agreement is written.
 */
function Xref({
  field,
  values,
  activeField,
}: DocumentProps & { field: CoverPageField }) {
  const value = resolveField(field, values);
  const label = COVER_PAGE_FIELD_LABELS[field];
  return (
    <span
      className={`xref${activeField === field ? " lit" : ""}`}
      title={value ? `${label}: ${value}` : `${label} — not filled in yet`}
    >
      {label}
    </span>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className="mr-2 inline-flex h-[0.9em] w-[0.9em] shrink-0 items-center justify-center border border-[#8c8578] text-[0.75em] leading-none"
    >
      {checked ? "✓" : ""}
    </span>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="sheet-eyebrow">{title}</h2>
      {hint ? (
        <p className="mt-0.5 text-[8.5pt] text-[#8b8577] italic">{hint}</p>
      ) : null}
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

function SignatureColumn({ party, label }: { party: Party; label: string }) {
  const rows: [string, string][] = [
    ["Signature", ""],
    ["Print name", party.signatoryName],
    ["Title", party.title],
    ["Company", party.company],
    ["Notice address", party.noticeAddress],
    ["Date", ""],
  ];

  return (
    <div className="flex-1">
      <p className="sheet-eyebrow">{label}</p>
      <dl className="mt-2">
        {rows.map(([term, value]) => (
          <div key={term} className="mt-3">
            <dd className="signature-line min-h-[1.5em] break-words pb-0.5 text-[10pt]">
              {value}
            </dd>
            <dt className="mt-1 font-[family-name:var(--font-utility)] text-[7pt] tracking-[0.1em] text-[#8b8577] uppercase">
              {term}
            </dt>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * The Common Paper Mutual NDA: a cover page carrying the negotiated values,
 * followed by the standard terms that reference them.
 */
export function NdaDocument({ values, activeField }: DocumentProps) {
  const field = (name: CoverPageField) => (
    <Value field={name} values={values} activeField={activeField} />
  );

  return (
    <article className="sheet mx-auto">
      <header>
        <h1 className="sheet-title">Mutual Non-Disclosure Agreement</h1>
        <hr className="sheet-rule mt-3" />
        <p className="sheet-prose mt-3 text-[9pt] text-[#4a4f59]">
          This Mutual Non-Disclosure Agreement (the “MNDA”) consists of: (1) this
          Cover Page (“<strong>Cover Page</strong>”) and (2) the Common Paper
          Mutual NDA Standard Terms Version 1.0 (“<strong>Standard Terms</strong>
          ”) identical to those posted at commonpaper.com/standards/mutual-nda/1.0.
          Any modifications of the Standard Terms should be made on the Cover
          Page, which will control over conflicts with the Standard Terms.
        </p>
      </header>

      <Section title="Purpose" hint="How Confidential Information may be used">
        <p>{field("purpose")}</p>
      </Section>

      <Section title="Effective Date">
        <p>{field("effectiveDate")}</p>
      </Section>

      <Section title="MNDA Term" hint="The length of this MNDA">
        <p className="flex items-baseline">
          <Checkbox checked={values.mndaTermKind === "expires"} />
          <span>
            Expires{" "}
            {values.mndaTermKind === "expires" ? (
              field("mndaTerm")
            ) : (
              <span className="text-[#8b8577]">
                [term] from the Effective Date
              </span>
            )}
            .
          </span>
        </p>
        <p className="mt-1 flex items-baseline">
          <Checkbox checked={values.mndaTermKind === "untilTerminated"} />
          <span>
            Continues until terminated in accordance with the terms of the MNDA.
          </span>
        </p>
      </Section>

      <Section
        title="Term of Confidentiality"
        hint="How long Confidential Information is protected"
      >
        <p className="flex items-baseline">
          <Checkbox checked={values.confidentialityKind === "years"} />
          <span>
            {values.confidentialityKind === "years" ? (
              field("termOfConfidentiality")
            ) : (
              <span className="text-[#8b8577]">[term] from the Effective Date</span>
            )}
            , but in the case of trade secrets until Confidential Information is
            no longer considered a trade secret under applicable laws.
          </span>
        </p>
        <p className="mt-1 flex items-baseline">
          <Checkbox checked={values.confidentialityKind === "inPerpetuity"} />
          <span>In perpetuity.</span>
        </p>
      </Section>

      <Section title="Governing Law & Jurisdiction">
        <p>Governing Law: {field("governingLaw")}</p>
        <p className="mt-1">Jurisdiction: {field("jurisdiction")}</p>
      </Section>

      <Section title="MNDA Modifications" hint="Any changes to the Standard Terms">
        <p className="sheet-prose whitespace-pre-wrap">
          {values.modifications.trim() || (
            <span className="text-[#8b8577]">None.</span>
          )}
        </p>
      </Section>

      <Disclaimer />

      <div className="signature-block mt-8">
        <p className="sheet-prose text-[9.5pt]">
          By signing this Cover Page, each party agrees to enter into this MNDA as
          of the Effective Date.
        </p>
        <div className="mt-4 flex gap-10">
          <SignatureColumn party={values.party1} label="Party 1" />
          <SignatureColumn party={values.party2} label="Party 2" />
        </div>
      </div>

      <section className="page-break mt-12">
        <h2 className="sheet-eyebrow">Standard Terms</h2>
        <hr className="sheet-rule mt-2" />
        <ol className="mt-4">
          {STANDARD_TERMS.map((section, index) => (
            <li key={section.heading} className="clause mt-3.5 flex gap-2.5">
              <span className="font-[family-name:var(--font-utility)] text-[9pt] text-[#8b8577] tabular-nums">
                {index + 1}.
              </span>
              <p className="sheet-prose flex-1">
                <strong>{section.heading}.</strong>{" "}
                {section.body.map((segment, position) => {
                  if (typeof segment === "string") {
                    return <span key={position}>{segment}</span>;
                  }
                  if ("strong" in segment) {
                    return <strong key={position}>{segment.strong}</strong>;
                  }
                  return (
                    <Xref
                      key={position}
                      field={segment.ref}
                      values={values}
                      activeField={activeField}
                    />
                  );
                })}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-10">
        <hr className="sheet-rule" />
        <p className="mt-2 text-[8pt] text-[#8b8577]">
          Common Paper Mutual Non-Disclosure Agreement (Version 1.0), free to use
          under CC BY 4.0.
        </p>
      </footer>
    </article>
  );
}
