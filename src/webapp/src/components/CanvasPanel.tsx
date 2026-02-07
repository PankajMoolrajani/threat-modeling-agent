"use client";

import { useState, useRef, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  MousePointer2,
  Plus,
  Square,
  LayoutGrid,
  Info,
} from "lucide-react";

export default function CanvasPanel() {
  const [gridEnabled, setGridEnabled] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  
  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 4;
  const ZOOM_STEP = 0.25;

  const handleZoomIn = useCallback(() => {
    setZoom((prevZoom) => Math.min(prevZoom + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prevZoom) => Math.max(prevZoom - ZOOM_STEP, MIN_ZOOM));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((prevZoom) => {
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prevZoom + delta));
      return newZoom;
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className={`bg-[#fafbfc] flex flex-col h-full transition-all duration-300 ease-in-out ${
      isMaximized 
        ? "fixed inset-0 z-50 w-full" 
        : "w-[60%]"
    }`}>
      {/* Progress Header */}
      <div className="bg-white py-5 flex items-start justify-between border-b border-gray-100 pl-12 pr-8">
        <div className="flex-1 max-w-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[14px] font-medium text-gray-700">Model Completion</span>
            <span className="text-[14px] font-semibold text-gray-800">0%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-[#00b4d8] h-full rounded-full transition-all duration-500"
              style={{ width: "0%" }}
            />
          </div>
          <p className="text-[12px] text-gray-500 mt-2.5 flex items-center gap-1.5">
            <Info size={12} className="text-[#00b4d8]" />
            Defining: Component Layer (Resources & Data Flows)
          </p>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2 ml-10 mt-2">
          <button
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="w-8 h-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Zoom In"
          >
            <ZoomIn size={16} className="text-gray-500" />
          </button>
          <button
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="w-8 h-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Zoom Out"
          >
            <ZoomOut size={16} className="text-gray-500" />
          </button>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className={`w-8 h-8 border rounded-lg flex items-center justify-center transition-colors ${
              isMaximized
                ? "bg-[#00b4d8] border-[#00b4d8] hover:bg-[#0096c7]"
                : "bg-white border-gray-200 hover:bg-gray-50"
            }`}
            title={isMaximized ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isMaximized ? (
              <Minimize2 size={16} className="text-white" />
            ) : (
              <Maximize2 size={16} className="text-gray-500" />
            )}
          </button>
          <span className="text-[12px] text-gray-500 ml-2 min-w-[50px]">
            {Math.round(zoom * 100)}%
          </span>
        </div>
      </div>

      {/* Canvas Area */}
      <div
        className="flex-1 relative overflow-hidden"
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        {/* Grid Background */}
        <div
          className={`absolute inset-0 ${gridEnabled ? "canvas-grid" : ""}`}
          style={{
            backgroundColor: "#fafbfc",
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.2s ease-out",
          }}
        >
        </div>

        {/* Legend - Fixed Position */}
        {/* <div
          className="absolute bottom-8 right-8 bg-white rounded-xl shadow-lg border border-gray-100 px-5 py-4 min-w-[170px] z-10"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Model Legend
          </h3>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="w-3.5 h-3.5 bg-[#00b4d8] rounded-sm" />
              <span className="text-[13px] text-gray-600">Core Component</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3.5 h-3.5 bg-white border border-gray-300 rounded-sm" />
              <span className="text-[13px] text-gray-600">Resource/Entity</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-0.5 bg-[#00b4d8]" />
              <span className="text-[13px] text-gray-600">Data Flow</span>
            </div>  
            <div className="flex items-center gap-3">
              <div className="w-6 h-0.5 bg-[#00b4d8] relative">
                <div className="absolute inset-0 border-t-2 border-dashed border-[#00b4d8]" />
              </div>
              <span className="text-[13px] text-gray-600">Encrypted Link</span>
            </div>
          </div>
        </div> */}

        {/* Bottom Toolbar - Floating Overlay (Always Centered) */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/80 px-3 py-2.5 flex items-center gap-2">
            <button 
              className="flex items-center gap-2 px-4 py-2 text-[#00b4d8] bg-[#f0f9ff] rounded-xl font-medium text-[13px] hover:bg-[#e0f2fe] transition-all shadow-sm"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <MousePointer2 size={15} />
              Select
            </button>
            <button 
              className="flex items-center gap-2 px-4 py-2 text-gray-600 rounded-xl font-medium text-[13px] hover:bg-gray-100 transition-all"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Plus size={15} />
              Add Node
            </button>
            <button 
              className="flex items-center gap-2 px-4 py-2 text-gray-600 rounded-xl font-medium text-[13px] hover:bg-gray-100 transition-all"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Square size={15} />
              Boundary
            </button>
            <div className="w-px h-5 bg-gray-300 mx-1" />
            <button
              onClick={() => setGridEnabled(!gridEnabled)}
              onMouseDown={(e) => e.stopPropagation()}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-[13px] transition-all ${
                gridEnabled
                  ? "text-gray-700 bg-gray-100 shadow-sm"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <LayoutGrid size={15} />
              Grid
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
