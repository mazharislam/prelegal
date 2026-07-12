/**
 * On every agreement, and it prints.
 *
 * The PDF is the artefact that leaves the building — the copy someone might sign,
 * or mistake for advice from a lawyer. A warning that only exists on screen is a
 * warning the person holding the document never sees, so this is deliberately not
 * marked `no-print`.
 */
export function Disclaimer() {
  return (
    <aside className="disclaimer mt-8">
      <p className="font-[family-name:var(--font-utility)] text-[7.5pt] font-medium tracking-[0.14em] text-pencil uppercase">
        Draft — not legal advice
      </p>
      <p className="mt-1 text-[9pt] leading-snug text-ink-soft">
        This document was generated from a template and should be treated as a
        draft. Have it reviewed by a qualified lawyer before anyone signs it.
      </p>
    </aside>
  );
}
