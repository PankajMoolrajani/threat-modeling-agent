"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";
import { useOutput } from "@/context/OutputContext";

/* ────────────── types ────────────── */

interface Message {
  id: string;
  sender: "ai" | "user";
  senderName: string;
  content: string;
  timestamp: Date;
  isError?: boolean;
}

/* ────────────── constants ────────────── */

const quickActions = ["Add Frontend SPA", "Define Auth Flow", "Mark External"];

/* ────────────── component ────────────── */

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const { parseAndAddFromResponse } = useOutput();

  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // ─── auto‑scroll to bottom when new messages arrive ───
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // ─── send message to the wowbits agent via the API route ───
  const sendMessageToAgent = useCallback(
    async (userMessage: string) => {
      setIsLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userMessage,
            sessionId,
            userId: "default_user",
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || `Server responded with ${res.status}`);
        }

        // Store session id for follow‑up messages
        if (data.sessionId) {
          setSessionId(data.sessionId);
        }

        // Add agent reply
        const aiMessage: Message = {
          id: `ai-${Date.now()}`,
          sender: "ai",
          senderName: "Security Architect AI",
          content: data.reply,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);

        // Parse and add structured data to output table
        parseAndAddFromResponse(data.reply);
      } catch (err: unknown) {
        const errMsg =
          err instanceof Error ? err.message : "Something went wrong";

        // Build a helpful error message based on the error type
        let displayMsg = `⚠️ ${errMsg}`;
        if (
          errMsg.toLowerCase().includes("cannot connect") ||
          errMsg.toLowerCase().includes("fetch failed")
        ) {
          displayMsg +=
            "\n\nTo fix this, run the agent in a separate terminal:\n" +
            "1. source venv/bin/activate\n" +
            '2. export WOWBITS_DB_CONNECTION_STRING="your_db_url"\n' +
            "3. wowbits run agent thanos";
        }

        const errorMessage: Message = {
          id: `err-${Date.now()}`,
          sender: "ai",
          senderName: "Security Architect AI",
          content: displayMsg,
          timestamp: new Date(),
          isError: true,
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId]
  );

  // ─── handle send button / enter key ───
  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    // Add user message immediately
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      senderName: "You",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");

    // Send to agent
    sendMessageToAgent(text);
  }, [inputValue, isLoading, sendMessageToAgent]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleQuickAction = useCallback(
    (action: string) => {
      if (isLoading) return;
      setInputValue(action);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [isLoading]
  );

  // ─── helper: format timestamp ───
  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  /* ════════════════ RENDER ════════════════ */

  return (
    <div className="w-[40%] bg-white flex flex-col h-full border-r border-gray-100">
      {/* ── AI Profile Header ── */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#4fc3f7] to-[#00b4d8] flex items-center justify-center shadow-sm">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1.5" fill="white" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" fill="white" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" fill="white" />
              <rect
                x="14"
                y="14"
                width="7"
                height="7"
                rx="1.5"
                fill="white"
              />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-gray-800 text-[15px]">
              Security Architect AI
            </h2>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isLoading ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
                }`}
              />
              <p className="text-[13px] text-gray-400">
                {isLoading ? "Thinking…" : "Active Session: Project Phoenix"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Messages ── */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-5 py-5 space-y-5"
      >
        {/* Empty state */}
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#4fc3f7]/20 to-[#00b4d8]/20 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <rect
                  x="3"
                  y="3"
                  width="7"
                  height="7"
                  rx="1.5"
                  fill="#00b4d8"
                />
                <rect
                  x="14"
                  y="3"
                  width="7"
                  height="7"
                  rx="1.5"
                  fill="#00b4d8"
                />
                <rect
                  x="3"
                  y="14"
                  width="7"
                  height="7"
                  rx="1.5"
                  fill="#00b4d8"
                />
                <rect
                  x="14"
                  y="14"
                  width="7"
                  height="7"
                  rx="1.5"
                  fill="#00b4d8"
                />
              </svg>
            </div>
            <p className="text-gray-400 text-sm text-center">
              Describe your architecture to get started.
              <br />
              <span className="text-[12px] text-gray-300">
                Powered by wowbits &amp; Thanos agent
              </span>
            </p>
          </div>
        )}

        {/* Message list */}
        {messages.map((message) => (
          <div key={message.id} className="space-y-1.5">
            {/* Sender label + timestamp */}
            <div
              className={`flex items-center gap-2 text-[11px] text-gray-400 font-medium ${
                message.sender === "user"
                  ? "justify-end pr-12"
                  : "justify-start pl-0"
              }`}
            >
              <span>{message.senderName}</span>
              <span className="text-gray-300">
                {formatTime(message.timestamp)}
              </span>
            </div>

            {/* Message bubble */}
            <div
              className={`flex items-end gap-2.5 ${
                message.sender === "user" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              {/* Avatar */}
              {message.sender === "ai" ? (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4fc3f7] to-[#00b4d8] flex items-center justify-center shrink-0 shadow-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <rect
                      x="3"
                      y="3"
                      width="7"
                      height="7"
                      rx="1.5"
                      fill="white"
                    />
                    <rect
                      x="14"
                      y="3"
                      width="7"
                      height="7"
                      rx="1.5"
                      fill="white"
                    />
                    <rect
                      x="3"
                      y="14"
                      width="7"
                      height="7"
                      rx="1.5"
                      fill="white"
                    />
                    <rect
                      x="14"
                      y="14"
                      width="7"
                      height="7"
                      rx="1.5"
                      fill="white"
                    />
                  </svg>
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-300 to-amber-400 flex items-center justify-center shrink-0 shadow-sm">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="8" r="4" fill="white" />
                    <path
                      d="M5 20c0-3.5 3.5-5.5 7-5.5s7 2 7 5.5"
                      fill="white"
                    />
                  </svg>
                </div>
              )}

              {/* Bubble */}
              <div
                className={`max-w-[80%] px-4 py-3 text-[14px] leading-relaxed ${
                  message.sender === "user"
                    ? "bg-[#00b4d8] text-white rounded-2xl rounded-br-md"
                    : message.isError
                    ? "bg-red-50 text-red-700 rounded-2xl rounded-bl-md border border-red-200"
                    : "bg-[#f0f9ff] text-gray-700 rounded-2xl rounded-bl-md border border-[#e0f2fe]"
                }`}
              >
                <p className="whitespace-pre-line">{message.content}</p>
              </div>
            </div>
          </div>
        ))}

        {/* ── Typing / loading indicator ── */}
        {isLoading && (
          <div className="space-y-1.5">
            <p className="text-[11px] text-gray-400 font-medium pl-0">
              Security Architect AI
            </p>
            <div className="flex items-end gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4fc3f7] to-[#00b4d8] flex items-center justify-center shrink-0 shadow-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="3"
                    y="3"
                    width="7"
                    height="7"
                    rx="1.5"
                    fill="white"
                  />
                  <rect
                    x="14"
                    y="3"
                    width="7"
                    height="7"
                    rx="1.5"
                    fill="white"
                  />
                  <rect
                    x="3"
                    y="14"
                    width="7"
                    height="7"
                    rx="1.5"
                    fill="white"
                  />
                  <rect
                    x="14"
                    y="14"
                    width="7"
                    height="7"
                    rx="1.5"
                    fill="white"
                  />
                </svg>
              </div>
              <div className="bg-[#f0f9ff] border border-[#e0f2fe] rounded-2xl rounded-bl-md px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Loader2 size={16} className="text-[#00b4d8] animate-spin" />
                  <span className="text-[13px] text-gray-400">
                    Agent is thinking…
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* invisible anchor so scrollToBottom works */}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Quick Actions ── */}
      <div className="px-5 py-3">
        <div className="flex gap-2 flex-wrap">
          {quickActions.map((action) => (
            <button
              key={action}
              onClick={() => handleQuickAction(action)}
              disabled={isLoading}
              className="px-4 py-2 bg-white hover:bg-[#00b4d8] hover:text-white text-gray-600 text-[13px] rounded-full transition-all duration-200 border border-gray-200 hover:border-[#00b4d8] font-medium active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-600 disabled:hover:border-gray-200"
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* ── Input Area ── */}
      <div className="px-5 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-200 focus-within:bg-white focus-within:border-[#00b4d8]/40 transition-all">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={
              isLoading
                ? "Waiting for agent response…"
                : "Describe your architecture…"
            }
            disabled={isLoading}
            className="flex-1 bg-transparent outline-none border-0 focus:outline-none focus:ring-0 focus:border-0 text-gray-700 text-[14px] placeholder-gray-400 disabled:cursor-not-allowed"
            style={{ border: "none", outline: "none" }}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="w-9 h-9 bg-[#00b4d8] hover:bg-[#0096c7] disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-colors shrink-0"
          >
            {isLoading ? (
              <Loader2 size={16} className="text-white animate-spin" />
            ) : (
              <Send size={16} className="text-white" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
