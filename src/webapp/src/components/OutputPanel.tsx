"use client";

import { useRef, useEffect } from "react";
import { useOutput, OutputEntry } from "@/context/OutputContext";
import {
  Package,
  Puzzle,
  Database,
  Shield,
  Trash2,
  Table,
} from "lucide-react";

/* ────────────── types ────────────── */

interface ColumnDef {
  key: string;
  label: string;
  width?: string;
}

/* ────────────── category configs ────────────── */

const categoryConfig: Record<
  OutputEntry["type"],
  {
    title: string;
    icon: React.ReactNode;
    headerBg: string;
    headerText: string;
    iconBg: string;
    columns: ColumnDef[];
  }
> = {
  product: {
    title: "Products",
    icon: <Package size={16} className="text-white" />,
    headerBg: "bg-gradient-to-r from-[#e0f7fa] to-[#b2ebf2]",
    headerText: "text-[#00838f]",
    iconBg: "bg-[#00b4d8]",
    columns: [
      { key: "id", label: "Product ID", width: "w-[120px]" },
      { key: "name", label: "Name" },
      { key: "description", label: "Description" },
      { key: "status", label: "Status", width: "w-[100px]" },
    ],
  },
  component: {
    title: "Components",
    icon: <Puzzle size={16} className="text-white" />,
    headerBg: "bg-gradient-to-r from-emerald-50 to-emerald-100",
    headerText: "text-emerald-700",
    iconBg: "bg-emerald-500",
    columns: [
      { key: "id", label: "Component ID", width: "w-[120px]" },
      { key: "name", label: "Name" },
      { key: "type", label: "Type", width: "w-[120px]" },
      { key: "parent_product", label: "Parent Product", width: "w-[150px]" },
    ],
  },
  resource: {
    title: "Resources",
    icon: <Database size={16} className="text-white" />,
    headerBg: "bg-gradient-to-r from-amber-50 to-amber-100",
    headerText: "text-amber-700",
    iconBg: "bg-amber-500",
    columns: [
      { key: "id", label: "Resource ID", width: "w-[120px]" },
      { key: "name", label: "Name" },
      { key: "type", label: "Type", width: "w-[120px]" },
      { key: "location", label: "Location", width: "w-[150px]" },
    ],
  },
  security_zone: {
    title: "Security Zones",
    icon: <Shield size={16} className="text-white" />,
    headerBg: "bg-gradient-to-r from-purple-50 to-purple-100",
    headerText: "text-purple-700",
    iconBg: "bg-purple-500",
    columns: [
      { key: "id", label: "Zone ID", width: "w-[120px]" },
      { key: "name", label: "Name" },
      { key: "trust_level", label: "Trust Level", width: "w-[120px]" },
      { key: "description", label: "Description" },
    ],
  },
  info: {
    title: "Other",
    icon: <Table size={16} className="text-white" />,
    headerBg: "bg-gradient-to-r from-gray-50 to-gray-100",
    headerText: "text-gray-600",
    iconBg: "bg-gray-400",
    columns: [
      { key: "name", label: "Name" },
      { key: "summary", label: "Summary" },
    ],
  },
};

/* ────────────── helper: get cell value ────────────── */

function getCellValue(entry: OutputEntry, key: string): string {
  if (key === "name") {
    return entry.name || "—";
  }
  
  if (key === "id") {
    const val = entry.details.id || entry.details.product_id || 
                entry.details.component_id || entry.details.resource_id || 
                entry.details.zone_id || "—";
    return String(val);
  }
  
  // Handle "type" column - look for subtype fields first
  if (key === "type") {
    const val = entry.details.component_type || 
                entry.details.resource_type || 
                entry.details.subtype ||
                entry.details.type || "—";
    return String(val);
  }
  
  const val = entry.details[key];
  if (val === null || val === undefined || val === "") {
    return "—";
  }
  return String(val);
}

/* ────────────── Category Table Component ────────────── */

function CategoryTable({
  type,
  entries,
}: {
  type: OutputEntry["type"];
  entries: OutputEntry[];
}) {
  const config = categoryConfig[type];

  if (entries.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Category Header */}
      <div
        className={`${config.headerBg} px-4 py-3 flex items-center gap-3 border-b border-gray-100`}
      >
        <div
          className={`w-8 h-8 rounded-lg ${config.iconBg} flex items-center justify-center shadow-sm`}
        >
          {config.icon}
        </div>
        <div className="flex items-center gap-2">
          <h3 className={`font-semibold text-[14px] ${config.headerText}`}>
            {config.title}
          </h3>
          <span className={`text-[12px] ${config.headerText} opacity-70`}>
            ({entries.length})
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {config.columns.map((col) => (
                <th
                  key={col.key}
                  className={`text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider ${
                    col.width || ""
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr
                key={entry.id}
                className={`hover:bg-gray-50/50 transition-colors ${
                  index !== entries.length - 1
                    ? "border-b border-gray-100"
                    : ""
                }`}
              >
                {config.columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-[13px] text-gray-700 ${
                      col.width || ""
                    }`}
                  >
                    <span
                      className={
                        col.key === "name"
                          ? "font-medium text-gray-800"
                          : col.key === "id"
                          ? "font-mono text-[12px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded"
                          : ""
                      }
                    >
                      {getCellValue(entry, col.key)}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ────────────── main component ────────────── */

export default function OutputPanel() {
  const { outputs, clearOutputs } = useOutput();
  const tableEndRef = useRef<HTMLDivElement>(null);

  // Group outputs by type
  const products = outputs.filter((o) => o.type === "product");
  const components = outputs.filter((o) => o.type === "component");
  const resources = outputs.filter((o) => o.type === "resource");
  const securityZones = outputs.filter((o) => o.type === "security_zone");
  const others = outputs.filter((o) => o.type === "info");

  const hasAnyEntries = outputs.length > 0;

  // Auto-scroll to bottom when new outputs arrive
  useEffect(() => {
    tableEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [outputs]);

  return (
    <div className="w-[60%] bg-[#fafbfc] flex flex-col h-full">
      {/* Header */}
      <div className="bg-white py-4 flex items-center justify-between border-b border-gray-100 px-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4fc3f7] to-[#00b4d8] flex items-center justify-center shadow-sm">
            <Table size={18} className="text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800 text-[15px]">
              Output Results
            </h2>
            <p className="text-[12px] text-gray-400">
              {outputs.length} total{" "}
              {outputs.length === 1 ? "entry" : "entries"}
            </p>
          </div>
        </div>

        {hasAnyEntries && (
          <button
            onClick={clearOutputs}
            className="flex items-center gap-2 px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-lg font-medium text-[12px] transition-all"
          >
            <Trash2 size={14} />
            Clear All
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {!hasAnyEntries ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#4fc3f7]/20 to-[#00b4d8]/20 flex items-center justify-center">
              <Table size={28} className="text-[#00b4d8]" />
            </div>
            <div className="text-center">
              <p className="text-gray-500 text-[14px] font-medium">
                No output yet
              </p>
              <p className="text-gray-400 text-[13px] mt-1">
                Chat with the AI to generate architecture insights
              </p>
            </div>
          </div>
        ) : (
          /* Category Tables */
          <div className="space-y-5">
            <CategoryTable type="product" entries={products} />
            <CategoryTable type="component" entries={components} />
            <CategoryTable type="resource" entries={resources} />
            <CategoryTable type="security_zone" entries={securityZones} />

            {/* Info/Other entries only shown if there are some */}
            {others.length > 0 && (
              <CategoryTable type="info" entries={others} />
            )}

            <div ref={tableEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
