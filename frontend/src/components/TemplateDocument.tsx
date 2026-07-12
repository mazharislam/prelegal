import { Disclaimer } from "@/components/Disclaimer";
import type {
  DocumentTemplate,
  FieldValues,
  Line,
  Segment,
} from "@/lib/documents";

interface TemplateDocumentProps {
  template: DocumentTemplate;
  values: FieldValues;
  /** The value the assistant most recently filled in, if any. */
  activeField: string | null;
}

/**
 * Every agreement except the Mutual NDA.
 *
 * Common Paper agreements are a cover page plus standard terms: the terms are
 * fixed, and the cover page carries the negotiated values, which is why the
 * terms refer to "the Subscription Period" rather than spelling one out. The
 * templates ship only the standard terms, so the cover page here is generated
 * from what the assistant collected — and the references in the body point back
 * at it, exactly as they do in the NDA.
 */
export function TemplateDocument({
  template,
  values,
  activeField,
}: TemplateDocumentProps) {
  return (
    <article className="sheet mx-auto">
      <h1 className="sheet-title">{template.title || template.name}</h1>

      <section className="mt-7">
        <h2 className="sheet-eyebrow">Cover Page</h2>
        <dl className="mt-3">
          {template.fields.map((field) => (
            <div
              key={field}
              className="clause flex gap-3 border-b border-[#e6e2d9] py-1.5 last:border-b-0"
            >
              <dt className="w-[42%] shrink-0 text-[9.5pt] text-ink-soft">{field}</dt>
              <dd className="flex-1">
                <CoverValue
                  field={field}
                  values={values}
                  activeField={activeField}
                />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <hr className="sheet-rule my-7" />

      <section>
        <h2 className="sheet-eyebrow">Standard Terms</h2>
        <div className="mt-4 space-y-2.5">
          {template.lines.map((line, index) => (
            <Clause
              key={index}
              line={line}
              values={values}
              activeField={activeField}
            />
          ))}
        </div>
      </section>

      <Disclaimer />

      <p className="mt-6 text-[8pt] text-ink-soft">
        {template.name} by Common Paper, free to use under CC BY 4.0.
      </p>
    </article>
  );
}

/** A value on the cover page, or the blank it still owes. */
function CoverValue({
  field,
  values,
  activeField,
}: {
  field: string;
  values: FieldValues;
  activeField: string | null;
}) {
  const value = values[field]?.trim();
  const lit = activeField === field ? " lit" : "";

  if (!value) {
    return <span className={`blank${lit}`}>{field}</span>;
  }
  return <span className={`filled${lit}`}>{value}</span>;
}

function Clause({
  line,
  values,
  activeField,
}: {
  line: Line;
  values: FieldValues;
  activeField: string | null;
}) {
  return (
    <p
      className="clause sheet-prose flex gap-2 text-[9.5pt] leading-relaxed"
      style={{ paddingLeft: `${line.depth * 1.1}rem` }}
    >
      {line.marker ? (
        <span className="shrink-0 font-[family-name:var(--font-utility)] text-[8pt] text-ink-soft">
          {line.marker}
        </span>
      ) : null}
      <span>
        {line.segments.map((segment, index) => (
          <SegmentText
            key={index}
            segment={segment}
            values={values}
            activeField={activeField}
          />
        ))}
      </span>
    </p>
  );
}

function SegmentText({
  segment,
  values,
  activeField,
}: {
  segment: Segment;
  values: FieldValues;
  activeField: string | null;
}) {
  if (segment.kind === "heading") {
    return <strong className="font-semibold">{segment.value} </strong>;
  }

  if (segment.kind === "text") {
    return <>{segment.value} </>;
  }

  /* A reference to the cover page. It shows the defined term, not the value:
   * substituting the text inline would break the sentence, and is not how the
   * agreement is written. */
  const value = values[segment.value]?.trim();
  return (
    <>
      <span
        className={`xref${activeField === segment.value ? " lit" : ""}`}
        title={
          value
            ? `${segment.value}: ${value}`
            : `${segment.value} — not filled in yet`
        }
      >
        {segment.value}
      </span>{" "}
    </>
  );
}
