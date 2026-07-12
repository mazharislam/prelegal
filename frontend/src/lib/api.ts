/**
 * Client for the Prelegal API.
 *
 * In the container the frontend is served by the same FastAPI process that
 * answers these calls, so the base URL is empty and requests are same-origin.
 * `next dev` runs on a different port and sets NEXT_PUBLIC_API_BASE_URL to
 * reach the backend; `credentials: "include"` is what carries the session
 * cookie in that cross-origin case.
 */

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
    throw new ApiError(`Request failed (${response.status})`, response.status);
  }

  return (await response.json()) as T;
}

/**
 * Signs in. There is no password: the backend takes the email on trust and
 * creates the user on first sight. Real credentials arrive with PL-7.
 */
export function login(email: string): Promise<User> {
  return request<User>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function logout(): Promise<void> {
  return request<void>("/api/auth/logout", { method: "POST" });
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatReply {
  reply: string;
  updates: NdaUpdates;
}

/**
 * One turn of the NDA interview. The whole conversation and the document so far
 * go up; a reply and a patch of newly-learned fields come back.
 */
export function sendChat(
  messages: ChatMessage[],
  values: NdaValues,
): Promise<ChatReply> {
  return request<ChatReply>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ messages, values }),
  });
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
