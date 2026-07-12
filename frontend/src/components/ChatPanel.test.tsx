// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatPanel } from "./ChatPanel";
import { ApiError } from "@/lib/api";
import { DEFAULT_VALUES } from "@/lib/nda";

const sendChat = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  sendChat,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const reply = {
  reply: "Got it. Who is the other party?",
  updates: { governingLaw: "Delaware" },
  documentType: "mutual-nda",
  unsupported: null,
};

function renderPanel(onReply = vi.fn(), documentType: string | null = "mutual-nda") {
  render(
    <ChatPanel
      values={DEFAULT_VALUES}
      documentType={documentType}
      onReply={onReply}
    />,
  );
  return { onReply, textbox: screen.getByRole("textbox") };
}

describe("ChatPanel", () => {
  it("opens with a greeting and nothing to send", () => {
    renderPanel();

    expect(screen.getByText(/draft a legal agreement/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("sends the turn, shows the reply, and hands back the answer", async () => {
    sendChat.mockResolvedValue(reply);
    const { onReply, textbox } = renderPanel();

    await userEvent.type(textbox, "Delaware law");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText(reply.reply)).toBeInTheDocument();
    expect(screen.getByText("Delaware law")).toBeInTheDocument();
    expect(onReply).toHaveBeenCalledWith(reply);
  });

  it("tells the backend which agreement is in play, so the model gets its schema", async () => {
    sendChat.mockResolvedValue({ ...reply, documentType: "csa" });
    const { textbox } = renderPanel(vi.fn(), "csa");

    await userEvent.type(textbox, "12 month subscription");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(sendChat).toHaveBeenCalled());
    expect(sendChat.mock.calls[0][2]).toBe("csa");
  });

  it("relays a request for an agreement we cannot draft", async () => {
    const declined = {
      reply:
        "I cannot draft an employment contract. The closest I can do is a Professional Services Agreement — shall I?",
      updates: {},
      documentType: null,
      unsupported: { requested: "employment contract", closest: "psa" },
    };
    sendChat.mockResolvedValue(declined);
    const { onReply, textbox } = renderPanel(vi.fn(), null);

    await userEvent.type(textbox, "I need an employment contract");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText(/cannot draft an employment contract/i)).toBeInTheDocument();
    expect(onReply).toHaveBeenCalledWith(declined);
  });

  it("sends the whole conversation, so the model has the history", async () => {
    sendChat.mockResolvedValue(reply);
    const { textbox } = renderPanel();

    await userEvent.type(textbox, "first");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText(reply.reply);

    await userEvent.type(screen.getByRole("textbox"), "second");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(sendChat).toHaveBeenCalledTimes(2));
    const [messages] = sendChat.mock.calls[1];
    expect(messages.map((m: { content: string }) => m.content)).toEqual([
      "first",
      reply.reply,
      "second",
    ]);
  });

  it("sends on Enter but not on Shift+Enter", async () => {
    sendChat.mockResolvedValue(reply);
    const { textbox } = renderPanel();

    await userEvent.type(textbox, "a line{Shift>}{Enter}{/Shift}still typing");
    expect(sendChat).not.toHaveBeenCalled();

    await userEvent.type(screen.getByRole("textbox"), "{Enter}");
    await waitFor(() => expect(sendChat).toHaveBeenCalledTimes(1));
  });

  it("locks the input while the model is thinking", async () => {
    let resolve: (value: typeof reply) => void = () => {};
    sendChat.mockReturnValue(new Promise((r) => (resolve = r)));
    const { textbox } = renderPanel();

    await userEvent.type(textbox, "Delaware law");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("button", { name: "Thinking..." })).toBeDisabled();
    expect(screen.getByRole("textbox")).toBeDisabled();

    resolve(reply);

    await screen.findByText(reply.reply);
    expect(screen.getByRole("textbox")).toBeEnabled();
  });

  it("shows a failed turn without losing the conversation", async () => {
    sendChat.mockRejectedValue(new ApiError("The claude CLI was not found.", 503));
    const { onReply, textbox } = renderPanel();

    await userEvent.type(textbox, "Delaware law");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/claude CLI/i);
    // The user's message stays put, and the document is not touched.
    expect(screen.getByText("Delaware law")).toBeInTheDocument();
    expect(onReply).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toBeEnabled();
  });
});
