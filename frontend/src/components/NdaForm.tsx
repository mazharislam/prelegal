"use client";

import type { ReactNode } from "react";

import type { CoverPageField, NdaValues, Party } from "@/lib/nda";
import { clausesReferencing } from "@/lib/standard-terms";

interface NdaFormProps {
  values: NdaValues;
  onChange: (values: NdaValues) => void;
  /** Reports which cover-page value the user is on, so the document can light it up. */
  onFocusField: (field: CoverPageField | null) => void;
}

const inputStyles =
  "w-full rounded-md border border-desk-line bg-desk px-3 py-2 text-[15px] text-chalk " +
  "placeholder:text-chalk-soft/50 focus:border-marker focus:outline-none";

const yearInputStyles =
  "w-16 rounded border border-desk-line bg-desk px-2 py-1 text-center text-[14px] " +
  "text-chalk focus:border-marker focus:outline-none";

/** Tells the user, in the document's own terms, where an answer will show up. */
function ClauseHint({ field }: { field: CoverPageField }) {
  const clauses = clausesReferencing(field);
  if (clauses.length === 0) return null;
  const list =
    clauses.length === 1
      ? `clause ${clauses[0]}`
      : `clauses ${clauses.slice(0, -1).join(", ")} and ${clauses.at(-1)}`;
  return (
    <span className="font-[family-name:var(--font-utility)] text-[10px] tracking-[0.08em] text-chalk-soft uppercase">
      Governs {list}
    </span>
  );
}

function FieldHeader({
  label,
  field,
}: {
  label: string;
  field?: CoverPageField;
}) {
  return (
    <span className="flex items-baseline justify-between gap-3">
      <span className="font-[family-name:var(--font-utility)] text-[11px] font-medium tracking-[0.1em] text-chalk uppercase">
        {label}
      </span>
      {field ? <ClauseHint field={field} /> : null}
    </span>
  );
}

