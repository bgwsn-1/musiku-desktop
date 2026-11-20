"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconClose, IconSearch } from "@/components/Icons";

/**
 * Kolom pencarian. Dipakai dua tempat:
 *  - `topbar`: desktop, di toolbar atas (mengecil jadi tombol saat judul masuk)
 *  - `dock`:   HP, di atas tab bar — spot yang sama dengan mini player
 * Keduanya berbagi perilaku: debounce, Enter, tombol hapus, dan pintasan / ⌘K.
 */
export function SearchForm({
  variant = "topbar",
  collapsed = false,
  className = "",
}: {
  variant?: "topbar" | "dock";
  collapsed?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dock = variant === "dock";

  // keep the field in step with the URL when landing on / leaving search
  useEffect(() => {
    if (pathname === "/search") {
      setQ(new URLSearchParams(window.location.search).get("q") ?? "");
    } else {
      setQ("");
    }
  }, [pathname]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // "/" and ⌘K / Ctrl+K focus search. Hanya field yang terlihat yang merespons:
  // di HP top bar disembunyikan, di desktop dock-nya yang disembunyikan.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const self = input.current;
      if (!self || self.offsetParent === null) return;
      const el = e.target as HTMLElement | null;
      const typing = !!el?.closest("input,textarea,select,[contenteditable]");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        self.focus();
        self.select();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (v: string) =>
    router.push(v.trim() ? `/search?q=${encodeURIComponent(v.trim())}` : "/search");

  const onChange = (v: string) => {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => go(v), 380);
  };

  return (
    <form
      role="search"
      onClick={() => input.current?.focus()}
      className={[
        "pointer-events-auto glass relative flex min-w-0 items-center gap-2.5",
        dock ? "search-dock h-16 w-full rounded-[26px] pl-4 pr-2" : "search-pill h-12 rounded-full pl-4 pr-1.5",
        !dock && collapsed ? "is-collapsed" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        go(q);
      }}
    >
      <IconSearch className="h-[18px] w-[18px] shrink-0 text-label2" />
      <input
        ref={input}
        value={q}
        onChange={(e) => onChange(e.target.value)}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        placeholder="Cari lagu, artis, album"
        aria-label="Cari"
        className="min-w-0 flex-1 bg-transparent text-[16px] text-label1 outline-none placeholder:text-label2 [&::-webkit-search-cancel-button]:hidden"
      />
      {q ? (
        <button
          type="button"
          onClick={() => {
            setQ("");
            input.current?.focus();
            if (pathname === "/search") router.replace("/search");
          }}
          className={`flex shrink-0 items-center justify-center rounded-full text-label2 hover:bg-fill1 hover:text-label1 ${
            dock ? "h-10 w-10" : "h-9 w-9"
          }`}
          aria-label="Hapus pencarian"
        >
          <IconClose className="h-4 w-4" />
        </button>
      ) : (
        !dock && (
          <kbd
            className="mr-2.5 hidden rounded-md bg-fill1 px-1.5 py-0.5 font-sans text-[12px] font-medium text-label3 lg:block [@media(hover:none)]:hidden"
            aria-hidden="true"
          >
            /
          </kbd>
        )
      )}
    </form>
  );
}
