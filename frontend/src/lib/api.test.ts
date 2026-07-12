import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, fetchSession, login, logout } from "./api";

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

describe("login", () => {
  it("posts the email and returns the user", async () => {
    const user = { id: 1, email: "ada@example.com", created_at: "2026-07-11" };
    const fetchMock = mockFetch({ json: async () => user });

    await expect(login("ada@example.com")).resolves.toEqual(user);

    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe("/api/auth/login");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ email: "ada@example.com" }));
    /* Without this the session cookie is dropped when `next dev` talks to the
     * backend on another origin. */
    expect(init.credentials).toBe("include");
  });

  it("reports a rejected email with its status", async () => {
    mockFetch({ ok: false, status: 422 });

    await expect(login("nope")).rejects.toMatchObject({ status: 422 });
  });

  it("explains an unreachable server", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));

    await expect(login("ada@example.com")).rejects.toThrow(ApiError);
    await expect(login("ada@example.com")).rejects.toThrow(/backend running/);
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

describe("logout", () => {
  it("posts to the logout route", async () => {
    const fetchMock = mockFetch({});

    await logout();

    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/logout");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });
});
