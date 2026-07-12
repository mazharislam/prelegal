# Prelegal frontend

Talk to an assistant; watch the agreement fill itself in. Drafts are saved as you
go, so you can come back to one later. **Download PDF** prints the document — the
browser's "Save as PDF" writes the file, named after the parties.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests
npm run typecheck
npm run build      # static export
```

The chat, the agreement text, and your drafts all need the backend (see
`../README.md`). `npm run dev` alone will render, but it cannot hold a
conversation.

## Two kinds of document

The Mutual NDA is drafted by hand. It has a real cover page in the dataset, and
its options are choices rather than free text ("expires in N years" or "continues
until terminated"), so it has its own values (`lib/nda.ts`) and its own renderer
(`components/NdaDocument.tsx`).

The other ten are standard terms that name the values they need. The backend
derives those fields from the template and parses the text into lines, so they
share one renderer (`components/TemplateDocument.tsx`) driven by a flat map of
field name to value (`lib/documents.ts`). Their cover page does not exist in the
dataset — we generate it from what the assistant collected.

## The desk

`lib/useDocument.ts` holds whichever document is open: its type, its values, the
conversation, and the draft it is saved as. **The turn lives there too** —
`submitTurn` sends the message, applies the answer, and saves. It is not in
`ChatPanel`, and it should not go back: a turn takes seconds, and if the user
opens another draft while one is in flight, the answer has to be dropped rather
than applied to whatever is on screen when it lands. A `generation` counter is
what makes that possible.

- `src/lib/nda.ts` — the NDA's values, and how an AI patch merges into them.
- `src/lib/documents.ts` — every other agreement's values.
- `src/lib/standard-terms.ts` — the NDA Standard Terms, transcribed verbatim.
- `src/components/ChatPanel.tsx` — says the message, shows what came back.
- `src/components/AuthScreen.tsx`, `DraftList.tsx` — accounts, and saved work.

## The look

Two worlds, deliberately (see `app/globals.css`). The **interface** is a light,
blue SaaS. The **document** is paper: cream, serif, printed. A contract should not
look like the tool that drafted it.

In both documents, a term in the standard terms shows its **name**, not its
value, and cross-references the cover page — substituting the text inline would
break the sentence, and is not how these agreements are written. A value nobody
has supplied renders as a red blank, so an unfinished agreement looks unfinished.

## Downloading

Printing is the download: a print stylesheet drops the interface, unwinds the app
shell, and hands the page to `@page` at US Letter. The signature block and each
clause are kept off page boundaries, and the highlighting does not print.

The "draft, not legal advice" notice **does** print. The PDF is the copy that
leaves the building, and it is the one someone might sign.

The Common Paper templates are free to use under CC BY 4.0.
