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
};

function renderPanel(onUpdates = vi.fn()) {
  render(<ChatPanel values={DEFAULT_VALUES} onUpdates={onUpdates} />);
  return { onUpdates, textbox: screen.getByRole("textbox") };
}

describe("ChatPanel", () => {
  it("opens with a greeting and nothing to send", () => {
    renderPanel();

    expect(screen.getByText(/put together a Mutual NDA/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("sends the turn, shows the reply, and hands back the patch", async () => {
    sendChat.mockResolvedValue(reply);
    const { onUpdates, textbox } = renderPanel();

    await userEvent.type(textbox, "Delaware law");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText(reply.reply)).toBeInTheDocument();
    expect(screen.getByText("Delaware law")).toBeInTheDocument();
    expect(onUpdates).toHaveBeenCalledWith(reply.updates);
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
    const { onUpdates, textbox } = renderPanel();

    await userEvent.type(textbox, "Delaware law");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/claude CLI/i);
    // The user's message stays put, and the document is not touched.
    expect(screen.getByText("Delaware law")).toBeInTheDocument();
    expect(onUpdates).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toBeEnabled();
  });
});
