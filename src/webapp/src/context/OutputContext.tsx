"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

/* ────────────── types ────────────── */

export interface OutputEntry {
  id: string;
  type: "product" | "component" | "resource" | "security_zone" | "info";
  name: string;
  details: Record<string, string | number | boolean | null>;
  timestamp: Date;
}

interface OutputContextType {
  outputs: OutputEntry[];
  addOutput: (entry: Omit<OutputEntry, "id" | "timestamp">) => void;
  clearOutputs: () => void;
  parseAndAddFromResponse: (response: string) => void;
}

const OutputContext = createContext<OutputContextType | undefined>(undefined);

/* ────────────── helper: generate unique ID ────────────── */

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/* ────────────── helper: extract JSON from response ────────────── */

function extractJSON(text: string): object[] {
  const results: object[] = [];
  
  // 1. First try to find JSON in code blocks (most reliable)
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/g;
  let match;
  
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const content = match[1].trim();
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        results.push(...parsed);
      } else if (typeof parsed === "object" && parsed !== null) {
        results.push(parsed);
      }
    } catch {
      // Not valid JSON in code block, skip
    }
  }
  
  // If we found JSON in code blocks, return immediately
  if (results.length > 0) {
    return results;
  }
  
  // 2. Fallback: Try to find a JSON array in the text
  const arrayMatch = text.match(/\[\s*\{[\s\S]*?\}\s*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Not valid JSON array
    }
  }
  
  // 3. Last resort: Find individual objects with type field
  const objectRegex = /\{[^{}]*"type"\s*:\s*"[^"]+?"[^{}]*\}/g;
  let objMatch;
  
  while ((objMatch = objectRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(objMatch[0]);
      if (typeof parsed === "object" && parsed !== null) {
        results.push(parsed);
      }
    } catch {
      // Not valid JSON object
    }
  }
  
  return results;
}

/* ────────────── helper: determine type from object ────────────── */

function determineType(obj: Record<string, unknown>): OutputEntry["type"] {
  // Get the type/entity_type value (check first occurrence in JSON string if needed)
  const typeValue = obj.type || obj.entity_type;
  
  if (typeof typeValue === "string") {
    const normalized = typeValue.toLowerCase().trim();
    
    // Exact matches for category types
    if (normalized === "product") return "product";
    if (normalized === "component") return "component";
    if (normalized === "resource") return "resource";
    if (normalized === "security_zone" || normalized === "securityzone" || normalized === "zone") {
      return "security_zone";
    }
  }
  
  // Check ID prefix patterns
  const id = String(obj.id || "").toUpperCase();
  if (id.startsWith("PROD")) return "product";
  if (id.startsWith("COMP")) return "component";
  if (id.startsWith("RES")) return "resource";
  if (id.startsWith("ZONE")) return "security_zone";
  
  // Check for unique identifying fields
  if ("trust_level" in obj) return "security_zone";
  if ("parent_product" in obj) return "component";
  if ("location" in obj && !("trust_level" in obj)) return "resource";
  if ("status" in obj && !("parent_product" in obj) && !("location" in obj)) return "product";
  
  return "info";
}

/* ────────────── helper: extract name ────────────── */

