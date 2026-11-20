"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayer } from "@/lib/player";
import { LyricsPanel } from "@/components/LyricsPanel";
import { QueuePanel } from "@/components/QueuePanel";

/**
 * Lyrics / queue.
 *  desktop → floating glass inspector, non-modal
 *  phone   → resizable-style sheet: grabber, swipe down, scrim tap and Esc all dismiss
 */
export function RightPanel() {
  const p = usePlayer();
  const ui = p.ui;
  const toggleUi = p.toggleUi;
  const [drag, setDrag] = useState(0);
  const startY = useRef<number | null>(null);
  // keep the panel mounted while its exit animation plays
  const [shown, setShown] = useState<"lyrics" | "queue" | null>(ui);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (ui) {
      setShown(ui);
      setClosing(false);
      return;
    }
    if (!shown) return;
    setClosing(true);
    const t = setTimeout(() => {
      setShown(null);
      setClosing(false);
      setDrag(0);
    }, 280);
    return () => clearTimeout(t);
  }, [ui, shown]);

  useEffect(() => {
    if (!ui) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=dialog]")) toggleUi(ui);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ui, toggleUi]);

  if (!shown) return null;
  const close = () => ui && toggleUi(ui);

  return (
    <>
      <div className={`${closing ? "scrim-out pointer-events-none" : "scrim-in"} fixed inset-0 z-[45] bg-black/35 lg:hidden`} onClick={close} aria-hidden="true" />
      <aside
        aria-label={shown === "lyrics" ? "Lirik" : "Antrian"}
        style={{ ["--drag" as string]: `${drag}px` } as React.CSSProperties}
        className={`${closing ? "panel-out pointer-events-none" : "panel-in"} glass glass-lg fixed inset-x-0 bottom-0 top-[9dvh] z-[46] flex flex-col overflow-hidden rounded-t-[28px] lg:absolute lg:inset-x-auto lg:bottom-[108px] lg:right-3 lg:top-[76px] lg:w-[400px] lg:rounded-[26px]`}
      >
        <div
          className="flex h-7 shrink-0 cursor-grab touch-none items-center justify-center lg:hidden"
          onPointerDown={(e) => {
            startY.current = e.clientY;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (startY.current !== null) setDrag(Math.max(0, e.clientY - startY.current));
          }}
          onPointerUp={() => {
            const far = drag > 110;
            startY.current = null;
            if (far) close(); // keep the drag offset so the sheet continues from where the finger left it
            else setDrag(0);
          }}
          onPointerCancel={() => {
            startY.current = null;
            setDrag(0);
          }}
          aria-hidden="true"
        >
          <span className="h-1 w-9 rounded-full bg-[var(--track)]" />
        </div>
        {shown === "lyrics" ? <LyricsPanel /> : <QueuePanel />}
      </aside>
    </>
  );
}
