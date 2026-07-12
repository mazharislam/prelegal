// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChatMessage, ChatReply } from "./api";
import { useDocument } from "./useDocument";

const fetchTemplate = vi.hoisted(() => vi.fn());
const createDraft = vi.hoisted(() => vi.fn());
const saveDraft = vi.hoisted(() => vi.fn());
const fetchDraft = vi.hoisted(() => vi.fn());
const sendChat = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchTemplate,
  createDraft,
  saveDraft,
  fetchDraft,
  sendChat,
}));

afterEach(() => vi.clearAllMocks());

const sla = {
  id: "sla",
  name: "Service Level Agreement",
  title: "Service Level Agreement",
  fields: ["Target Uptime", "Provider"],
  lines: [],
};

const conversation: ChatMessage[] = [{ role: "user", content: "an SLA please" }];

function reply(overrides: Partial<ChatReply>): ChatReply {
  return {
    reply: "ok",
    updates: {},
    documentType: null,
    unsupported: null,
    ...overrides,
  } as ChatReply;
}

function setUp() {
  fetchTemplate.mockResolvedValue(sla);
  createDraft.mockImplementation((body) => Promise.resolve({ id: 7, ...body }));
  saveDraft.mockImplementation((id, body) => Promise.resolve({ id, ...body }));
  return renderHook(() => useDocument());
}

describe("submitTurn", () => {
  it("says the message, applies the answer, and keeps the draft", async () => {
    const { result } = setUp();
    sendChat.mockResolvedValue(
      reply({ documentType: "sla", updates: { Provider: "Globex" } }),
    );

    await act(() => result.current.submitTurn("an SLA please"));

    expect(sendChat).toHaveBeenCalledWith(
      [{ role: "user", content: "an SLA please" }],
      {},
      null,
    );
    expect(result.current.messages).toEqual([
      { role: "user", content: "an SLA please" },
      { role: "assistant", content: "ok" },
    ]);
    expect(result.current.fieldValues).toEqual({ Provider: "Globex" });
    await waitFor(() => expect(createDraft).toHaveBeenCalled());
  });

  it("leaves the user's message on screen when the turn fails", async () => {
    const { result } = setUp();
    sendChat.mockRejectedValue(new Error("offline"));

    await act(async () => {
      await expect(result.current.submitTurn("an SLA please")).rejects.toThrow(
        "offline",
      );
    });

    // The panel shows the error; the message the user typed is not thrown away.
    expect(result.current.messages).toEqual([
      { role: "user", content: "an SLA please" },
    ]);
  });
});

