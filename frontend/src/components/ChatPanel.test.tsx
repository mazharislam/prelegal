// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatPanel } from "./ChatPanel";
import { ApiError, type ChatMessage } from "@/lib/api";

afterEach(cleanup);

const REPLY = "Got it. Who is the other party?";

/**
 * The desk owns the conversation and the turn; the panel only says the message
 * and shows what came back. This stands in for the desk.
 */
function Harness({ onSend }: { onSend: (content: string) => Promise<void> }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const send = async (content: string) => {
    setMessages((current) => [...current, { role: "user", content }]);
    await onSend(content);
    setMessages((current) => [...current, { role: "assistant", content: REPLY }]);
  };

  return <ChatPanel messages={messages} onSend={send} />;
}

function renderPanel(onSend = vi.fn().mockResolvedValue(undefined)) {
  render(<Harness onSend={onSend} />);
  return { onSend, textbox: screen.getByRole("textbox") };
}

const sendButton = () => screen.getByRole("button", { name: "Send" });

describe("ChatPanel", () => {
  it("opens with a greeting and nothing to send", () => {
    renderPanel();

    expect(screen.getByText(/draft a legal agreement/i)).toBeInTheDocument();
    expect(sendButton()).toBeDisabled();
  });

  it("hands the message to the desk and shows the answer", async () => {
    const { onSend, textbox } = renderPanel();

    await userEvent.type(textbox, "Delaware law");
    await userEvent.click(sendButton());

    await waitFor(() => expect(onSend).toHaveBeenCalledWith("Delaware law"));
    expect(screen.getByText("Delaware law")).toBeInTheDocument();
    expect(await screen.findByText(REPLY)).toBeInTheDocument();
  });

  it("sends on Enter but not on Shift+Enter", async () => {
    const { onSend, textbox } = renderPanel();

    await userEvent.type(textbox, "a line{Shift>}{Enter}{/Shift}still typing");
    expect(onSend).not.toHaveBeenCalled();

    await userEvent.type(screen.getByRole("textbox"), "{Enter}");
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
  });

  it("locks the input while the model is thinking", async () => {
    let finish: () => void = () => {};
    const onSend = vi.fn().mockReturnValue(new Promise<void>((r) => (finish = r)));
    const { textbox } = renderPanel(onSend);

    await userEvent.type(textbox, "Delaware law");
    await userEvent.click(sendButton());

    expect(await screen.findByRole("button", { name: "Thinking..." })).toBeDisabled();
    expect(screen.getByRole("textbox")).toBeDisabled();

    finish();

    await screen.findByText(REPLY);
    expect(screen.getByRole("textbox")).toBeEnabled();
  });

  it("shows a failed turn without losing the conversation", async () => {
    const onSend = vi
      .fn()
      .mockRejectedValue(new ApiError("The claude CLI was not found.", 503));
    const { textbox } = renderPanel(onSend);

    await userEvent.type(textbox, "Delaware law");
    await userEvent.click(sendButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(/claude CLI/i);
    // The user's message stays put, and they can try again.
    expect(screen.getByText("Delaware law")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeEnabled();
  });
});
