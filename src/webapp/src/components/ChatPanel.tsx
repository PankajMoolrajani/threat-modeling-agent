"use client";

import { useState, useRef } from "react";
import { Send } from "lucide-react";

interface Message {
  id: number;
  sender: "ai" | "user";
  senderName: string;
  content: string;
}

const quickActions = ["Add Frontend SPA", "Define Auth Flow", "Mark External"];

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: messages.length + 1,
      sender: "user",
      senderName: "You",
      content: inputValue,
    };

    setMessages([...messages, newMessage]);
    setInputValue("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (action: string) => {
    setInputValue(action);
    // Focus the input field
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  return (
    <div className="w-[40%] bg-white flex flex-col h-full border-r border-gray-100">
      {/* AI Profile Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#4fc3f7] to-[#00b4d8] flex items-center justify-center shadow-sm">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1.5" fill="white" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" fill="white" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" fill="white" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" fill="white" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-gray-800 text-[15px]">Security Architect AI</h2>
            <p className="text-[13px] text-gray-400">Active Session: Project Phoenix</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 text-sm">No messages yet. Start a conversation!</p>
          </div>
        )}
        {messages.map((message) => (
          <div key={message.id} className="space-y-1.5">
            {/* Sender label */}
            <p
              className={`text-[11px] text-gray-400 font-medium ${
                message.sender === "user" ? "text-right pr-12" : "text-left pl-0"
              }`}
            >
              {message.senderName}
            </p>

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
                    <rect x="3" y="3" width="7" height="7" rx="1.5" fill="white" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" fill="white" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" fill="white" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" fill="white" />
                  </svg>
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-300 to-amber-400 flex items-center justify-center shrink-0 shadow-sm">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="8" r="4" fill="white" />
                    <path d="M5 20c0-3.5 3.5-5.5 7-5.5s7 2 7 5.5" fill="white" />
                  </svg>
                </div>
              )}

              {/* Bubble */}
              <div
                className={`max-w-[80%] px-4 py-3 text-[14px] leading-relaxed ${
                  message.sender === "user"
                    ? "bg-[#00b4d8] text-white rounded-2xl rounded-br-md"
                    : "bg-[#f0f9ff] text-gray-700 rounded-2xl rounded-bl-md border border-[#e0f2fe]"
                }`}
              >
                <p className="whitespace-pre-line">{message.content}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="px-5 py-3">
        <div className="flex gap-2">
          {quickActions.map((action) => (
            <button
              key={action}
              onClick={() => handleQuickAction(action)}
              className="px-4 py-2 bg-white hover:bg-[#00b4d8] hover:text-white text-gray-600 text-[13px] rounded-full transition-all duration-200 border border-gray-200 hover:border-[#00b4d8] font-medium active:scale-95"
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="px-5 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-200 focus-within:bg-white transition-all">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Describe your architecture..."
            className="flex-1 bg-transparent outline-none border-0 focus:outline-none focus:ring-0 focus:border-0 text-gray-700 text-[14px] placeholder-gray-400"
            style={{ border: 'none', outline: 'none' }}
          />
          <button
            onClick={handleSend}
            className="w-9 h-9 bg-[#00b4d8] hover:bg-[#0096c7] rounded-lg flex items-center justify-center transition-colors shrink-0"
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
