import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  type ChatMessage,
  deleteDraft,
  fetchDocumentTypes,
  fetchSession,
  fetchTemplate,
  saveDraft,
  sendChat,
  signIn,
  signOut,
  signUp,
} from "./api";
import { DEFAULT_VALUES } from "./nda";

function mockFetch(response: Partial<Response> & { json?: () => unknown }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
    ...response,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("signIn", () => {
  it("posts the credentials and returns the user", async () => {
    const user = { id: 1, email: "ada@example.com", created_at: "2026-07-11" };
    const fetchMock = mockFetch({ json: async () => user });

    await expect(signIn("ada@example.com", "correct-horse")).resolves.toEqual(user);

    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe("/api/auth/signin");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      email: "ada@example.com",
      password: "correct-horse",
    });
    /* Without this the session cookie is dropped when `next dev` talks to the
     * backend on another origin. */
    expect(init.credentials).toBe("include");
  });

  it("carries the backend's own words back, not a status code", async () => {
    mockFetch({
      ok: false,
      status: 401,
      json: async () => ({ detail: "That email and password do not match an account." }),
    });

    await expect(signIn("ada@example.com", "guessing!!")).rejects.toThrow(
      /do not match an account/,
    );
  });

  it("explains an unreachable server", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));

    await expect(signIn("ada@example.com", "correct-horse")).rejects.toThrow(ApiError);
    await expect(signIn("ada@example.com", "correct-horse")).rejects.toThrow(
      /backend running/,
    );
  });
});

describe("fetchSession", () => {
  it("returns the signed-in user", async () => {
    const user = { id: 7, email: "ada@example.com", created_at: "2026-07-11" };
    mockFetch({ json: async () => user });

    await expect(fetchSession()).resolves.toEqual(user);
  });

  it("returns null when nobody is signed in", async () => {
    mockFetch({ ok: false, status: 401 });

    await expect(fetchSession()).resolves.toBeNull();
  });

  it("still throws when the server itself is failing", async () => {
    mockFetch({ ok: false, status: 500 });

    await expect(fetchSession()).rejects.toThrow(ApiError);
  });
});

describe("sendChat", () => {
  it("posts the conversation, the document, and which agreement is in play", async () => {
    const answer = {
      reply: "Got it.",
      updates: { governingLaw: "Delaware" },
      documentType: "mutual-nda",
      unsupported: null,
    };
    const fetchMock = mockFetch({ json: async () => answer });
    const messages: ChatMessage[] = [{ role: "user", content: "Delaware law" }];

    await expect(
      sendChat(messages, DEFAULT_VALUES, "mutual-nda"),
    ).resolves.toEqual(answer);

    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe("/api/chat");
    expect(init.method).toBe("POST");
    // documentType is what picks the schema the model is given, so it must go up.
    expect(JSON.parse(init.body)).toEqual({
      messages,
      values: DEFAULT_VALUES,
      documentType: "mutual-nda",
    });
  });

  it("surfaces a backend without the claude CLI", async () => {
    mockFetch({ ok: false, status: 503 });

    await expect(sendChat([], DEFAULT_VALUES, null)).rejects.toMatchObject({
      status: 503,
    });
  });
});

describe("fetchDocumentTypes", () => {
  it("lists the agreements we can draft", async () => {
    const documents = [
      { id: "csa", name: "Cloud Service Agreement", description: "", fields: [] },
    ];
    const fetchMock = mockFetch({ json: async () => documents });

    await expect(fetchDocumentTypes()).resolves.toEqual(documents);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/documents");
  });
});

describe("fetchTemplate", () => {
  it("fetches one agreement's text", async () => {
    const fetchMock = mockFetch({ json: async () => ({ id: "sla" }) });

    await fetchTemplate("sla");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/documents/sla/template");
  });
});

describe("signUp", () => {
  it("posts the credentials to the signup route", async () => {
    const fetchMock = mockFetch({ json: async () => ({ id: 1 }) });

    await signUp("ada@example.com", "correct-horse");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/signup");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).password).toBe("correct-horse");
  });
});

describe("signOut", () => {
  it("posts to the signout route", async () => {
    const fetchMock = mockFetch({});

    await signOut();

    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/signout");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });
});

describe("drafts", () => {
  it("saves a draft over itself", async () => {
    const fetchMock = mockFetch({ json: async () => ({ id: 3 }) });
    const body = { documentType: "sla", values: {}, messages: [] };

    await saveDraft(3, body);

    expect(fetchMock.mock.calls[0][0]).toBe("/api/drafts/3");
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(body);
  });

  it("deletes a draft, which answers with no content at all", async () => {
    // 204 has no body: parsing one would throw.
    mockFetch({ status: 204, json: async () => Promise.reject(new Error("no body")) });

    await expect(deleteDraft(3)).resolves.toBeUndefined();
  });
});
