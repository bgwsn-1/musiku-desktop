"use client";

/**
 * Halaman Beranda: rak-rak dari /api/home, filter chip (Semua/Lagu/Album/Artis),
 * dan kartu artis #1 paling banyak diputar (diurutkan dari monthlyListeners
 * `/api/artist/:id`, bukan tebakan).
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GridCard, Shelf } from "@/components/GridCard";
import { FeaturedCarousel, SongColumns } from "@/components/HomeFeatured";
import { RecentShelf } from "@/components/RecentShelf";
import { IconPlay } from "@/components/Icons";
import { Artwork } from "@/components/Artwork";
import type { ArtistDetail, HomeItem, HomeShelf } from "@/lib/types";

type Tab = "all" | "song" | "album" | "artist";

const TABS: [Tab, string][] = [
  ["all", "Semua"],
  ["song", "Lagu"],
  ["album", "Album"],
  ["artist", "Artis"],
];

function matches(item: HomeItem, tab: Tab): boolean {
  if (tab === "all") return true;
  if (tab === "artist") return item.kind === "artist";
  if (tab === "album") return item.kind === "album";
  return item.kind === "song" || !!item.videoId;
}

/** "63.6M monthly audience" -> 63_600_000; angka mentah dipakai apa adanya. */
function parseCount(v: string | number | null | undefined): number {
  if (v == null) return -1;
  if (typeof v === "number") return v;
  const m = String(v).match(/([\d.,]+)\s*([kKmMbB])?/);
  if (!m) return -1;
  const n = parseFloat(m[1].replace(",", "."));
  if (!Number.isFinite(n)) return -1;
  const mult = m[2] ? { k: 1e3, m: 1e6, b: 1e9 }[m[2].toLowerCase()] : 1;
  return n * (mult ?? 1);
}

