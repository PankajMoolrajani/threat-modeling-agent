import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/chat
 *
 * Receives the user's message and session info,
 * forwards it to the wowbits agent (Google ADK web server),
 * and returns the agent's reply.
 *
 * Request body:  { message: string, sessionId?: string, userId?: string }
 * Response:      { reply: string, sessionId: string }
 */

// The ADK web server URL – uses 127.0.0.1 (not localhost) because
// `adk web` binds to 127.0.0.1 by default and some systems resolve
// localhost to IPv6 ::1 which won't connect.
const AGENT_API_URL =
  process.env.AGENT_API_URL || "http://127.0.0.1:8000";

// Agent app name – this is the folder name inside agent_runner/
const AGENT_APP_NAME = process.env.AGENT_APP_NAME || "thanos";

/* ---------- helpers ---------- */

/**
 * Creates a new session on the ADK server.
 * Throws on failure so the caller sees the real error.
 */
async function createSession(userId: string): Promise<string> {
  const url = `${AGENT_API_URL}/apps/${AGENT_APP_NAME}/users/${userId}/sessions`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    console.error("[chat] Cannot connect to ADK server for session creation:", err);
    throw new Error(
      `Cannot connect to wowbits agent at ${AGENT_API_URL}. ` +
        "Make sure the agent is running: wowbits run agent thanos"
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[chat] Session creation failed (${res.status}):`, body);
    throw new Error(
      `Failed to create session (${res.status}): ${body || "Unknown error"}. ` +
        "Make sure the wowbits agent is running."
    );
  }

  const data = await res.json();
  const sessionId = data.id ?? data.session_id;

  if (!sessionId) {
    console.error("[chat] Session response missing id:", data);
    throw new Error("ADK server returned a session without an ID.");
  }

  console.log(`[chat] Session created: ${sessionId}`);
  return sessionId;
}

/**
 * Sends the user message to the ADK /run endpoint and extracts
 * the agent's text reply from the returned events.
 */
async function sendToAgent(
  userId: string,
  sessionId: string,
  message: string
): Promise<string> {
  const payload = {
    app_name: AGENT_APP_NAME,
    user_id: userId,
    session_id: sessionId,
    new_message: {
      role: "user",
      parts: [{ text: message }],
    },
    streaming: false,
  };

  // ── Try /run (non-streaming) ──────────────────────────────
  let runRes: Response;
  try {
    runRes = await fetch(`${AGENT_API_URL}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (err) {
    console.error("[chat] /run connection error:", err);
    throw new Error(
      `Cannot connect to wowbits agent at ${AGENT_API_URL}. ` +
        "Make sure the agent is running."
    );
  }

  if (runRes.ok) {
    const reply = extractReplyFromEvents(await runRes.json());
    if (reply) return reply;
    // If we couldn't extract text, fall through to SSE
    console.warn("[chat] /run returned OK but no text in events, trying /run_sse");
  } else {
    const errorBody = await runRes.text().catch(() => "");
    console.warn(`[chat] /run returned ${runRes.status}:`, errorBody);

    // If 404 = session not found, 422 = validation, 500 = agent error
    // Don't fall through for 500-level errors – show the actual error
    if (runRes.status >= 500) {
      let detail = "Agent execution error";
      try {
        const parsed = JSON.parse(errorBody);
        detail = parsed.detail || parsed.error || parsed.message || detail;
      } catch {
        if (errorBody) detail = errorBody;
      }
      throw new Error(`Agent error: ${detail}`);
    }
  }

  // ── Fallback: /run_sse (note: underscore, not hyphen) ─────
  let sseRes: Response;
  try {
    sseRes = await fetch(`${AGENT_API_URL}/run_sse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (err) {
    console.error("[chat] /run_sse connection error:", err);
    throw new Error(
      `Cannot connect to wowbits agent at ${AGENT_API_URL}. ` +
        "Make sure the agent is running."
    );
  }

  if (sseRes.ok && sseRes.body) {
    const text = await collectSSE(sseRes);
    if (text) return text;
  } else {
    const errorBody = await sseRes.text().catch(() => "");
    console.warn(`[chat] /run_sse returned ${sseRes.status}:`, errorBody);
  }

  throw new Error(
    "The agent did not return any text response. " +
      "This may be a configuration issue with the thanos agent."
  );
}

/**
 * Extracts the last text reply from the ADK /run response (list of events).
 */
function extractReplyFromEvents(data: unknown): string | null {
  if (Array.isArray(data)) {
    // Walk backwards – the last event with text content is the final reply
    for (let i = data.length - 1; i >= 0; i--) {
      const event = data[i];
      const parts = event?.content?.parts;
      if (Array.isArray(parts)) {
        const texts = parts
          .filter((p: Record<string, unknown>) => typeof p.text === "string" && p.text)
          .map((p: Record<string, unknown>) => p.text as string);
        if (texts.length > 0) return texts.join("\n");
      }
    }
    return null;
  }

  // Some ADK versions return a single event object
  if (data && typeof data === "object" && "content" in data) {
    const obj = data as Record<string, unknown>;
    const content = obj.content as Record<string, unknown> | undefined;
    if (content?.parts && Array.isArray(content.parts)) {
      const texts = content.parts
        .filter((p: Record<string, unknown>) => typeof p.text === "string" && p.text)
        .map((p: Record<string, unknown>) => p.text as string);
      if (texts.length > 0) return texts.join("\n");
    }
  }

  return null;
}

/**
 * Reads an SSE stream and collects all text parts from events.
 */
async function collectSSE(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let done = false;

  while (!done) {
    const { value, done: streamDone } = await reader.read();
    done = streamDone;
    if (value) {
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        if (line.startsWith("data: ")) {
          try {
            const json = JSON.parse(line.slice(6));
            const parts = json?.content?.parts;
            if (Array.isArray(parts)) {
              for (const p of parts) {
                if (typeof p.text === "string") fullText += p.text;
              }
            }
          } catch {
            // Not valid JSON – skip this SSE line
          }
        }
      }
    }
  }
  return fullText;
}

/* ---------- POST handler ---------- */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, sessionId, userId } = body as {
      message?: string;
      sessionId?: string;
      userId?: string;
    };

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const uid = userId || "default_user";

    // 1. Ensure we have a valid session on the ADK server
    let sid = sessionId;
    if (!sid) {
      sid = await createSession(uid);
    }

    // 2. Send the message and get the reply
    const reply = await sendToAgent(uid, sid, message.trim());

    return NextResponse.json({ reply, sessionId: sid });
  } catch (error: unknown) {
    const errMsg =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("[chat] Error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 502 });
  }
}
