import { NextRequest, NextResponse } from "next/server";

// The wowbits ADK web server URL (started by: wowbits run agent thanos)
const AGENT_API_URL =
  process.env.AGENT_API_URL || "http://127.0.0.1:8000";

// Agent app name – this is the folder name inside agent_runner/
const AGENT_APP_NAME = process.env.AGENT_APP_NAME || "thanos";

/* ---------- helpers ---------- */

/**
 * Creates a new session on the ADK api_server.
 * POST /apps/{appName}/users/{userId}/sessions  body: { input: "" }
 */
async function createSession(userId: string): Promise<string> {
  const url = `${AGENT_API_URL}/apps/${AGENT_APP_NAME}/users/${userId}/sessions`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: "" }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    console.error("[chat] Cannot connect to ADK api_server for session creation:", err);
    throw new Error(
      `Cannot connect to wowbits agent at ${AGENT_API_URL}. ` +
        "Make sure the agent is running: adk api_server --port 8080"
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
 * Extracts the last text reply from a list of ADK events (JSON array).
 */
function extractReplyFromEvents(data: unknown): string | null {
  if (Array.isArray(data)) {
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
 * Builds the camelCase payload for the ADK api_server /run and /run_sse endpoints.
 */
function buildPayload(userId: string, sessionId: string, message: string) {
  return {
    appName: AGENT_APP_NAME,
    userId,
    sessionId,
    newMessage: {
      role: "user",
      parts: [{ text: message }],
    },
  };
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

    // 1. Ensure we have a valid session
    let sid = sessionId;
    if (!sid) {
      sid = await createSession(uid);
    }

    const payload = buildPayload(uid, sid, message.trim());

    // 2. Try /run_sse first for real-time streaming
    try {
      const sseRes = await fetch(`${AGENT_API_URL}/run_sse`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(120_000),
      });

      if (sseRes.ok && sseRes.body) {
        return streamSSEToClient(sseRes, sid);
      }

      // If SSE endpoint failed, fall through to /run
      const errBody = await sseRes.text().catch(() => "");
      console.warn(`[chat] /run_sse returned ${sseRes.status}: ${errBody}`);
    } catch (err) {
      console.warn("[chat] /run_sse connection failed, trying /run:", err);
    }

    // 3. Fallback: /run (blocking JSON response)
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

    if (!runRes.ok) {
      const errorBody = await runRes.text().catch(() => "");
      console.warn(`[chat] /run returned ${runRes.status}:`, errorBody);

      let detail = "Agent execution error";
      try {
        const parsed = JSON.parse(errorBody);
        detail = parsed.detail || parsed.error || parsed.message || detail;
      } catch {
        if (errorBody) detail = errorBody;
      }
      throw new Error(`Agent error: ${detail}`);
    }

    const data = await runRes.json();
    const reply = extractReplyFromEvents(data);

    if (reply) {
      return NextResponse.json({ reply, sessionId: sid });
    }

    throw new Error(
      "The agent did not return any text response. " +
        "This may be a configuration issue with the thanos agent."
    );
  } catch (error: unknown) {
    const errMsg =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("[chat] Error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 502 });
  }
}

/* ---------- SSE streaming ---------- */

/**
 * Reads the SSE stream from the agent /run_sse endpoint, extracts text
 * parts from events, and forwards them to the browser as a simplified
 * SSE stream.
 *
 * Agent SSE events look like:
 *   data: {"content":{"parts":[{"text":"..."}],"role":"model"}, ...}
 *
 * Client-facing SSE events:
 *   data: { type: "session", sessionId }
 *   data: { type: "chunk",   content }
 *   data: { type: "done" }
 *   data: { type: "error",   content }
 */
function streamSSEToClient(agentRes: Response, sessionId: string): Response {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (obj: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)
        );
      };

      // Send session ID as the first event
      enqueue({ type: "session", sessionId });

      if (!agentRes.body) {
        enqueue({ type: "done" });
        controller.close();
        return;
      }

      const reader = agentRes.body.getReader();
      let buffer = "";

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete lines
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // keep the last (possibly incomplete) line

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;

            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr) continue;

            try {
              const json = JSON.parse(jsonStr);
              const parts = json?.content?.parts;
              if (Array.isArray(parts)) {
                for (const p of parts) {
                  if (typeof p.text === "string" && p.text) {
                    enqueue({ type: "chunk", content: p.text });
                  }
                }
              }
            } catch {
              // Not valid JSON – partial line or non-data event, skip
            }
          }
        }

        // Process any leftover data in the buffer
        if (buffer.trim().startsWith("data:")) {
          const jsonStr = buffer.trim().slice(5).trim();
          if (jsonStr) {
            try {
              const json = JSON.parse(jsonStr);
              const parts = json?.content?.parts;
              if (Array.isArray(parts)) {
                for (const p of parts) {
                  if (typeof p.text === "string" && p.text) {
                    enqueue({ type: "chunk", content: p.text });
                  }
                }
              }
            } catch {
              // ignore
            }
          }
        }
      } catch (err) {
        console.error("[chat] SSE stream error:", err);
        enqueue({
          type: "error",
          content: err instanceof Error ? err.message : "Stream error",
        });
      }

      enqueue({ type: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
