/**
 * Client for the Prelegal API.
 *
 * In the container the frontend is served by the same FastAPI process that
 * answers these calls, so the base URL is empty and requests are same-origin.
 * `next dev` runs on a different port and sets NEXT_PUBLIC_API_BASE_URL to
 * reach the backend; `credentials: "include"` is what carries the session
 * cookie in that cross-origin case.
 */

import type {
  DocumentSummary,
  DocumentTemplate,
  FieldValues,
} from "@/lib/documents";
import type { NdaUpdates, NdaValues } from "@/lib/nda";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export interface User {
  id: number;
  email: string;
  created_at: string;
}

export class ApiError extends Error {
  /** Absent when the request never reached the server. */
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiError("Could not reach the server. Is the backend running?");
  }

  if (!response.ok) {
    throw new ApiError(await errorDetail(response), response.status);
  }

  // A deleted draft answers 204, with nothing to parse.
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

/**
 * The backend explains its refusals — "that email is taken", "those do not match
 * an account" — and the user should read that, not a status code.
 */
async function errorDetail(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    /* Not every failure has a JSON body; fall back to the status. */
  }
  return `Request failed (${response.status})`;
}

export function signUp(email: string, password: string): Promise<User> {
  return request<User>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function signIn(email: string, password: string): Promise<User> {
  return request<User>("/api/auth/signin", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function signOut(): Promise<void> {
  return request<void>("/api/auth/signout", { method: "POST" });
}

/* ------------------------------------------------------------------ drafts */

export interface DraftSummary {
  id: number;
  documentType: string;
  name: string;
  blanks: number;
  updated_at: string;
}

export interface Draft {
  id: number;
  documentType: string;
  name: string;
  values: NdaValues | FieldValues;
  messages: ChatMessage[];
  updated_at: string;
}

interface DraftBody {
  documentType: string;
  values: NdaValues | FieldValues;
  messages: ChatMessage[];
}

export function listDrafts(): Promise<DraftSummary[]> {
  return request<DraftSummary[]>("/api/drafts");
}

export function fetchDraft(id: number): Promise<Draft> {
  return request<Draft>(`/api/drafts/${id}`);
}

export function createDraft(draft: DraftBody): Promise<Draft> {
  return request<Draft>("/api/drafts", {
    method: "POST",
    body: JSON.stringify(draft),
  });
}

export function saveDraft(id: number, draft: DraftBody): Promise<Draft> {
  return request<Draft>(`/api/drafts/${id}`, {
    method: "PUT",
    body: JSON.stringify(draft),
  });
}

export function deleteDraft(id: number): Promise<void> {
  return request<void>(`/api/drafts/${id}`, { method: "DELETE" });
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Unsupported {
  requested: string;
  closest: string | null;
}

export interface ChatReply {
  reply: string;
  /**
   * The NDA answers with a typed patch; every other agreement with a field map.
   * It is one or the other, never both — `documentType` says which, and the two
   * shapes are not interchangeable (the NDA nests a party; a field map cannot).
   */
  updates: NdaUpdates | FieldValues;
  /** The agreement the assistant has settled on, or null while it is still asking. */
  documentType: string | null;
  /** Set when the user asked for an agreement we have no template for. */
  unsupported: Unsupported | null;
}

/**
 * One turn of the interview. The conversation, the document so far, and which
 * agreement is on the table all go up; a reply and a patch come back.
 *
 * `documentType` is what tells the backend which schema to hand the model, so
 * the patch always belongs to the agreement actually being drafted.
 */
export function sendChat(
  messages: ChatMessage[],
  values: NdaValues | FieldValues,
  documentType: string | null,
): Promise<ChatReply> {
  return request<ChatReply>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ messages, values, documentType }),
  });
}

/** Every agreement we can draft. */
export function fetchDocumentTypes(): Promise<DocumentSummary[]> {
  return request<DocumentSummary[]>("/api/documents");
}

/** The text of one agreement, parsed into lines a renderer can lay out. */
export function fetchTemplate(documentId: string): Promise<DocumentTemplate> {
  return request<DocumentTemplate>(`/api/documents/${documentId}/template`);
}

/** The signed-in user, or null when there is no session. */
export async function fetchSession(): Promise<User | null> {
  try {
    return await request<User>("/api/auth/me");
  } catch (error) {
    // A 401 is the ordinary "nobody is signed in" answer, not a failure.
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