describe("useDocument", () => {
  it("starts with an empty desk", () => {
    const { result } = setUp();

    expect(result.current.documentType).toBeNull();
    expect(result.current.draftId).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(result.current.blanks).toEqual([]);
  });

  it("loads the agreement the assistant settles on", async () => {
    const { result } = setUp();

    act(() =>
      result.current.applyReply(reply({ documentType: "sla" }), conversation),
    );

    await waitFor(() => expect(result.current.template).toEqual(sla));
    expect(result.current.blanks).toEqual(["Target Uptime", "Provider"]);
  });

  it("fills in the values the assistant learns", async () => {
    const { result } = setUp();

    act(() =>
      result.current.applyReply(reply({ documentType: "sla" }), conversation),
    );
    await waitFor(() => expect(result.current.template).toEqual(sla));

    act(() =>
      result.current.applyReply(
        reply({ documentType: "sla", updates: { "Target Uptime": "99.9%" } }),
        conversation,
      ),
    );

    expect(result.current.fieldValues).toEqual({ "Target Uptime": "99.9%" });
    expect(result.current.activeField).toBe("Target Uptime");
    expect(result.current.blanks).toEqual(["Provider"]);
  });

  it("saves the draft after the first turn, and saves over it after the next", async () => {
    const { result } = setUp();

    act(() =>
      result.current.applyReply(reply({ documentType: "sla" }), conversation),
    );

    await waitFor(() => expect(createDraft).toHaveBeenCalledTimes(1));
    expect(createDraft).toHaveBeenCalledWith({
      documentType: "sla",
      values: {},
      messages: conversation,
    });
    await waitFor(() => expect(result.current.draftId).toBe(7));

    act(() =>
      result.current.applyReply(
        reply({ documentType: "sla", updates: { "Target Uptime": "99.9%" } }),
        conversation,
      ),
    );

    // Saved over the same draft, not saved as a second one.
    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1));
    expect(saveDraft).toHaveBeenCalledWith(7, {
      documentType: "sla",
      values: { "Target Uptime": "99.9%" },
      messages: conversation,
    });
    expect(createDraft).toHaveBeenCalledTimes(1);
  });

  it("does not save a conversation that has not settled on an agreement", async () => {
    const { result } = setUp();
    sendChat.mockResolvedValue(reply({ documentType: null }));

    await act(() => result.current.submitTurn("what can you draft?"));

    // There is no document yet, so there is nothing to keep.
    expect(result.current.messages).toHaveLength(2);
    expect(createDraft).not.toHaveBeenCalled();
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it("starts a new draft when the agreement changes, rather than overwriting the old one", async () => {
    const { result } = setUp();

    act(() =>
      result.current.applyReply(reply({ documentType: "sla" }), conversation),
    );
    await waitFor(() => expect(result.current.draftId).toBe(7));

    act(() =>
      result.current.applyReply(reply({ documentType: "csa" }), conversation),
    );

    // The SLA draft stays as it was: a different agreement is a different document.
    await waitFor(() => expect(createDraft).toHaveBeenCalledTimes(2));
    expect(saveDraft).not.toHaveBeenCalled();
    expect(result.current.fieldValues).toEqual({});
  });

  it("keeps the values given in the same breath as the agreement", () => {
    const { result } = setUp();

    act(() =>
      result.current.applyReply(
        reply({
          documentType: "csa",
          updates: { Customer: "Acme", "Subscription Period": "12 months" },
        }),
        conversation,
      ),
    );

    expect(result.current.fieldValues).toEqual({
      Customer: "Acme",
      "Subscription Period": "12 months",
    });
  });

  it("reopens a draft with its agreement, its values, and its conversation", async () => {
    const { result } = setUp();
    fetchDraft.mockResolvedValue({
      id: 3,
      documentType: "sla",
      name: "Service Level Agreement",
      values: { "Target Uptime": "99.9%" },
      messages: conversation,
      updated_at: "2026-07-12",
    });

    await act(() => result.current.openDraft(3));

    expect(result.current.draftId).toBe(3);
    expect(result.current.documentType).toBe("sla");
    expect(result.current.fieldValues).toEqual({ "Target Uptime": "99.9%" });
    // Without the conversation the assistant would re-ask what it already knows.
    expect(result.current.messages).toEqual(conversation);
  });

  it("keeps drafting the reopened draft rather than starting another", async () => {
    const { result } = setUp();
    fetchDraft.mockResolvedValue({
      id: 3,
      documentType: "sla",
      name: "Service Level Agreement",
      values: {},
      messages: conversation,
      updated_at: "2026-07-12",
    });

    await act(() => result.current.openDraft(3));
    act(() =>
      result.current.applyReply(
        reply({ documentType: "sla", updates: { Provider: "Globex" } }),
        conversation,
      ),
    );

    await waitFor(() => expect(saveDraft).toHaveBeenCalledWith(3, expect.anything()));
    expect(createDraft).not.toHaveBeenCalled();
  });

  it("clears the desk for a new agreement", async () => {
    const { result } = setUp();
    act(() =>
      result.current.applyReply(
        reply({ documentType: "sla", updates: { Provider: "Globex" } }),
        conversation,
      ),
    );
    await waitFor(() => expect(result.current.draftId).toBe(7));

    act(() => result.current.newDraft());

    expect(result.current.documentType).toBeNull();
    expect(result.current.draftId).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(result.current.fieldValues).toEqual({});
  });

  it("keeps the NDA on its own typed values", () => {
    const { result } = setUp();

    act(() =>
      result.current.applyReply(
        reply({
          documentType: "mutual-nda",
          updates: { governingLaw: "Delaware" } as ChatReply["updates"],
        }),
        conversation,
      ),
    );

    expect(result.current.isNda).toBe(true);
    expect(result.current.ndaValues.governingLaw).toBe("Delaware");
    // The NDA is drafted by hand: it has no fetched template.
    expect(fetchTemplate).not.toHaveBeenCalled();
  });

  it("says so when an agreement cannot be loaded", async () => {
    const { result } = setUp();
    fetchTemplate.mockRejectedValue(new Error("nope"));

    act(() =>
      result.current.applyReply(reply({ documentType: "sla" }), conversation),
    );

    await waitFor(() =>
      expect(result.current.templateError).toMatch(/could not be loaded/i),
    );
  });

  it("drops a turn that lands after the user has opened another draft", async () => {
    /**
     * The turn takes seconds and the user can move on. Without this guard the old
     * answer is applied to whatever is on screen when it arrives, and its save
     * writes the open document straight over the draft it was asked for.
     */
    const { result } = setUp();
    let answer: (reply: ChatReply) => void = () => {};
    sendChat.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    fetchDraft.mockResolvedValue({
      id: 9,
      documentType: "csa",
      name: "Cloud Service Agreement",
      values: { Customer: "Acme" },
      messages: [],
      updated_at: "2026-07-12",
    });

    // A turn is in flight on one document...
    let turn: Promise<void>;
    act(() => {
      turn = result.current.submitTurn("an SLA please");
    });

    // ...and the user opens a different draft while it is still out.
    await act(() => result.current.openDraft(9));
    expect(result.current.documentType).toBe("csa");

    // The old answer finally arrives.
    await act(async () => {
      answer(reply({ documentType: "sla", updates: { Provider: "Globex" } }));
      await turn;
    });

    // It is dropped: the desk still shows the draft the user opened, untouched.
    expect(result.current.documentType).toBe("csa");
    expect(result.current.draftId).toBe(9);
    expect(result.current.fieldValues).toEqual({ Customer: "Acme" });
    expect(createDraft).not.toHaveBeenCalled();
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it("drops a save that lands after the user has moved on", async () => {
    // The id it returns must not become the desk's: the desk is showing something
    // else now, and the next turn would save that over this draft.
    const { result } = setUp();
    let saved: (draft: { id: number }) => void = () => {};
    createDraft.mockReturnValue(new Promise((resolve) => (saved = resolve)));

    act(() =>
      result.current.applyReply(reply({ documentType: "sla" }), conversation),
    );
    act(() => result.current.newDraft());

    await act(async () => {
      saved({ id: 5 });
    });

    expect(result.current.draftId).toBeNull();
    expect(result.current.documentType).toBeNull();
  });

  it("keeps the work on screen when a save fails", async () => {
    const { result } = setUp();
    createDraft.mockRejectedValue(new Error("offline"));
    sendChat.mockResolvedValue(
      reply({ documentType: "sla", updates: { Provider: "Globex" } }),
    );

    await act(() => result.current.submitTurn("an SLA please"));

    await waitFor(() => expect(createDraft).toHaveBeenCalled());
    // The work is still on screen; the next turn will save again.
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.fieldValues).toEqual({ Provider: "Globex" });
  });
});
