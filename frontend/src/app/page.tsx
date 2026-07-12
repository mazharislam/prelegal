"use client";

import { useEffect, useState } from "react";

import { AuthScreen } from "@/components/AuthScreen";
import { ChatPanel } from "@/components/ChatPanel";
import { DraftList } from "@/components/DraftList";
import { NdaDocument } from "@/components/NdaDocument";
import { TemplateDocument } from "@/components/TemplateDocument";
import {
  fetchDocumentTypes,
  fetchSession,
  signOut,
  type User,
} from "@/lib/api";
import type { DocumentSummary } from "@/lib/documents";
import { COVER_PAGE_FIELD_LABELS, type CoverPageField } from "@/lib/nda";
import { useDocument } from "@/lib/useDocument";

/**
 * The session gate. The session lives on the server behind a signed cookie, so a
 * reload resumes it — hence the check before the first paint.
 */
export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    fetchSession()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setCheckingSession(false));
  }, []);

  if (checkingSession) {
    return <main className="min-h-screen bg-canvas" />;
  }

  if (!user) {
    return <AuthScreen onSignedIn={setUser} />;
  }

  return <Desk user={user} onSignedOut={() => setUser(null)} />;
}

function Desk({ user, onSignedOut }: { user: User; onSignedOut: () => void }) {
  const desk = useDocument();

  /**
   * Printing is the download. The browser's "Save as PDF" names the file after
   * the document title, so we borrow the title for the length of the dialog.
   */
  const downloadPdf = () => {
    const previousTitle = document.title;
    document.title = desk.fileName;
    window.print();
    document.title = previousTitle;
  };

  const started = desk.documentType !== null;

  return (
    <div className="app-shell flex min-h-screen flex-col lg:h-screen lg:flex-row">
      {/* The rail: who you are, and what you have drafted. */}
      <aside className="no-print flex shrink-0 flex-col gap-6 border-b border-card-line bg-card px-5 py-5 lg:w-[248px] lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-5 lg:py-7">
        <Wordmark />
        <DraftList
          revision={desk.revision}
          currentId={desk.draftId}
          onOpen={(id) => void desk.openDraft(id)}
          onNew={desk.newDraft}
        />
        <SignedInAs user={user} onSignedOut={onSignedOut} />
      </aside>

      {/* The conversation that fills the document in. */}
      <div className="no-print flex flex-col border-card-line bg-canvas lg:w-[420px] lg:shrink-0 lg:overflow-hidden lg:border-r xl:w-[460px]">
        <div className="flex min-h-[460px] flex-1 flex-col px-5 py-6 lg:min-h-0">
          <ChatPanel messages={desk.messages} onSend={desk.submitTurn} />
        </div>

        {started ? (
          <div className="sticky bottom-0 mt-auto border-t border-card-line bg-card px-5 py-4">
            <BlanksRemaining blanks={desk.blanks} isNda={desk.isNda} />
            <button
              type="button"
              onClick={downloadPdf}
              title={
                desk.blanks.length > 0
                  ? "The document still has blanks. You can download it anyway."
                  : undefined
              }
              className="mt-3 w-full rounded-lg border border-blue bg-white px-4 py-2.5 text-[14px] font-semibold text-blue transition-colors hover:bg-blue-pale"
            >
              Download PDF
            </button>
          </div>
        ) : null}
      </div>

      {/* The paper. */}
      <main className="preview-pane flex-1 bg-canvas p-6 lg:overflow-auto lg:p-10">
        <Paper desk={desk} />
      </main>
    </div>
  );
}

function Paper({ desk }: { desk: ReturnType<typeof useDocument> }) {
  if (desk.isNda) {
    return (
      <NdaDocument
        values={desk.ndaValues}
        activeField={desk.activeField as CoverPageField | null}
      />
    );
  }

  if (desk.template) {
    return (
      <TemplateDocument
        template={desk.template}
        values={desk.fieldValues}
        activeField={desk.activeField}
      />
    );
  }

  return <BlankPage message={desk.templateError} />;
}

/**
 * Before an agreement is chosen there is nothing to draft. Rather than an empty
 * page, say what can be asked for — "tell me what you need" is a poor prompt if
 * the user cannot see what is on offer.
 */
function BlankPage({ message }: { message: string | null }) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);

  useEffect(() => {
    fetchDocumentTypes()
      .then(setDocuments)
      .catch(() => setDocuments([]));
  }, []);

  if (message) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="max-w-sm text-center text-[15px] text-pencil">{message}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-md">
        <p className="text-[15px] leading-relaxed text-muted">
          Tell the assistant what you need and the agreement will appear here. It
          can draft any of these:
        </p>
        <ul className="mt-5 grid gap-1.5">
          {documents.map((document) => (
            <li
              key={document.id}
              className="font-[family-name:var(--font-document)] text-[15px] text-navy"
            >
              {document.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SignedInAs({
  user,
  onSignedOut,
}: {
  user: User;
  onSignedOut: () => void;
}) {
  const leave = async () => {
    try {
      await signOut();
    } catch {
      /* The cookie is the server's to forget, but a failed request is no reason
       * to strand the user in a session they asked to leave. */
    }
    onSignedOut();
  };

  return (
    <div className="mt-auto border-t border-card-line pt-4">
      <p className="truncate text-[12px] text-muted">{user.email}</p>
      <button
        type="button"
        onClick={leave}
        className="mt-1 font-[family-name:var(--font-utility)] text-[11px] tracking-[0.08em] text-muted uppercase transition-colors hover:text-navy"
      >
        Sign out
      </button>
    </div>
  );
}

function Wordmark() {
  return (
    <div>
      <p className="font-[family-name:var(--font-utility)] text-[10px] font-medium tracking-[0.22em] text-blue uppercase">
        Prelegal
      </p>
      <h1 className="mt-1 font-[family-name:var(--font-document)] text-[22px] leading-tight font-semibold text-navy">
        Legal drafting
      </h1>
    </div>
  );
}

function BlanksRemaining({
  blanks,
  isNda,
}: {
  blanks: string[];
  isNda: boolean;
}) {
  if (blanks.length === 0) {
    return (
      <p className="text-[13px] text-muted">
        Every blank is filled. The agreement is ready to review.
      </p>
    );
  }

  const label = (blank: string) =>
    isNda ? COVER_PAGE_FIELD_LABELS[blank as CoverPageField] : blank;

  return (
    <p className="text-[13px] text-muted">
      <span className="font-medium text-pencil">
        {blanks.length} {blanks.length === 1 ? "blank" : "blanks"} left:
      </span>{" "}
      {blanks.slice(0, 4).map(label).join(", ")}
      {blanks.length > 4 ? `, and ${blanks.length - 4} more` : ""}.
    </p>
  );
}
