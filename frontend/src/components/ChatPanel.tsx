"use client";

import { useEffect, useRef, useState } from "react";

import { ApiError, type ChatMessage } from "@/lib/api";

/* Written here rather than fetched: the opening question never varies, and
 * spending a model call — and eight seconds — to say hello is a poor trade. */
const GREETING =
  "I can draft a legal agreement with you — an NDA, a cloud service agreement, " +
  "a pilot, a DPA, and a few others. Tell me what you need, or just describe " +
  "the deal and we will work out which agreement fits.";

interface ChatPanelProps {
  /**
   * The conversation lives on the desk, not here: it is saved with the draft and
   * comes back when the draft is reopened, and the answer to a turn belongs to
   * the document that asked for it. This panel says the message and shows what
   * came back.
   */
  messages: ChatMessage[];
  onSend: (content: string) => Promise<void>;
}

export function ChatPanel({ messages, onSend }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadEnd.current?.scrollIntoView({ block: "end" });
  }, [messages, thinking]);

  const send = async () => {
    const content = draft.trim();
    if (!content || thinking) return;

    setDraft("");
    setError(null);
    setThinking(true);

    try {
      await onSend(content);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setThinking(false);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter is a newline, as in every other chat.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto" aria-live="polite">
        <Bubble role="assistant" content={GREETING} />
        {messages.map((message, index) => (
          <Bubble key={index} role={message.role} content={message.content} />
        ))}
        {thinking ? <Thinking /> : null}
        {error ? (
          <p role="alert" className="text-[13px] text-pencil">
            {error}
          </p>
        ) : null}
        <div ref={threadEnd} />
      </div>

      <div className="mt-4 shrink-0">
        <label htmlFor="chat" className="sr-only">
          Message
        </label>
        <textarea
          id="chat"
          rows={3}
          value={draft}
          disabled={thinking}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Tell me about the agreement..."
          className="w-full resize-none rounded-lg border border-card-line bg-card px-3 py-2 text-[15px] text-body placeholder:text-muted/60 focus:border-blue focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={send}
          disabled={thinking || draft.trim() === ""}
          className="mt-2 w-full rounded-lg bg-blue-soft px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-blue disabled:cursor-not-allowed disabled:opacity-50"
        >
          {thinking ? "Thinking..." : "Send"}
        </button>
      </div>
    </div>
  );
}

function Bubble({ role, content }: ChatMessage) {
  const isUser = role === "user";
  return (
    <div className={isUser ? "flex justify-end" : ""}>
      <p
        className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "rounded-br-sm bg-blue-soft text-white"
            : "rounded-bl-sm border border-card-line bg-card text-body"
        }`}
      >
        {content}
      </p>
    </div>
  );
}

function Thinking() {
  return (
    <p
      className="font-[family-name:var(--font-utility)] text-[11px] tracking-[0.1em] text-muted uppercase"
      aria-label="Thinking"
    >
      Thinking...
    </p>
  );
}