function extractName(obj: Record<string, unknown>): string {
  const nameFields = ["name", "title", "label"];
  
  for (const field of nameFields) {
    const value = obj[field];
    if (value && typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  
  const id = obj.id;
  if (id && typeof id === "string") {
    return id;
  }
  
  return "Unnamed Entry";
}

/* ────────────── helper: extract details - handle duplicate type keys ────────────── */

function extractDetails(
  obj: Record<string, unknown>, 
  categoryType: OutputEntry["type"]
): Record<string, string | number | boolean | null> {
  const details: Record<string, string | number | boolean | null> = {};
  
  // Map of category-specific "type" field names
  const typeFieldMap: Record<string, string> = {
    component: "component_type",
    resource: "resource_type",
  };
  
  for (const [key, value] of Object.entries(obj)) {
    // Handle the "type" field specially - it might be category OR subtype
    if (key === "type" || key === "entity_type") {
      const strValue = String(value).toLowerCase();
      const isCategoryType = ["product", "component", "resource", "security_zone", "securityzone", "zone"].includes(strValue);
      
      // If it's NOT a category type, it's a subtype (like "Microservice", "Database")
      if (!isCategoryType && typeof value === "string") {
        const fieldName = typeFieldMap[categoryType] || "subtype";
        details[fieldName] = value;
      }
      continue;
    }
    
    if (value === null || value === undefined) {
      details[key] = null;
    } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      details[key] = value;
    } else if (typeof value === "object") {
      details[key] = JSON.stringify(value);
    }
  }
  
  return details;
}

/* ────────────── helper: create unique key for deduplication ────────────── */

function createEntryKey(type: string, name: string, details: Record<string, unknown>): string {
  const id = details.id || "";
  return `${type}:${name}:${id}`.toLowerCase();
}

/* ────────────── helper: parse agent response ────────────── */

function parseAgentResponse(response: string): Omit<OutputEntry, "id" | "timestamp">[] {
  const entries: Omit<OutputEntry, "id" | "timestamp">[] = [];
  const seenKeys = new Set<string>();
  
  const jsonObjects = extractJSON(response);
  
  for (const obj of jsonObjects) {
    const record = obj as Record<string, unknown>;
    const categoryType = determineType(record);
    const name = extractName(record);
    const details = extractDetails(record, categoryType);
    
    const key = createEntryKey(categoryType, name, details);
    
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      entries.push({ type: categoryType, name, details });
    }
  }
  
  if (entries.length > 0) {
    return entries;
  }
  
  // Fallback: Pattern-based parsing
  const patterns = [
    { regex: /\*\*Product\*\*:\s*(.+?)(?:\n|$)/gi, type: "product" as const },
    { regex: /\*\*Component\*\*:\s*(.+?)(?:\n|$)/gi, type: "component" as const },
    { regex: /\*\*Resource\*\*:\s*(.+?)(?:\n|$)/gi, type: "resource" as const },
    { regex: /\*\*Security Zone\*\*:\s*(.+?)(?:\n|$)/gi, type: "security_zone" as const },
  ];

  for (const { regex, type } of patterns) {
    let match;
    while ((match = regex.exec(response)) !== null) {
      const value = match[1].trim();
      if (value) {
        const name = value.split(" - ")[0] || value;
        const key = createEntryKey(type, name, {});
        
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          entries.push({
            type,
            name,
            details: value.includes(" - ") 
              ? { description: value.split(" - ").slice(1).join(" - ") }
              : {},
          });
        }
      }
    }
  }

  if (entries.length === 0 && response.trim().length > 0) {
    const lines = response.split("\n").filter(l => l.trim());
    const summary = lines[0]?.substring(0, 150) || response.substring(0, 150);
    
    if (summary.trim()) {
      entries.push({
        type: "info",
        name: "Agent Response",
        details: { summary: summary + (summary.length >= 150 ? "..." : "") },
      });
    }
  }

  return entries;
}

/* ────────────── provider component ────────────── */

export function OutputProvider({ children }: { children: ReactNode }) {
  const [outputs, setOutputs] = useState<OutputEntry[]>([]);

  const addOutput = useCallback((entry: Omit<OutputEntry, "id" | "timestamp">) => {
    const newEntry: OutputEntry = {
      ...entry,
      id: generateId(),
      timestamp: new Date(),
    };
    setOutputs((prev) => [...prev, newEntry]);
  }, []);

  const clearOutputs = useCallback(() => {
    setOutputs([]);
  }, []);

  const parseAndAddFromResponse = useCallback((response: string) => {
    const parsed = parseAgentResponse(response);
    
    const newEntries = parsed.map((entry) => ({
      ...entry,
      id: generateId(),
      timestamp: new Date(),
    }));
    
    if (newEntries.length > 0) {
      setOutputs((prev) => [...prev, ...newEntries]);
    }
  }, []);

  return (
    <OutputContext.Provider value={{ outputs, addOutput, clearOutputs, parseAndAddFromResponse }}>
      {children}
    </OutputContext.Provider>
  );
}

/* ────────────── hook ────────────── */

export function useOutput() {
  const context = useContext(OutputContext);
  if (!context) {
    throw new Error("useOutput must be used within an OutputProvider");
  }
  return context;
}
