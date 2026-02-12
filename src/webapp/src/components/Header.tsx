"use client";

import { Bell } from "lucide-react";

export default function Header() {
  return (
    <header className="h-[60px] bg-white border-b border-gray-200 flex items-center justify-between px-5 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 bg-[#00b4d8] rounded-lg flex items-center justify-center">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <span className="text-lg font-semibold text-gray-800">ThreatModeler AI</span>
      </div>

      {/* Navigation */}
      <nav className="flex items-center gap-12">
        <a
          href="#"
          className="text-gray-500 hover:text-gray-800 transition-colors text-[15px] font-medium"
        >
          Models
        </a>
        <a
          href="#"
          className="text-gray-500 hover:text-gray-800 transition-colors text-[15px] font-medium"
        >
          Architectures
        </a>
        <a
          href="#"
          className="text-gray-500 hover:text-gray-800 transition-colors text-[15px] font-medium"
        >
          Reports
        </a>
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button className="bg-[#00b4d8] hover:bg-[#0096c7] text-white px-5 py-2 rounded-full font-medium text-sm transition-all shadow-sm border border-[#0096c7]/50">
          Export Model
        </button>
        <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
          <Bell size={20} className="text-gray-500" />
        </button>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center overflow-hidden">
          <div className="w-full h-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" fill="#d4a574" />
              <path d="M4 20c0-4 4-6 8-6s8 2 8 6" fill="#d4a574" />
            </svg>
          </div>
        </div>
      </div>
    </header>
  );
}
