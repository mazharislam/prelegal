"use client";

import { useEffect, useRef, useState } from "react";

import { ApiError, type ChatMessage, type ChatReply, sendChat } from "@/lib/api";
import type { FieldValues } from "@/lib/documents";
import type { NdaValues } from "@/lib/nda";

/* Written here rather than fetched: the opening question never varies, and
 * spending a model call — and eight seconds — to say hello is a poor trade. */
const GREETING =
  "I can draft a legal agreement with you — an NDA, a cloud service agreement, " +
  "a pilot, a DPA, and a few others. Tell me what you need, or just describe " +
  "the deal and we will work out which agreement fits.";

interface ChatPanelProps {
  values: NdaValues | FieldValues;
  documentType: string | null;
  onReply: (reply: ChatReply) => void;
}

export function ChatPanel({ values, documentType, onReply }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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

    // The reply must answer the message we are about to send, so the turn goes
    // up with the history rather than waiting on a state update.
    const history: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(history);
    setDraft("");
    setError(null);
    setThinking(true);

    try {
      const reply = await sendChat(history, values, documentType);
      setMessages([...history, { role: "assistant", content: reply.reply }]);
      onReply(reply);
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
          className="w-full resize-none rounded-md border border-desk-line bg-desk px-3 py-2 text-[15px] text-chalk placeholder:text-chalk-soft/50 focus:border-marker focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={send}
          disabled={thinking || draft.trim() === ""}
          className="mt-2 w-full rounded-md bg-marker px-4 py-2 text-[14px] font-semibold text-ink transition-colors hover:bg-[#f9e9a4] disabled:cursor-not-allowed disabled:opacity-50"
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
      <div className={isUser ? "max-w-[85%]" : ""}>
        <p className="font-[family-name:var(--font-utility)] text-[10px] tracking-[0.14em] text-chalk-soft uppercase">
          {isUser ? "You" : "Assistant"}
        </p>
        <p
          className={`mt-1 rounded-md px-3 py-2 text-[14px] leading-relaxed whitespace-pre-wrap ${
            isUser ? "bg-desk text-chalk" : "bg-desk text-chalk-soft"
          }`}
        >
          {content}
        </p>
      </div>
    </div>
  );
}

function Thinking() {
  return (
    <p className="font-[family-name:var(--font-utility)] text-[11px] tracking-[0.1em] text-chalk-soft uppercase">
      Thinking...
    </p>
  );
}
