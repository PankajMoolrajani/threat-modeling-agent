"use client";

import { useState, useMemo } from "react";
import {
  Trash2,
  X,
  Search,
  Package,
  Cpu,
  Server,
  ShieldCheck,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  LayoutList,
} from "lucide-react";
import { useOutput, type EntryCategory, type OutputEntry } from "@/context/OutputContext";

/* ════════════════════════════════════════════════════════════
   Category visual config
   ════════════════════════════════════════════════════════════ */

const CATEGORY_META: Record<
  EntryCategory,
  { label: string; color: string; bg: string; border: string; icon: typeof Package }
> = {
  product: {
    label: "Product",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: Package,
  },
  component: {
    label: "Component",
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-200",
    icon: Cpu,
  },
  resource: {
    label: "Resource",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    icon: Server,
  },
  security_zone: {
    label: "Security Zone",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: ShieldCheck,
  },
  threat: {
    label: "Threat",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    icon: AlertTriangle,
  },
  info: {
    label: "Info",
    color: "text-slate-600",
    bg: "bg-slate-50",
    border: "border-slate-200",
    icon: Info,
  },
};

const CATEGORY_ORDER: EntryCategory[] = [
  "product",
  "component",
  "resource",
  "security_zone",
  "threat",
  "info",
];

/* ════════════════════════════════════════════════════════════
   Format helpers
   ════════════════════════════════════════════════════════════ */

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function humanKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ════════════════════════════════════════════════════════════
   Entry card
   ════════════════════════════════════════════════════════════ */

