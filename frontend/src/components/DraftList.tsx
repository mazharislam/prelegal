"use client";

import { useEffect, useState } from "react";

import { deleteDraft, type DraftSummary, listDrafts } from "@/lib/api";

interface DraftListProps {
  /** Bumped whenever a draft is saved, so the list reflects the desk. */
  revision: number;
  currentId: number | null;
  onOpen: (id: number) => void;
  onNew: () => void;
}

/** The user's drafts, newest first. */
export function DraftList({ revision, currentId, onOpen, onNew }: DraftListProps) {
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);

  useEffect(() => {
    let current = true;
    listDrafts()
      .then((loaded) => {
        if (current) setDrafts(loaded);
      })
      .catch(() => {
        if (current) setDrafts([]);
      });
    return () => {
      current = false;
    };
  }, [revision]);

  const [error, setError] = useState<string | null>(null);

  const remove = async (id: number) => {
    try {
      await deleteDraft(id);
    } catch {
      // Dropping it from the list anyway would tell the user their draft is
      // gone when it is still on the server — and if it is the one open on the
      // desk, would throw away their work to boot.
      setError("That draft could not be deleted.");
      return;
    }
    setError(null);
    setDrafts((current) => current.filter((draft) => draft.id !== id));
    if (id === currentId) onNew();
  };

  return (
    <section aria-label="Your drafts">
      <div className="flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-utility)] text-[11px] font-medium tracking-[0.14em] text-muted uppercase">
          Your drafts
        </h2>
        <button
          type="button"
          onClick={onNew}
          className="text-[12px] font-medium text-blue hover:underline"
        >
          New
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-[12px] text-pencil">
          {error}
        </p>
      ) : null}

      {drafts.length === 0 ? (
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          Nothing saved yet. Start a conversation and it will appear here.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {drafts.map((draft) => (
            <li key={draft.id}>
              <div
                className={`group flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                  draft.id === currentId
                    ? "border-blue bg-blue-pale/50"
                    : "border-card-line bg-card hover:border-blue-light"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onOpen(draft.id)}
                  className="min-w-0 flex-1 text-left"
                  aria-current={draft.id === currentId ? "true" : undefined}
                >
                  <span className="block truncate text-[13px] font-medium text-navy">
                    {draft.name}
                  </span>
                  <span className="block text-[11px] text-muted">
                    {draft.blanks === 0
                      ? "Ready to sign"
                      : `${draft.blanks} ${draft.blanks === 1 ? "blank" : "blanks"} left`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(draft.id)}
                  aria-label={`Delete ${draft.name}`}
                  className="shrink-0 rounded p-1 text-[16px] leading-none text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-pencil focus-visible:opacity-100"
                >
                  &times;
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
