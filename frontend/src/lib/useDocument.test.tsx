// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChatReply } from "./api";
import { useDocument } from "./useDocument";

const fetchTemplate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchTemplate,
}));

afterEach(() => vi.clearAllMocks());

const sla = {
  id: "sla",
  name: "Service Level Agreement",
  title: "Service Level Agreement",
  fields: ["Target Uptime", "Provider"],
  lines: [],
};

function reply(overrides: Partial<ChatReply>): ChatReply {
  return {
    reply: "ok",
    updates: {},
    documentType: null,
    unsupported: null,
    ...overrides,
  } as ChatReply;
}

describe("useDocument", () => {
  it("starts with no agreement on the desk", () => {
    const { result } = renderHook(() => useDocument());

    expect(result.current.documentType).toBeNull();
    expect(result.current.template).toBeNull();
    expect(result.current.blanks).toEqual([]);
  });

  it("loads the agreement the assistant settles on", async () => {
    fetchTemplate.mockResolvedValue(sla);
    const { result } = renderHook(() => useDocument());

    act(() => result.current.applyReply(reply({ documentType: "sla" })));

    await waitFor(() => expect(result.current.template).toEqual(sla));
    expect(fetchTemplate).toHaveBeenCalledWith("sla");
    expect(result.current.blanks).toEqual(["Target Uptime", "Provider"]);
  });

  it("fills in the values the assistant learns", async () => {
    fetchTemplate.mockResolvedValue(sla);
    const { result } = renderHook(() => useDocument());

    act(() => result.current.applyReply(reply({ documentType: "sla" })));
    await waitFor(() => expect(result.current.template).toEqual(sla));

    act(() =>
      result.current.applyReply(
        reply({ documentType: "sla", updates: { "Target Uptime": "99.9%" } }),
      ),
    );

    expect(result.current.fieldValues).toEqual({ "Target Uptime": "99.9%" });
    expect(result.current.activeField).toBe("Target Uptime");
    expect(result.current.blanks).toEqual(["Provider"]);
  });

  it("does not carry values across when the agreement changes", async () => {
    // A value collected for one agreement means nothing in another.
    fetchTemplate.mockResolvedValue(sla);
    const { result } = renderHook(() => useDocument());

    act(() => result.current.applyReply(reply({ documentType: "sla" })));
    await waitFor(() => expect(result.current.template).toEqual(sla));
    act(() =>
      result.current.applyReply(
        reply({ documentType: "sla", updates: { "Target Uptime": "99.9%" } }),
      ),
    );
    expect(result.current.fieldValues).not.toEqual({});

    act(() => result.current.applyReply(reply({ documentType: "csa" })));

    expect(result.current.fieldValues).toEqual({});
    expect(result.current.activeField).toBeNull();
  });

  it("keeps the values given in the same breath as the agreement", () => {
    // "I need a CSA for Acme, 12 months" names the agreement AND three values.
    // The backend re-asks for that turn once it knows the agreement, so the
    // patch arrives with it — and must not be thrown away as a stale one.
    fetchTemplate.mockResolvedValue(sla);
    const { result } = renderHook(() => useDocument());

    act(() =>
      result.current.applyReply(
        reply({
          documentType: "csa",
          updates: { Customer: "Acme", "Subscription Period": "12 months" },
        }),
      ),
    );

    expect(result.current.fieldValues).toEqual({
      Customer: "Acme",
      "Subscription Period": "12 months",
    });
  });

  it("keeps the NDA on its own typed values", () => {
    const { result } = renderHook(() => useDocument());

    act(() => result.current.applyReply(reply({ documentType: "mutual-nda" })));
    act(() =>
      result.current.applyReply(
        reply({
          documentType: "mutual-nda",
          updates: { governingLaw: "Delaware" } as ChatReply["updates"],
        }),
      ),
    );

    expect(result.current.isNda).toBe(true);
    expect(result.current.ndaValues.governingLaw).toBe("Delaware");
    // The NDA is drafted by hand: it has no fetched template.
    expect(fetchTemplate).not.toHaveBeenCalled();
    expect(result.current.activeField).toBe("governingLaw");
  });

  it("says so when an agreement cannot be loaded", async () => {
    fetchTemplate.mockRejectedValue(new Error("nope"));
    const { result } = renderHook(() => useDocument());

    act(() => result.current.applyReply(reply({ documentType: "sla" })));

    await waitFor(() =>
      expect(result.current.templateError).toMatch(/could not be loaded/i),
    );
  });
});
