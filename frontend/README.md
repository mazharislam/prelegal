# Mutual NDA creator

Turns the Common Paper Mutual NDA in `../templates/` into a document you can
talk your way through and download.

Tell the assistant about your deal on the left; the agreement on the right fills
in as it learns each value. **Download PDF** prints the document — the browser's
"Save as PDF" writes the file, named after the two parties.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests
npm run typecheck
npm run build      # static export
```

The chat needs the backend (see `../README.md`). `npm run dev` alone renders the
document but cannot hold a conversation.

## How it works

The template text is bundled at build time and the document is rendered from
React state. The conversation and the document values are sent to the backend on
each turn, which is what the model reads to decide its next question.

- `src/lib/nda.ts` — the cover-page values, how they read in the document, and
  how an AI patch merges into them.
- `src/lib/standard-terms.ts` — the Standard Terms, transcribed verbatim.
- `src/components/ChatPanel.tsx` — the interview.
- `src/components/NdaDocument.tsx` — the document.

The Standard Terms mark every reference back to the cover page with
`<span class="coverpage_link">`. Those become `{ ref }` segments here, which is
what lets the app light up the clauses a value lands in the moment the assistant
fills it in. A cover-page value nobody has supplied renders as a red blank, so an
unfinished agreement looks unfinished.

Cross-references show the defined term ("Governing Law"), not the value.
Substituting the text inline would break the sentence, and is not how the
agreement is written.

## Downloading

Printing is the download: a print stylesheet drops the interface, unwinds the
app shell, and hands the page to `@page` at US Letter. The signature block and
each clause are kept off page boundaries, and the highlighting does not print.

The Common Paper Mutual NDA (Version 1.0) is free to use under CC BY 4.0.
