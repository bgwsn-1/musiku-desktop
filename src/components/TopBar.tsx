"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IconBack, IconForward } from "@/components/Icons";
import { SearchForm } from "@/components/SearchForm";
import { usePlayer } from "@/lib/player";

/**
 * Toolbar = floating glass controls, no full-width bar behind them: content
 * fades out underneath through the scroll-edge effect (toolbars.md, liquid-glass.md).
 */
export function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const hasTrack = !!usePlayer().current;
  const onHome = pathname === "/";
  const [title, setTitle] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  // Large title → toolbar title: when the page's <h1> scrolls under the toolbar,
  // its text slides into the toolbar and search folds into a button.
  useEffect(() => {
    setCollapsed(false);
    setTitle("");
    const root = document.getElementById("main");
    if (!root) return;
    let io: IntersectionObserver | null = null;
    let mo: MutationObserver | null = null;
    const attach = () => {
      const h = root.querySelector("h1");
      if (!h) return false;
      io?.disconnect();
      io = new IntersectionObserver(
        ([e]) => {
          const gone = !e.isIntersecting && e.boundingClientRect.top < (e.rootBounds?.top ?? 0);
          if (gone) setTitle(h.textContent ?? "");
          setCollapsed(gone);
        },
        { root, rootMargin: "-60px 0px 0px 0px", threshold: 0 },
      );
      io.observe(h);
      return true;
    };
    if (!attach()) {
      mo = new MutationObserver(() => {
        if (attach()) mo?.disconnect();
      });
      mo.observe(root, { childList: true, subtree: true });
    }
    return () => {
      io?.disconnect();
      mo?.disconnect();
    };
  }, [pathname]);

  const circle =
    "glass-btn flex h-11 w-11 items-center justify-center rounded-full text-label1";

  return (
    <header className="pointer-events-none absolute left-[var(--pad-l)] right-[var(--pad-r)] top-[max(12px,env(safe-area-inset-top))] z-30 flex items-center gap-2.5">
      <div className={`pointer-events-auto glass relative flex rounded-full p-0.5 ${onHome ? "max-lg:hidden" : ""}`}>
        <button onClick={() => router.back()} className={circle} aria-label="Kembali">
          <IconBack className="h-5 w-5" />
        </button>
        <button onClick={() => router.forward()} className={`${circle} max-lg:hidden`} aria-label="Maju">
          <IconForward className="h-5 w-5" />
        </button>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none min-w-0 truncate text-center text-[17px] font-semibold tracking-[-0.015em] text-label1 transition-[flex-grow,opacity,transform] duration-500 ease-[var(--ease-spring)]"
        style={{
          flexGrow: collapsed ? 1 : 0,
          flexBasis: 0,
          opacity: collapsed ? 1 : 0,
          transform: collapsed ? "none" : "translateY(8px)",
        }}
      >
        {title}
      </div>

      {/* search lives here on desktop, and on phones once a song is playing
          (the mini player then takes the dock spot above the tab bar) */}
      <SearchForm
        collapsed={collapsed}
        className={`min-w-0 flex-1 lg:flex lg:max-w-[460px] ${hasTrack ? "flex max-lg:animate-[rise_0.45s_var(--ease-out)_both]" : "hidden"}`}
      />
    </header>
  );
}