/** A label wrapping exactly one control. */
function Field({
  label,
  field,
  children,
}: {
  label: string;
  field?: CoverPageField;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <FieldHeader label={label} field={field} />
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

/**
 * A set of choices. Each choice carries its own label, so this cannot be one —
 * nesting labels would leave every radio announcing the whole group's text.
 */
function FieldGroup({
  label,
  field,
  children,
}: {
  label: string;
  field?: CoverPageField;
  children: ReactNode;
}) {
  return (
    <div role="group" aria-label={label}>
      <FieldHeader label={label} field={field} />
      <div className="mt-1.5 space-y-2">{children}</div>
    </div>
  );
}

function Fieldset({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-desk-line pt-5">
      <legend className="sr-only">{title}</legend>
      <h2 className="font-[family-name:var(--font-utility)] text-[11px] font-medium tracking-[0.16em] text-chalk-soft uppercase">
        {title}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </fieldset>
  );
}

function PartyFields({
  label,
  party,
  onChange,
}: {
  label: string;
  party: Party;
  onChange: (party: Party) => void;
}) {
  const set = (key: keyof Party) => (value: string) =>
    onChange({ ...party, [key]: value });

  return (
    <div className="space-y-3">
      <h3 className="font-[family-name:var(--font-utility)] text-[11px] font-medium tracking-[0.1em] text-chalk uppercase">
        {label}
      </h3>
      <input
        className={inputStyles}
        placeholder="Company"
        aria-label={`${label} company`}
        value={party.company}
        onChange={(event) => set("company")(event.target.value)}
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          className={inputStyles}
          placeholder="Signatory name"
          aria-label={`${label} signatory name`}
          value={party.signatoryName}
          onChange={(event) => set("signatoryName")(event.target.value)}
        />
        <input
          className={inputStyles}
          placeholder="Title"
          aria-label={`${label} title`}
          value={party.title}
          onChange={(event) => set("title")(event.target.value)}
        />
      </div>
      <input
        className={inputStyles}
        placeholder="Notice address (email or postal)"
        aria-label={`${label} notice address`}
        value={party.noticeAddress}
        onChange={(event) => set("noticeAddress")(event.target.value)}
      />
    </div>
  );
}

/**
 * Radio-style choices that mirror the checkboxes on the printed cover page.
 */
function Choice({
  name,
  checked,
  onSelect,
  children,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-[14px] transition-colors ${
        checked
          ? "border-marker/60 bg-desk text-chalk"
          : "border-desk-line bg-desk/40 text-chalk-soft hover:border-chalk-soft/40"
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="h-3.5 w-3.5 shrink-0 accent-[var(--color-marker)]"
      />
      <span className="flex-1">{children}</span>
    </label>
  );
}

export function NdaForm({ values, onChange, onFocusField }: NdaFormProps) {
  const set = <K extends keyof NdaValues>(key: K, value: NdaValues[K]) =>
    onChange({ ...values, [key]: value });

  /** Any field that appears in the document announces itself while being edited. */
  const track = (field: CoverPageField) => ({
    onFocus: () => onFocusField(field),
    onBlur: () => onFocusField(null),
    onMouseEnter: () => onFocusField(field),
    onMouseLeave: () => onFocusField(null),
  });

  return (
    <form className="space-y-7" onSubmit={(event) => event.preventDefault()}>
      <Fieldset title="What this NDA is for">
        <div {...track("purpose")}>
          <Field label="Purpose" field="purpose">
            <textarea
              className={`${inputStyles} min-h-20 resize-y leading-relaxed`}
              value={values.purpose}
              onChange={(event) => set("purpose", event.target.value)}
              placeholder="Evaluating whether to enter into a business relationship."
            />
          </Field>
        </div>
      </Fieldset>

      <Fieldset title="Dates and duration">
        <div {...track("effectiveDate")}>
          <Field label="Effective date" field="effectiveDate">
            <input
              type="date"
              className={inputStyles}
              value={values.effectiveDate}
              onChange={(event) => set("effectiveDate", event.target.value)}
            />
          </Field>
        </div>

        <div {...track("mndaTerm")}>
          <FieldGroup label="How long the NDA runs" field="mndaTerm">
            <Choice
              name="mndaTerm"
              checked={values.mndaTermKind === "expires"}
              onSelect={() => set("mndaTermKind", "expires")}
            >
              <span className="flex items-center gap-2">
                Expires
                <input
                  type="number"
                  min={1}
                  aria-label="Years until the NDA expires"
                  className={yearInputStyles}
                  value={values.mndaTermYears}
                  onChange={(event) => set("mndaTermYears", event.target.value)}
                  onClick={() => set("mndaTermKind", "expires")}
                />
                years after the effective date
              </span>
            </Choice>
            <Choice
              name="mndaTerm"
              checked={values.mndaTermKind === "untilTerminated"}
              onSelect={() => set("mndaTermKind", "untilTerminated")}
            >
              Continues until either party terminates it
            </Choice>
          </FieldGroup>
        </div>

        <div {...track("termOfConfidentiality")}>
          <FieldGroup
            label="How long secrets stay protected"
            field="termOfConfidentiality"
          >
            <Choice
              name="confidentiality"
              checked={values.confidentialityKind === "years"}
              onSelect={() => set("confidentialityKind", "years")}
            >
              <span className="flex items-center gap-2">
                For
                <input
                  type="number"
                  min={1}
                  aria-label="Years confidential information stays protected"
                  className={yearInputStyles}
                  value={values.confidentialityYears}
                  onChange={(event) =>
                    set("confidentialityYears", event.target.value)
                  }
                  onClick={() => set("confidentialityKind", "years")}
                />
                years, and trade secrets for as long as the law protects them
              </span>
            </Choice>
            <Choice
              name="confidentiality"
              checked={values.confidentialityKind === "inPerpetuity"}
              onSelect={() => set("confidentialityKind", "inPerpetuity")}
            >
              In perpetuity
            </Choice>
          </FieldGroup>
        </div>
      </Fieldset>

      <Fieldset title="Where disputes are settled">
        <div {...track("governingLaw")}>
          <Field label="Governing law" field="governingLaw">
            <input
              className={inputStyles}
              placeholder="Delaware"
              value={values.governingLaw}
              onChange={(event) => set("governingLaw", event.target.value)}
            />
          </Field>
        </div>
        <div {...track("jurisdiction")}>
          <Field label="Jurisdiction" field="jurisdiction">
            <input
              className={inputStyles}
              placeholder="New Castle County, Delaware"
              value={values.jurisdiction}
              onChange={(event) => set("jurisdiction", event.target.value)}
            />
          </Field>
        </div>
      </Fieldset>

      <Fieldset title="The parties">
        <PartyFields
          label="Party 1"
          party={values.party1}
          onChange={(party) => set("party1", party)}
        />
        <PartyFields
          label="Party 2"
          party={values.party2}
          onChange={(party) => set("party2", party)}
        />
      </Fieldset>

      <Fieldset title="Changes to the standard terms">
        <Field label="Modifications">
          <textarea
            className={`${inputStyles} min-h-16 resize-y leading-relaxed`}
            placeholder="Leave empty to use the standard terms unchanged."
            value={values.modifications}
            onChange={(event) => set("modifications", event.target.value)}
          />
        </Field>
      </Fieldset>
    </form>
  );
}
