"use client";

import { useEffect, useState, useRef } from "react";
import { LogOut, ChevronDown, ChevronUp, GripVertical, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";

function safeDecode(val: string): string {
  if (!val) return "";
  let res = val;
  try {
    for (let i = 0; i < 3; i++) {
      if (!res.includes("%")) break;
      const decoded = decodeURIComponent(res);
      if (decoded === res) break;
      res = decoded;
    }
  } catch {
    // Return best effort if malformed sequence
  }
  return res;
}

function formatTimer(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}:${String(remMins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function ImpersonationBanner() {
  const { account } = useAuth();
  const { mode } = useTheme();
  const isDark = mode === "dark";

  const [isImpersonating, setIsImpersonating] = useState(false);
  const [tenantName, setTenantName] = useState<string>("");
  const [exiting, setExiting] = useState(false);
  const [minimized, setMinimized] = useState(false);

  // Live stopwatch timer state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef<number>(Date.now());

  // Dragging state (only active when expanded; defaults to top-center)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const cookies = document.cookie.split(";").map((c) => c.trim());
      const hasFlag = cookies.some(
        (c) => c.startsWith("wapp_is_impersonating=") || c.startsWith("wapp_impersonate_account_id=")
      );
      setIsImpersonating(hasFlag);

      const nameCookie = cookies.find((c) => c.startsWith("wapp_impersonated_tenant_name="));
      if (nameCookie) {
        const val = nameCookie.split("=").slice(1).join("=");
        setTenantName(safeDecode(val));
      }

      // Read start timestamp for live timer
      const atCookie = cookies.find((c) => c.startsWith("wapp_impersonated_at="));
      if (atCookie) {
        const ts = Number(atCookie.split("=")[1]);
        if (!isNaN(ts) && ts > 0) {
          startTimeRef.current = ts;
        }
      }

      // Restore position if previously saved
      try {
        const savedPos = sessionStorage.getItem("wapp_impersonate_banner_pos");
        if (savedPos) {
          const parsed = JSON.parse(savedPos);
          if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
            setPosition(parsed);
          }
        }
      } catch {}
    }
  }, []);

  // Timer interval: counts seconds from 0 to exit
  useEffect(() => {
    if (!isImpersonating) return;

    const tick = () => {
      const diff = Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000));
      setElapsedSeconds(diff);
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [isImpersonating]);

  if (!isImpersonating) return null;

  const displayTenantName = tenantName || account?.name || "Tenant";

  // Drag handlers (only for expanded pill)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a")) return;

    const rect = dragRef.current?.getBoundingClientRect();
    if (!rect) return;

    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: rect.left,
      initialY: rect.top,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current || !dragRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;

    const pillW = dragRef.current.offsetWidth || 320;
    const pillH = dragRef.current.offsetHeight || 38;

    const newX = Math.max(12, Math.min(window.innerWidth - pillW - 12, dragStartRef.current.initialX + deltaX));
    const newY = Math.max(12, Math.min(window.innerHeight - pillH - 12, dragStartRef.current.initialY + deltaY));

    const nextPos = { x: newX, y: newY };
    setPosition(nextPos);

    try {
      sessionStorage.setItem("wapp_impersonate_banner_pos", JSON.stringify(nextPos));
    } catch {}
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      dragStartRef.current = null;
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {}
    }
  };

  const handleExit = async () => {
    try {
      setExiting(true);
      try {
        sessionStorage.removeItem("wapp_impersonate_banner_pos");
      } catch {}
      const res = await fetch("/api/admin/impersonate", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        window.location.href = "/admin/tenants";
      }
    } catch {
      window.location.href = "/admin/tenants";
    }
  };

  // COLLAPSED STATE: NOT draggable, anchored clean and static at top-center
  if (minimized) {
    return (
      <div className="fixed top-3.5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in zoom-in-95 duration-150 select-none">
        <button
          onClick={() => setMinimized(false)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-xl transition-all text-xs font-medium backdrop-blur-md ${
            isDark
              ? "bg-zinc-950/95 border-zinc-800 text-zinc-200 shadow-black/50 hover:bg-zinc-900 hover:border-zinc-700"
              : "bg-white/95 border-zinc-200 text-zinc-800 shadow-zinc-950/10 hover:bg-zinc-50 hover:border-zinc-300"
          }`}
          title="Super Admin Impersonation Active - Click to expand"
        >
          {/* Pulsing Green Live Dot */}
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className={`font-semibold max-w-[140px] truncate ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>
            {displayTenantName}
          </span>
          {/* Compact Timer */}
          <span className="font-mono text-[11px] text-emerald-500 font-semibold">
            {formatTimer(elapsedSeconds)}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
        </button>
      </div>
    );
  }

  // EXPANDED STATE: Draggable, reactive theme styling (light/dark), pulsing green dot, live timer, and red exit button
  return (
    <div
      ref={dragRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={
        position
          ? { left: `${position.x}px`, top: `${position.y}px` }
          : { left: "50%", top: "14px", transform: "translateX(-50%)" }
      }
      className={`fixed z-50 select-none animate-in fade-in slide-in-from-top-2 duration-200 ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      }`}
    >
      <div
        className={`flex items-center gap-2.5 pl-2 pr-1.5 py-1.5 rounded-full border shadow-2xl backdrop-blur-md transition-colors ${
          isDark
            ? "bg-zinc-950/95 border-zinc-800 text-zinc-200 shadow-black/60"
            : "bg-white/95 border-zinc-200 text-zinc-800 shadow-zinc-950/15"
        }`}
      >
        {/* Subtle Grip Drag Handle */}
        <div
          className={`px-0.5 transition-colors ${
            isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600"
          }`}
          title="Drag to reposition"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>

        {/* Pulsing Green Live Dot */}
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>

        {/* Live Timer Stopwatch */}
        <div
          className={`flex items-center gap-1 font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
            isDark
              ? "bg-zinc-900/90 text-emerald-400 border-emerald-500/30"
              : "bg-emerald-50/80 text-emerald-600 border-emerald-500/20"
          }`}
          title="Active impersonation session duration"
        >
          <Timer className="h-3 w-3" />
          <span>{formatTimer(elapsedSeconds)}</span>
        </div>

        {/* Concise essential information */}
        <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
          <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Impersonating:</span>
          <strong className={`font-semibold max-w-[180px] sm:max-w-[260px] truncate ${isDark ? "text-white" : "text-zinc-900"}`}>
            {displayTenantName}
          </strong>
        </div>

        {/* Actions: Red Exit Button + Collapse */}
        <div className={`flex items-center gap-1 ml-1 pl-2 border-l ${isDark ? "border-zinc-800" : "border-zinc-200"}`}>
          <Button
            size="sm"
            onClick={handleExit}
            disabled={exiting}
            className="h-6 px-2.5 text-xs bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-medium rounded-full shadow-sm transition-colors"
            title="Exit Impersonation and return to Super Admin panel"
          >
            <LogOut className="h-3 w-3 mr-1" />
            {exiting ? "Exiting..." : "Exit"}
          </Button>

          <button
            onClick={() => setMinimized(true)}
            className={`h-6 w-6 flex items-center justify-center rounded-full transition-colors ${
              isDark
                ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80"
                : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100"
            }`}
            title="Minimize"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
