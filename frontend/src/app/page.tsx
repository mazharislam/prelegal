"use client";

import { useState } from "react";

import { NdaDocument } from "@/components/NdaDocument";
import { NdaForm } from "@/components/NdaForm";
import {
  COVER_PAGE_FIELD_LABELS,
  DEFAULT_VALUES,
  type CoverPageField,
  documentFileName,
  missingFields,
} from "@/lib/nda";

export default function Page() {
  const [values, setValues] = useState(DEFAULT_VALUES);
  const [activeField, setActiveField] = useState<CoverPageField | null>(null);

  const blanks = missingFields(values);

  /**
   * Printing is the download. The browser's "Save as PDF" names the file after
   * the document title, so we borrow the title for the length of the dialog.
   */
  const downloadPdf = () => {
    const previousTitle = document.title;
    document.title = documentFileName(values);
    window.print();
    document.title = previousTitle;
  };

  return (
    /* Two independently scrolling panes on a desktop; one plain scrolling column on a phone. */
    <div className="app-shell flex min-h-screen flex-col lg:h-screen lg:flex-row">
      <header className="no-print flex items-center justify-between gap-4 border-b border-desk-line bg-desk-raised px-5 py-3 lg:hidden">
        <Wordmark />
        <DownloadButton blanks={blanks.length} onClick={downloadPdf} />
      </header>

      {/* The desk: everything the user can change. */}
      <div className="no-print flex flex-col border-desk-line bg-desk-raised lg:w-[440px] lg:shrink-0 lg:overflow-y-auto lg:border-r xl:w-[480px]">
        <div className="hidden px-7 pt-7 lg:block">
          <Wordmark />
        </div>

        <div className="px-5 py-6 lg:px-7">
          <NdaForm
            values={values}
            onChange={setValues}
            onFocusField={setActiveField}
          />
        </div>

        <div className="sticky bottom-0 mt-auto hidden border-t border-desk-line bg-desk-raised px-7 py-4 lg:block">
          <BlanksRemaining blanks={blanks} />
          <DownloadButton
            blanks={blanks.length}
            onClick={downloadPdf}
            className="mt-3 w-full"
          />
        </div>
      </div>

      {/* The paper. */}
      <main className="preview-pane flex-1 bg-desk p-6 lg:overflow-auto lg:p-10">
        <NdaDocument values={values} activeField={activeField} />
      </main>
    </div>
  );
}

function Wordmark() {
  return (
    <div>
      <p className="font-[family-name:var(--font-utility)] text-[10px] font-medium tracking-[0.22em] text-chalk-soft uppercase">
        Prelegal
      </p>
      <h1 className="mt-1 font-[family-name:var(--font-document)] text-[26px] leading-tight font-semibold text-chalk">
        Mutual NDA
      </h1>
    </div>
  );
}

function BlanksRemaining({ blanks }: { blanks: CoverPageField[] }) {
  if (blanks.length === 0) {
    return (
      <p className="text-[13px] text-chalk-soft">
        Every blank is filled. The NDA is ready to sign.
      </p>
    );
  }

  return (
    <p className="text-[13px] text-chalk-soft">
      <span className="text-pencil">
        {blanks.length} {blanks.length === 1 ? "blank" : "blanks"} left:
      </span>{" "}
      {blanks.map((field) => COVER_PAGE_FIELD_LABELS[field]).join(", ")}.
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
