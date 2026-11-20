"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IconBack } from "@/components/Icons";

/**
 * Swipe from the left edge to go back (phones / touch tablets).
 * The page follows the finger, a back chip peeks in, and release past ~110 px
 * (or a quick flick) goes back; otherwise it springs home.
 * Note: where the OS already owns the edge gesture (Android gesture navigation,
 * iOS Safari) the system back takes over — this matters most for installed PWAs.
 */
export function EdgeSwipeBack() {
  const router = useRouter();
  const pathname = usePathname();
  const chip = useRef<HTMLDivElement | null>(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    const main = document.getElementById("main");
    const hint = chip.current;
    if (!main || !hint) return;
    let sx = 0, sy = 0, dx = 0, t0 = 0;
    let active = false, decided = false;

    const blocked = () =>
      window.innerWidth >= 1024 ||
      pathRef.current === "/" ||
      !!document.querySelector(
        '[role=dialog],[aria-label="Sedang diputar"],aside[aria-label="Lirik"],aside[aria-label="Antrian"]',
      );

    const settle = (animate: boolean) => {
      main.style.transition = animate ? "transform 0.4s cubic-bezier(0.22,1,0.36,1), opacity 0.4s" : "none";
      main.style.transform = "";
      main.style.opacity = "";
      hint.style.transition = animate ? "opacity 0.25s, transform 0.4s cubic-bezier(0.22,1,0.36,1)" : "none";
      hint.style.opacity = "0";
      hint.style.transform = "translate(-48px,-50%)";
    };

    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1 || blocked()) return;
      const t = e.touches[0];
      if (t.clientX > 24) return;
      sx = t.clientX; sy = t.clientY; dx = 0; t0 = Date.now();
      active = true; decided = false;
    };
    const move = (e: TouchEvent) => {
      if (!active) return;
      const t = e.touches[0];
      dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (!decided) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        decided = true;
        if (dx <= 0 || Math.abs(dy) > Math.abs(dx)) {
          active = false;
          return;
        }
      }
      e.preventDefault();
      const x = dx < 220 ? dx : 220 + (dx - 220) * 0.2; // rubber-band past 220
      main.style.transition = "none";
      main.style.transform = `translateX(${x}px)`;
      main.style.opacity = String(1 - Math.min(x / 600, 0.3));
      hint.style.transition = "none";
      hint.style.opacity = String(Math.min(dx / 70, 1));
      hint.style.transform = `translate(${Math.min(dx * 0.35, 56) - 20}px,-50%) scale(${dx > 110 ? 1.1 : 1})`;
    };
    const end = () => {
      if (!active) return;
      active = false;
      if (!decided) return;
      const fast = dx / Math.max(1, Date.now() - t0) > 0.55;
      if (dx > 110 || (fast && dx > 40)) {
        main.style.transition = "transform 0.22s ease-out, opacity 0.22s";
        main.style.transform = "translateX(100%)";
        main.style.opacity = "0.4";
        setTimeout(() => {
          router.back();
          setTimeout(() => settle(false), 80);
        }, 200);
        hint.style.opacity = "0";
      } else {
        settle(true);
      }
    };
    const cancel = () => {
      if (active && decided) settle(true);
      active = false;
    };

    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", end);
    document.addEventListener("touchcancel", cancel);
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end);
      document.removeEventListener("touchcancel", cancel);
    };
  }, [router]);

  return (
    <div
      ref={chip}
      aria-hidden="true"
      style={{ opacity: 0, transform: "translate(-48px,-50%)" }}
      className="glass pointer-events-none fixed left-0 top-1/2 z-[55] flex h-11 w-11 items-center justify-center rounded-full text-label1 lg:hidden"
    >
      <IconBack className="h-5 w-5" />
    </div>
  );
}
