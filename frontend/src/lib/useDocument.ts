"use client";

import { useEffect, useState } from "react";

import type { ChatReply } from "@/lib/api";
import { fetchTemplate } from "@/lib/api";
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
 * The agreement on the desk, and everything the chat learns about it.
 *
 * Two shapes live here because the documents are two kinds. The Mutual NDA is
 * drafted by hand and its values are typed — its term is a choice, not a string.
 * Every other agreement is standard terms whose fields the backend derives from
 * the template, so its values are a plain map. The desk does not care which it
 * is holding; it asks this hook what to render, what is still blank, and what to
 * call the file.
 */
export function useDocument() {
  const [documentType, setDocumentType] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<DocumentTemplate | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [ndaValues, setNdaValues] = useState<NdaValues>(DEFAULT_VALUES);
  const [fieldValues, setFieldValues] = useState<FieldValues>({});
  const [activeField, setActiveField] = useState<string | null>(null);

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
   * Fold a turn's answer into the desk.
   *
   * A change of agreement wipes the values first: what was collected for one
   * agreement means nothing in another. The patch itself still applies, because
   * the backend re-asks for the turn once it knows which agreement was chosen —
   * so the values the user gave in the same breath as "I need a CSA" survive.
   */
  const applyReply = (reply: ChatReply) => {
    const switched = reply.documentType !== documentType;
    if (switched) {
      setDocumentType(reply.documentType);
      setNdaValues(DEFAULT_VALUES);
      setFieldValues({});
      setActiveField(null);
    }

    /* `documentType` is what says which of the two shapes `updates` is, and
     * TypeScript cannot narrow a union on a separate field, so each branch
     * asserts the shape the backend built its schema for. */
    if (reply.documentType === MUTUAL_NDA_ID) {
      const updates = reply.updates as NdaUpdates;
      const base = switched ? DEFAULT_VALUES : ndaValues;
      setNdaValues(applyUpdates(base, updates));
      setActiveField(updatedCoverPageFields(updates).at(-1) ?? null);
      return;
    }

    if (reply.documentType) {
      const updates = reply.updates as FieldValues;
      const base = switched ? {} : fieldValues;
      setFieldValues(mergeFields(base, updates));
      setActiveField(
        Object.keys(updates)
          .filter((field) => updates[field])
          .at(-1) ?? null,
      );
    }
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
    activeField,
    blanks,
    fileName,
    applyReply,
  };
}
