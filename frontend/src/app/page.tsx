"use client";

import { useEffect, useState } from "react";

import { ChatPanel } from "@/components/ChatPanel";
import { LoginScreen } from "@/components/LoginScreen";
import { NdaDocument } from "@/components/NdaDocument";
import { TemplateDocument } from "@/components/TemplateDocument";
import { fetchDocumentTypes, fetchSession, logout, type User } from "@/lib/api";
import type { DocumentSummary } from "@/lib/documents";
import type { CoverPageField } from "@/lib/nda";
import { COVER_PAGE_FIELD_LABELS } from "@/lib/nda";
import { useDocument } from "@/lib/useDocument";

/**
 * The session gate. A signed-out visitor gets the login screen; everyone else
 * gets the desk. The session lives on the server behind a cookie, so a reload
 * resumes it — hence the check before the first paint.
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
    return <main className="min-h-screen bg-desk" />;
  }

  if (!user) {
    return <LoginScreen onSignedIn={setUser} />;
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
    /* Two independently scrolling panes on a desktop; one plain scrolling column on a phone. */
    <div className="app-shell flex min-h-screen flex-col lg:h-screen lg:flex-row">
      <header className="no-print flex items-center justify-between gap-4 border-b border-desk-line bg-desk-raised px-5 py-3 lg:hidden">
        <Wordmark />
        <div className="flex items-center gap-3">
          <SignOutButton onSignedOut={onSignedOut} />
          {started ? (
            <DownloadButton blanks={desk.blanks.length} onClick={downloadPdf} />
          ) : null}
        </div>
      </header>

      {/* The desk: the conversation that fills the document in. */}
      <div className="no-print flex flex-col border-desk-line bg-desk-raised lg:w-[440px] lg:shrink-0 lg:overflow-hidden lg:border-r xl:w-[480px]">
        <div className="hidden px-7 pt-7 lg:block">
          <div className="flex items-start justify-between gap-4">
            <Wordmark />
            <SignedInAs user={user} onSignedOut={onSignedOut} />
          </div>
        </div>

        {/* min-h-0 lets the thread scroll inside the column instead of stretching it. */}
        <div className="flex min-h-[460px] flex-1 flex-col px-5 py-6 lg:min-h-0 lg:px-7">
          <ChatPanel
            values={desk.values}
            documentType={desk.documentType}
            onReply={desk.applyReply}
          />
        </div>

        {started ? (
          <div className="sticky bottom-0 mt-auto hidden border-t border-desk-line bg-desk-raised px-7 py-4 lg:block">
            <BlanksRemaining blanks={desk.blanks} isNda={desk.isNda} />
            <DownloadButton
              blanks={desk.blanks.length}
              onClick={downloadPdf}
              className="mt-3 w-full"
            />
          </div>
        ) : null}
      </div>

      {/* The paper. */}
      <main className="preview-pane flex-1 bg-desk p-6 lg:overflow-auto lg:p-10">
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
        <p className="text-[15px] leading-relaxed text-chalk-soft">
          Tell the assistant what you need and the agreement will appear here. It
          can draft any of these:
        </p>
        <ul className="mt-5 space-y-1.5">
          {documents.map((document) => (
            <li
              key={document.id}
              className="font-[family-name:var(--font-document)] text-[15px] text-chalk"
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
  return (
    <div className="shrink-0 text-right">
      <p className="max-w-[150px] truncate text-[12px] text-chalk-soft">
        {user.email}
      </p>
      <SignOutButton onSignedOut={onSignedOut} className="mt-0.5" />
    </div>
  );
}

function SignOutButton({
  onSignedOut,
  className = "",
}: {
  onSignedOut: () => void;
  className?: string;
}) {
  const signOut = async () => {
    try {
      await logout();
    } catch {
      /* The cookie is the server's to forget, but a failed request is no reason
       * to strand the user in a session they asked to leave. */
    }
    onSignedOut();
  };

  return (
    <button
      type="button"
      onClick={signOut}
      className={`font-[family-name:var(--font-utility)] text-[11px] tracking-[0.08em] text-chalk-soft uppercase transition-colors hover:text-chalk ${className}`}
    >
      Sign out
    </button>
  );
}

function Wordmark() {
  return (
    <div>
      <p className="font-[family-name:var(--font-utility)] text-[10px] font-medium tracking-[0.22em] text-chalk-soft uppercase">
        Prelegal
      </p>
      <h1 className="mt-1 font-[family-name:var(--font-document)] text-[26px] leading-tight font-semibold text-chalk">
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
      <p className="text-[13px] text-chalk-soft">
        Every blank is filled. The agreement is ready to sign.
      </p>
    );
  }

  const label = (blank: string) =>
    isNda ? COVER_PAGE_FIELD_LABELS[blank as CoverPageField] : blank;

  return (
    <p className="text-[13px] text-chalk-soft">
      <span className="text-pencil">
        {blanks.length} {blanks.length === 1 ? "blank" : "blanks"} left:
      </span>{" "}
      {blanks.slice(0, 4).map(label).join(", ")}
      {blanks.length > 4 ? `, and ${blanks.length - 4} more` : ""}.
    </p>
  );
}

function DownloadButton({
  blanks,
  onClick,
  className = "",
}: {
  blanks: number;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={
        blanks > 0
          ? "The document still has blanks. You can download it anyway."
          : undefined
      }
      className={`rounded-md bg-marker px-4 py-2.5 text-[14px] font-semibold text-ink transition-colors hover:bg-[#f9e9a4] ${className}`}
    >
      Download PDF
    </button>
  );
}