export function HomeFeed({ shelves }: { shelves: HomeShelf[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const [top, setTop] = useState<ArtistDetail | null>(null);

  const lead = shelves[0];
  const songsIdx = shelves.findIndex(
    (s, i) => i > 0 && s.items.filter((x) => x.videoId).length >= 3,
  );
  const songs = songsIdx > 0 ? shelves[songsIdx] : undefined;
  const rest = shelves.filter((_, i) => i !== 0 && i !== songsIdx);

  // Kandidat artis diambil dari semua rak; ambil beberapa yang pertama.
  const candidates = useMemo(() => {
    const seen = new Set<string>();
    const out: HomeItem[] = [];
    for (const sh of shelves) {
      for (const it of sh.items) {
        if (it.kind === "artist" && it.browseId && !seen.has(it.browseId)) {
          seen.add(it.browseId);
          out.push(it);
        }
      }
    }
    return out.slice(0, 6);
  }, [shelves]);

  useEffect(() => {
    let live = true;
    setTop(null);
    Promise.all(
      candidates.map((c) =>
        fetch(`/api/artist/${c.browseId}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ),
    ).then((list) => {
      if (!live) return;
      const ok = list.filter(Boolean) as ArtistDetail[];
      ok.sort(
        (a, b) => parseCount(b.monthlyListeners) - parseCount(a.monthlyListeners),
      );
      setTop(ok[0] ?? null);
    });
    return () => {
      live = false;
    };
  }, [candidates]);

  const shownRest =
    tab === "all"
      ? rest
      : rest
          .map((sh) => ({ ...sh, items: sh.items.filter((it) => matches(it, tab)) }))
          .filter((sh) => sh.items.length > 0);

  return (
    <div>
      <header className="mb-5">
        <h1 className="t-large">Beranda</h1>
      </header>

      <div
        className="no-scrollbar -mx-1 mb-6 flex max-w-full overflow-x-auto px-1"
        role="group"
        aria-label="Saring beranda"
      >
        <div className="inline-flex gap-1 rounded-full bg-fill1 p-1">
          {TABS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              aria-pressed={tab === k}
              className={`h-9 shrink-0 rounded-full px-4 text-[14px] font-semibold transition-colors ${
                tab === k
                  ? "bg-[var(--seg-thumb)] text-label1 shadow-[0_1px_3px_rgba(0,0,0,0.18)]"
                  : "text-label2 hover:text-label1"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {lead && lead.items.length > 0 && (
        <FeaturedCarousel items={lead.items.slice(0, 6)} />
      )}

      {top && (
        <section aria-label="Artis paling banyak diputar" className="mb-9">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="t-title text-label1">Paling banyak diputar</h2>
            <span className="text-[13px] text-label3">Bulan ini · #1</span>
          </div>
          <Link
            href={`/artist/${top.browseId}`}
            className="card-anim group block w-full max-w-[560px] text-left"
            aria-label={`${top.name}${top.monthlyListeners ? `, ${top.monthlyListeners}` : ""}`}
          >
            <p className="t-eyebrow !text-label3">Artis</p>
            <h3 className="mt-1.5 truncate text-[20px] font-semibold leading-tight tracking-[-0.015em] text-label1">
              {top.name}
            </h3>
            <p className="truncate text-[20px] font-light leading-tight tracking-[-0.01em] text-label2">
              {top.monthlyListeners
                ? `${top.monthlyListeners}`
                : top.subscribers
                  ? `${top.subscribers} pelanggan`
                  : ""}
            </p>
            <div className="relative mt-3 aspect-[1.4] w-full overflow-hidden rounded-[12px] bg-fill1 shadow-[var(--shadow-art)] transition-transform duration-500 ease-[var(--ease-spring)] group-active:scale-[0.98]">
              <Artwork src={top.thumbs ?? top.avatar ?? null} />
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-black/35 px-3.5 py-2.5 text-white backdrop-blur-xl">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-snug">
                  Lihat lagunya sekarang
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/25">
                  <IconPlay className="ml-0.5 h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </Link>
        </section>
      )}

      {(tab === "all" || tab === "song") && songs && (
        <SongColumns title={songs.title || "Lagu Terbaru"} items={songs.items.slice(0, 12)} />
      )}

      <RecentShelf />

      {shownRest.map((sh, si) => (
        <Shelf key={sh.title ?? si} title={sh.title ?? ""}>
          {sh.items.map((it, i) => {
            if (it.kind === "artist" && it.browseId) {
              return (
                <GridCard
                  key={`ar${i}-${it.browseId}`}
                  i={i}
                  title={it.title}
                  subtitle={it.artist}
                  href={`/artist/${it.browseId}`}
                  img={it.thumbs}
                  round
                />
              );
            }
            if (it.kind === "album" && it.browseId) {
              return (
                <GridCard
                  key={`al${i}-${it.browseId}`}
                  i={i}
                  title={it.title}
                  subtitle={it.artist}
                  href={`/album/${it.browseId}`}
                  img={it.thumbs}
                />
              );
            }
            return (
              <GridCard
                key={`s${i}-${it.videoId ?? i}`}
                i={i}
                title={it.title}
                subtitle={it.artist}
                href={
                  it.kind === "album" && it.browseId
                    ? `/album/${it.browseId}`
                    : undefined
                }
                img={it.thumbs}
                track={
                  it.videoId
                    ? {
                        videoId: it.videoId,
                        title: it.title,
                        artist: it.artist,
                        artistId: it.artistId,
                        thumbs: it.thumbs,
                      }
                    : undefined
                }
              />
            );
          })}
        </Shelf>
      ))}

      {tab !== "all" && shownRest.length === 0 && (
        <p className="py-10 text-center text-[15px] text-label2">
          Tidak ada {TABS.find(([k]) => k === tab)?.[1].toLowerCase()} di beranda saat ini.
        </p>
      )}

      {!shelves.length && (
        <div className="py-24 text-center">
          <p className="text-[17px] font-semibold text-label1">Beranda belum bisa dimuat</p>
          <p className="mt-1 text-[15px] text-label2">
            Cek koneksi, lalu muat ulang. Kamu tetap bisa{" "}
            <a href="/search" className="font-semibold text-accent underline-offset-2 hover:underline">
              mencari lagu
            </a>
            .
          </p>
        </div>
      )}

      <p className="mt-4 text-[13px] leading-relaxed text-label3">
        Metadata dari YouTube Music. Favorit dan playlist tersimpan di perangkat ini, tanpa akun.
      </p>
    </div>
  );
}
