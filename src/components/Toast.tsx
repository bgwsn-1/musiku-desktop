"use client";

import { useEffect, useState } from "react";

const EVT = "musiku:toast";

/** Quiet confirmation in the interface — not an alert (feedback.md). */
export function toast(message: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVT, { detail: message }));
}

export function Toaster() {
  const [msg, setMsg] = useState<{ id: number; text: string } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      clearTimeout(timer);
      setMsg({ id: Date.now(), text: (e as CustomEvent<string>).detail });
      timer = setTimeout(() => setMsg(null), 2400);
    };
    window.addEventListener(EVT, on);
    return () => {
      window.removeEventListener(EVT, on);
      clearTimeout(timer);
    };
  }, []);
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+154px)] z-[80] flex justify-center px-4 lg:bottom-[112px] lg:pl-[var(--pad-l)]"
    >
      {msg && (
        <div
          key={msg.id}
          className="dialog-in glass relative max-w-full truncate rounded-full px-5 py-2.5 text-[14px] font-semibold text-label1"
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
