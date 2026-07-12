"use client";

import { useEffect, useRef, useState } from "react";

import {
  type ChatMessage,
  type ChatReply,
  createDraft,
  fetchDraft,
  fetchTemplate,
  saveDraft,
  sendChat,
} from "@/lib/api";
import {
  type DocumentTemplate,
  type FieldValues,
  mergeFields,
  MUTUAL_NDA_ID,
  missingTemplateFields,
  templateFileName,
} from "@/lib/documents";
import {
  applyUpdates,
  DEFAULT_VALUES,
  documentFileName,
  missingFields,
  type NdaUpdates,
  type NdaValues,
  updatedCoverPageFields,
} from "@/lib/nda";

/**
 * The agreement on the desk: which one it is, what the chat has learned about it,
 * and the conversation that got there.
 *
 * Two value shapes live here because the documents are two kinds. The Mutual NDA
 * is drafted by hand and its values are typed — its term is a choice, not a
 * string. Every other agreement is standard terms whose fields the backend
 * derives from the template, so its values are a plain map.
 *
 * Everything is saved after every turn. There is no Save button to forget, and a
 * closed tab loses nothing.
 */
export function useDocument() {
  const [documentType, setDocumentType] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<DocumentTemplate | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [ndaValues, setNdaValues] = useState<NdaValues>(DEFAULT_VALUES);
  const [fieldValues, setFieldValues] = useState<FieldValues>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);

  /**
   * Which document the desk is showing, counted up every time the user moves to
   * another one.
   *
   * A turn takes the better part of ten seconds, and a save is in flight after
   * it. The user can open a different draft in the meantime — and when the old
   * answer lands, it must not be applied to the document now on screen, nor its
   * save allowed to write one draft's contents over another's. Anything that
   * comes back holding a stale count is simply dropped.
   */
  const generation = useRef(0);

  const isNda = documentType === MUTUAL_NDA_ID;

  useEffect(() => {
    if (!documentType || isNda) return;

    let current = true;
    fetchTemplate(documentType)
      .then((template) => {
        if (current) setLoaded(template);
      })
      .catch(() => {
        if (current) setFailed(documentType);
      });

    // A switch made while the previous fetch is in flight must not be overwritten
    // by the answer to it.
    return () => {
      current = false;
    };
  }, [documentType, isNda]);

  /* Both are derived rather than cleared when the agreement changes: a template
   * belongs to the document it was fetched for, and a stale one is simply not it. */
  const template = loaded?.id === documentType ? loaded : null;
  const templateError =
    failed && failed === documentType ? "That agreement could not be loaded." : null;

  /**
   * Keep the draft.
   *
   * The id is passed in rather than read from state: on the turn that switches
   * agreement it has only just been cleared, and a stale closure would save the
   * new agreement straight over the old draft.
   */
  const persist = async (
    turn: number,
    id: number | null,
    type: string,
    values: NdaValues | FieldValues,
    conversation: ChatMessage[],
  ) => {
    const body = { documentType: type, values, messages: conversation };
    try {
      const saved = id === null ? await createDraft(body) : await saveDraft(id, body);
      // The user may have opened another draft while this was saving. Adopting
      // this id now would point the desk at a draft it is no longer showing, and
      // the next turn would write the open document over it.
      if (turn !== generation.current) return;
      setDraftId(saved.id);
      setRevision((count) => count + 1);
    } catch {
      /* A failed save must not take the conversation down with it: the work is
       * still on screen, and the next turn saves again. */
    }
  };

  /**
   * One turn of the interview: say it, hear back, fold the answer into the desk,
   * and keep the draft.
   *
   * This lives here rather than in the chat panel because the answer belongs to
   * the document that asked for it. A turn takes seconds; if the user opens a
   * different draft while it is in flight, the reply is dropped rather than
   * applied to whatever happens to be on screen when it lands.
   *
   * A change of agreement wipes the values first: what was collected for one
   * agreement means nothing in another. The patch itself still applies, because
   * the backend re-asks for the turn once it knows which agreement was chosen —
   * so the values the user gave in the same breath as "I need a CSA" survive.
   */
  const submitTurn = async (content: string) => {
    const turn = generation.current;

    // The reply must answer the message we are about to send, so the turn goes
    // up with the history rather than waiting on a state update.
    const history: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(history);

    const reply: ChatReply = await sendChat(history, values, documentType);
    if (turn !== generation.current) return;

    const conversation: ChatMessage[] = [
      ...history,
      { role: "assistant", content: reply.reply },
    ];
    setMessages(conversation);
    applyReply(reply, conversation, turn);
  };

  const applyReply = (
    reply: ChatReply,
    conversation: ChatMessage[],
    turn = generation.current,
  ) => {
    const switched = reply.documentType !== documentType;
    const type = reply.documentType;

    if (switched) {
      setDocumentType(type);
      setActiveField(null);
      setDraftId(null);
    }

    /* `documentType` is what says which of the two shapes `updates` is, and
     * TypeScript cannot narrow a union on a separate field, so each branch
     * asserts the shape the backend built its schema for. */
    // A new agreement is a new draft, not an edit of the last one.
    const id = switched ? null : draftId;

    if (type === MUTUAL_NDA_ID) {
      const updates = reply.updates as NdaUpdates;
      const next = applyUpdates(switched ? DEFAULT_VALUES : ndaValues, updates);
      setNdaValues(next);
      setFieldValues({});
      setActiveField(updatedCoverPageFields(updates).at(-1) ?? null);
      void persist(turn, id, type, next, conversation);
      return;
    }

    if (type) {
      const updates = reply.updates as FieldValues;
      const next = mergeFields(switched ? {} : fieldValues, updates);
      setFieldValues(next);
      setNdaValues(DEFAULT_VALUES);
      setActiveField(
        Object.keys(updates)
          .filter((field) => updates[field])
          .at(-1) ?? null,
      );
      void persist(turn, id, type, next, conversation);
    }
  };

  /** Pick up a saved draft: the agreement, its values, and the conversation. */
  const openDraft = async (id: number) => {
    const draft = await fetchDraft(id);

    // Anything still in flight for the document we are leaving is now stale.
    generation.current += 1;
    setDraftId(draft.id);
    setDocumentType(draft.documentType);
    setMessages(draft.messages);
    setActiveField(null);

    if (draft.documentType === MUTUAL_NDA_ID) {
      setNdaValues({ ...DEFAULT_VALUES, ...(draft.values as NdaValues) });
      setFieldValues({});
    } else {
      setFieldValues(draft.values as FieldValues);
      setNdaValues(DEFAULT_VALUES);
    }
  };

  /** Clear the desk for a new agreement. The saved draft stays saved. */
  const newDraft = () => {
    generation.current += 1;
    setDraftId(null);
    setDocumentType(null);
    setMessages([]);
    setNdaValues(DEFAULT_VALUES);
    setFieldValues({});
    setActiveField(null);
  };

  const values: NdaValues | FieldValues = isNda ? ndaValues : fieldValues;

  const blanks = isNda
    ? missingFields(ndaValues)
    : template
      ? missingTemplateFields(template, fieldValues)
      : [];

  const fileName = isNda
    ? documentFileName(ndaValues)
    : template
      ? templateFileName(template, fieldValues)
      : "Agreement";

  return {
    documentType,
    template,
    templateError,
    isNda,
    ndaValues,
    fieldValues,
    values,
    messages,
    activeField,
    blanks,
    fileName,
    draftId,
    revision,
    submitTurn,
    applyReply,
    openDraft,
    newDraft,
  };
}
