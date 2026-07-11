# Mutual NDA creator

A prototype (PL-3) that turns the Common Paper Mutual NDA in `../templates/`
into a document you can fill in and download.

Fill in the cover page on the left; the agreement on the right updates as you
type. **Download PDF** prints the document — the browser's "Save as PDF" writes
the file, named after the two parties.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests
npm run typecheck
npm run build      # static export
```

## How it works

Everything runs in the browser. The template text is bundled at build time and
the document is rendered from React state, so nothing about the agreement is
sent anywhere.

- `src/lib/nda.ts` — the cover-page values and how they read in the document.
- `src/lib/standard-terms.ts` — the Standard Terms, transcribed verbatim.
- `src/components/NdaForm.tsx` — the form.
- `src/components/NdaDocument.tsx` — the document.

The Standard Terms mark every reference back to the cover page with
`<span class="coverpage_link">`. Those become `{ ref }` segments here, which is
what lets the app tell you which clauses a value governs before you fill it in,
and light up every clause a value lands in while you edit it. A cover-page value
you have not supplied renders as a red blank, so an unfinished agreement looks
unfinished.

Cross-references show the defined term ("Governing Law"), not the value.
Substituting the text inline would break the sentence, and is not how the
agreement is written.

## Downloading

Printing is the download: a print stylesheet drops the interface, unwinds the
app shell, and hands the page to `@page` at US Letter. The signature block and
each clause are kept off page boundaries, and the highlighting does not print.

The Common Paper Mutual NDA (Version 1.0) is free to use under CC BY 4.0.
