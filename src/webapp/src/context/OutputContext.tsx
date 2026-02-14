"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

/* ════════════════════════════════════════════════════════════
   Types
   ════════════════════════════════════════════════════════════ */

export type EntryCategory =
  | "product"
  | "component"
  | "resource"
  | "security_zone"
  | "threat"
  | "info";

export interface OutputEntry {
  id: string;
  category: EntryCategory;
  name: string;
  details: Record<string, string | number | boolean | null>;
  timestamp: Date;
}

interface OutputContextType {
  /** All parsed output entries (newest first). */
  entries: OutputEntry[];
  /** Manually add a single entry. */
  addEntry: (entry: Omit<OutputEntry, "id" | "timestamp">) => void;
  /** Remove a single entry by id. */
  removeEntry: (id: string) => void;
  /** Clear every entry. */
  clearAll: () => void;
  /** Parse an agent response string and add any discovered entries. */
  parseResponse: (response: string) => void;
}

const OutputContext = createContext<OutputContextType | undefined>(undefined);

/* ════════════════════════════════════════════════════════════
   Helpers
   ════════════════════════════════════════════════════════════ */

let _counter = 0;
function uid(): string {
  return `e-${Date.now()}-${++_counter}`;
}

/* ---------- JSON extraction ---------- */

function extractJSON(text: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];

  // 1 — fenced code-blocks
  const codeRe = /```(?:json)?\s*([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = codeRe.exec(text)) !== null) {
    try {
      const p = JSON.parse(m[1].trim());
      if (Array.isArray(p)) results.push(...p);
      else if (p && typeof p === "object") results.push(p);
    } catch { /* skip */ }
  }
  if (results.length) return results;

  // 2 — bare array
  const arrMatch = text.match(/\[\s*\{[\s\S]*?\}\s*\]/);
  if (arrMatch) {
    try {
      const p = JSON.parse(arrMatch[0]);
      if (Array.isArray(p)) return p;
    } catch { /* skip */ }
  }

  // 3 — individual objects with "type" or "name"
  const objRe = /\{[^{}]*"(?:type|name)"\s*:\s*"[^"]+?"[^{}]*\}/g;
  while ((m = objRe.exec(text)) !== null) {
    try {
      const p = JSON.parse(m[0]);
      if (p && typeof p === "object") results.push(p);
    } catch { /* skip */ }
  }
  return results;
}

/* ---------- category resolver ---------- */

function resolveCategory(obj: Record<string, unknown>): EntryCategory {
  const raw = String(obj.type || obj.entity_type || "").toLowerCase().trim();
  if (raw === "product") return "product";
  if (raw === "component") return "component";
  if (raw === "resource") return "resource";
  if (["security_zone", "securityzone", "zone"].includes(raw)) return "security_zone";
  if (["threat", "risk", "vulnerability"].includes(raw)) return "threat";

  const id = String(obj.id || "").toUpperCase();
  if (id.startsWith("PROD")) return "product";
  if (id.startsWith("COMP")) return "component";
  if (id.startsWith("RES")) return "resource";
  if (id.startsWith("ZONE")) return "security_zone";
  if ("trust_level" in obj) return "security_zone";
  if ("parent_product" in obj) return "component";

  return "info";
}

/* ---------- name resolver ---------- */

function resolveName(obj: Record<string, unknown>): string {
  for (const k of ["name", "title", "label"]) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  if (typeof obj.id === "string") return obj.id;
  return "Unnamed";
}

/* ---------- flatten details ---------- */

function flattenDetails(
  obj: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (["name", "title", "label"].includes(k)) continue;
    if (v === null || v === undefined) out[k] = null;
    else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v;
    else out[k] = JSON.stringify(v);
  }
  return out;
}

/* ---------- full parse pipeline ---------- */

function parseAgentResponse(
  response: string,
): Omit<OutputEntry, "id" | "timestamp">[] {
  const entries: Omit<OutputEntry, "id" | "timestamp">[] = [];
  const seen = new Set<string>();

  // Structured JSON
  for (const obj of extractJSON(response)) {
    const category = resolveCategory(obj);
    const name = resolveName(obj);
    const details = flattenDetails(obj);
    const key = `${category}::${name}::${details.id ?? ""}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({ category, name, details });
  }
  if (entries.length) return entries;

  // Markdown patterns
  const patterns: { re: RegExp; cat: EntryCategory }[] = [
    { re: /\*\*Product\*\*:\s*(.+?)(?:\n|$)/gi, cat: "product" },
    { re: /\*\*Component\*\*:\s*(.+?)(?:\n|$)/gi, cat: "component" },
    { re: /\*\*Resource\*\*:\s*(.+?)(?:\n|$)/gi, cat: "resource" },
    { re: /\*\*Security Zone\*\*:\s*(.+?)(?:\n|$)/gi, cat: "security_zone" },
    { re: /\*\*Threat\*\*:\s*(.+?)(?:\n|$)/gi, cat: "threat" },
  ];
  for (const { re, cat } of patterns) {
    let pm: RegExpExecArray | null;
    while ((pm = re.exec(response)) !== null) {
      const raw = pm[1].trim();
      if (!raw) continue;
      const name = raw.split(" - ")[0];
      const desc = raw.includes(" - ") ? raw.split(" - ").slice(1).join(" - ") : undefined;
      const key = `${cat}::${name}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({ category: cat, name, details: desc ? { description: desc } : {} });
    }
  }
  if (entries.length) return entries;

  // Fallback — info summary
  if (response.trim()) {
    const preview =
      response.trim().length > 220
        ? response.trim().slice(0, 220) + "…"
        : response.trim();
    entries.push({ category: "info", name: "Agent Response", details: { summary: preview } });
  }
  return entries;
}

/* ════════════════════════════════════════════════════════════
   Provider
   ════════════════════════════════════════════════════════════ */

export function OutputProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<OutputEntry[]>([]);

  const addEntry = useCallback(
    (entry: Omit<OutputEntry, "id" | "timestamp">) => {
      setEntries((prev) => [{ ...entry, id: uid(), timestamp: new Date() }, ...prev]);
    },
    [],
  );

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearAll = useCallback(() => setEntries([]), []);

  const parseResponse = useCallback((response: string) => {
    const parsed = parseAgentResponse(response);
    if (!parsed.length) return;
    const now = new Date();
    const batch = parsed.map((e) => ({ ...e, id: uid(), timestamp: now }));
    setEntries((prev) => [...batch, ...prev]);
  }, []);

  return (
    <OutputContext.Provider value={{ entries, addEntry, removeEntry, clearAll, parseResponse }}>
      {children}
    </OutputContext.Provider>
  );
}

/* ════════════════════════════════════════════════════════════
   Hook
   ════════════════════════════════════════════════════════════ */

export function useOutput() {
  const ctx = useContext(OutputContext);
  if (!ctx) throw new Error("useOutput must be used inside <OutputProvider>");
  return ctx;
}