function EntryCard({
  entry,
  onRemove,
}: {
  entry: OutputEntry;
  onRemove: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = CATEGORY_META[entry.category];
  const Icon = meta.icon;

  // Gather displayable detail keys (skip id, type, entity_type)
  const detailKeys = Object.keys(entry.details).filter(
    (k) => !["id", "type", "entity_type"].includes(k),
  );
  const hasDetails = detailKeys.length > 0;

  // For info entries, show summary inline
  const summary = entry.details.summary;

  return (
    <div
      className={`group relative rounded-xl border ${meta.border} ${meta.bg}/40 transition-all duration-200 hover:shadow-md hover:border-opacity-80`}
    >
      {/* Header row */}
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => hasDetails && setExpanded((p) => !p)}
      >
        {/* Icon */}
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.bg} ${meta.color}`}
        >
          <Icon size={16} />
        </div>

        {/* Name + badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-800 text-[14px] truncate">
              {entry.name}
            </span>
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}
            >
              {meta.label}
            </span>
          </div>

          {/* Summary for info entries */}
          {summary && typeof summary === "string" && (
            <p className="text-[13px] text-gray-500 mt-1 line-clamp-2 leading-snug">
              {summary}
            </p>
          )}

          {/* Compact detail preview when collapsed */}
          {!expanded && hasDetails && !summary && (
            <p className="text-[12px] text-gray-400 mt-0.5 truncate">
              {detailKeys.slice(0, 3).map((k) => `${humanKey(k)}: ${entry.details[k]}`).join(" · ")}
              {detailKeys.length > 3 && ` +${detailKeys.length - 3} more`}
            </p>
          )}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[11px] text-gray-300 font-mono">
            {formatTime(entry.timestamp)}
          </span>

          {hasDetails && (
            <button
              className="p-1 rounded-md text-gray-300 hover:text-gray-500 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((p) => !p);
              }}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}

          <button
            className="p-1 rounded-md text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(entry.id);
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && hasDetails && (
        <div className="px-4 pb-3 pt-0 ml-11">
          <div className="border-t border-gray-100 pt-2.5 space-y-1.5">
            {detailKeys.map((key) => {
              const val = entry.details[key];
              return (
                <div key={key} className="flex gap-2 text-[13px]">
                  <span className="text-gray-400 font-medium shrink-0 min-w-[100px]">
                    {humanKey(key)}
                  </span>
                  <span className="text-gray-700 break-all">
                    {val === null ? (
                      <span className="text-gray-300 italic">null</span>
                    ) : typeof val === "boolean" ? (
                      <span
                        className={val ? "text-emerald-600" : "text-red-500"}
                      >
                        {String(val)}
                      </span>
                    ) : (
                      String(val)
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Main OutputPanel
   ════════════════════════════════════════════════════════════ */

export default function OutputPanel() {
  const { entries, removeEntry, clearAll } = useOutput();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<EntryCategory | "all">("all");

  // Filtered + searched entries
  const filtered = useMemo(() => {
    let list = entries;
    if (activeFilter !== "all") {
      list = list.filter((e) => e.category === activeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          Object.values(e.details).some(
            (v) => v !== null && String(v).toLowerCase().includes(q),
          ),
      );
    }
    return list;
  }, [entries, activeFilter, search]);

  // Category counts for badges
  const counts = useMemo(() => {
    const map: Record<string, number> = { all: entries.length };
    for (const e of entries) {
      map[e.category] = (map[e.category] || 0) + 1;
    }
    return map;
  }, [entries]);

  /* ════════ RENDER ════════ */
  return (
    <div className="w-[60%] bg-[#fafbfc] flex flex-col h-full">
      {/* ── Header ── */}
      <div className="px-5 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#4fc3f7] to-[#00b4d8] text-white shadow-sm">
              <LayoutList size={18} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800 text-[15px]">
                Output Results
              </h2>
              <p className="text-[12px] text-gray-400">
                {entries.length === 0
                  ? "No entries yet"
                  : `${entries.length} ${entries.length === 1 ? "entry" : "entries"} discovered`}
              </p>
            </div>
          </div>

          {entries.length > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-red-500 hover:text-white hover:bg-red-500 rounded-lg border border-red-200 hover:border-red-500 transition-all duration-200"
            >
              <Trash2 size={13} />
              Clear All
            </button>
          )}
        </div>

        {/* Search + filter row */}
        {entries.length > 0 && (
          <div className="mt-3 space-y-2.5">
            {/* Search */}
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search entries…"
                className="w-full pl-9 pr-3 py-2 bg-gray-50 rounded-lg text-[13px] text-gray-700 placeholder-gray-300 border border-gray-200 focus:bg-white focus:border-[#00b4d8]/40 transition-all"
              />
            </div>

            {/* Category filter pills */}
            <div className="flex gap-1.5 flex-wrap">
              <FilterPill
                label="All"
                count={counts.all}
                active={activeFilter === "all"}
                onClick={() => setActiveFilter("all")}
              />
              {CATEGORY_ORDER.map((cat) =>
                counts[cat] ? (
                  <FilterPill
                    key={cat}
                    label={CATEGORY_META[cat].label}
                    count={counts[cat]}
                    active={activeFilter === cat}
                    color={CATEGORY_META[cat].color}
                    bg={CATEGORY_META[cat].bg}
                    onClick={() =>
                      setActiveFilter(activeFilter === cat ? "all" : cat)
                    }
                  />
                ) : null,
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Entry list ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
        {filtered.length > 0 ? (
          filtered.map((entry) => (
            <EntryCard key={entry.id} entry={entry} onRemove={removeEntry} />
          ))
        ) : entries.length > 0 ? (
          /* Search/filter returned nothing */
          <EmptySearch onClear={() => { setSearch(""); setActiveFilter("all"); }} />
        ) : (
          /* No entries at all */
          <EmptyState />
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Sub-components
   ════════════════════════════════════════════════════════════ */

function FilterPill({
  label,
  count,
  active,
  color,
  bg,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  color?: string;
  bg?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all duration-150 ${
        active
          ? `${bg ?? "bg-[#e0f7fa]"} ${color ?? "text-[#00838f]"} border-current`
          : "bg-white text-gray-400 border-gray-200 hover:text-gray-600 hover:border-gray-300"
      }`}
    >
      {label}
      <span
        className={`text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center ${
          active
            ? "bg-white/60 text-current"
            : "bg-gray-100 text-gray-400"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center mb-4">
        <LayoutList size={28} className="text-gray-300" />
      </div>
      <h3 className="text-[15px] font-semibold text-gray-400 mb-1">
        No output yet
      </h3>
      <p className="text-[13px] text-gray-300 max-w-[280px] leading-relaxed">
        Start a conversation with the AI agent in the chat panel. Discovered
        products, components, resources, and threats will appear here.
      </p>
    </div>
  );
}

function EmptySearch({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <Search size={28} className="text-gray-300 mb-3" />
      <h3 className="text-[15px] font-semibold text-gray-400 mb-1">
        No matches
      </h3>
      <p className="text-[13px] text-gray-300 mb-4">
        Try a different search or filter.
      </p>
      <button
        onClick={onClear}
        className="px-4 py-1.5 text-[12px] font-medium text-[#00b4d8] border border-[#00b4d8]/30 rounded-lg hover:bg-[#e0f7fa] transition-colors"
      >
        Clear filters
      </button>
    </div>
  );
}
