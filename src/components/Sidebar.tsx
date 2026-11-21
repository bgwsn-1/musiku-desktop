"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usePlayer } from "@/lib/player";
import {
  IconExplore,
  IconHeart,
  IconHome,
  IconLibAlbum,
  IconLibArtists,
  IconLibPlaylists,
  IconLibRecent,
  IconLibrary,
  IconPlus,
  IconRadio,
  IconSearch,
  IconSidebar,
  IconTrash,
} from "@/components/Icons";

/** Shortcut di bawah header Pustaka — ikon asli Apple Music dari APK. */
const PUSTAKA_SHORTCUTS = [
  { href: "/pustaka/playlist", label: "Playlist", icon: <IconLibPlaylists className="h-5 w-5" /> },
  { href: "/pustaka/artist", label: "Artis", icon: <IconLibArtists className="h-5 w-5" /> },
  { href: "/pustaka/album", label: "Album", icon: <IconLibAlbum className="h-5 w-5" /> },
  {
    href: "/pustaka/songs",
    label: "Lagu Favorit",
    icon: <IconHeart filled className="h-5 w-5" />,
  },
  {
    href: "/pustaka/recent",
    label: "Terakhir Diputar",
    icon: <IconLibRecent className="h-5 w-5" />,
  },
];
import { ConfirmDialog, NewPlaylistDialog } from "@/components/Dialog";
import { Artwork } from "@/components/Artwork";
import { UpdateIndicator } from "@/components/UpdateIndicator";

/** Wordmark whose bars move only while music plays — the one brand moment. */
function Wordmark({ compact }: { compact: boolean }) {
  const p = usePlayer();
  return (
    <Link
      href="/"
      className={`flex items-center rounded-xl py-2 ${
        compact ? "justify-center" : "gap-2.5 px-3"
      }`}
      aria-label="Musiku, beranda"
    >
      <span className={`eq text-accent ${p.playing ? "on" : ""}`} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {!compact && (
        <span className="text-[19px] font-bold leading-none tracking-[-0.03em] text-label1">
          Musiku
        </span>
      )}
    </Link>
  );
}

function NavItem({
  href,
  label,
  icon,
  compact,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  compact: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-label={compact ? label : undefined}
      aria-current={active ? "page" : undefined}
      title={compact ? label : undefined}
      className={`group/nav flex h-10 items-center rounded-xl text-[15px] transition-[background-color,color,scale,width] duration-200 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent focus-visible:outline-offset-2 motion-reduce:scale-100 motion-reduce:transition-none ${
        compact ? "justify-center" : "gap-3 px-3"
      } ${
        active
          ? "bg-fill2 font-semibold text-label1"
          : "font-medium text-label2 hover:bg-fill1 hover:text-label1"
      }`}
    >
      <span className={`transition-[scale] duration-300 ease-[var(--ease-spring)] group-hover/nav:scale-110 motion-reduce:scale-100 motion-reduce:transition-none ${active ? "text-accent" : ""}`}>{icon}</span>
      {compact ? <span className="sr-only">{label}</span> : label}
    </Link>
  );
}

/* ── Desktop: floating glass sidebar. Colour from the page behind it
   shows through; at most two levels (sidebars.md). ── */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const p = usePlayer();
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem("musiku:sidebar-collapsed") === "1");
    } catch {
      /* storage bisa diblokir; sidebar tetap memakai nilai bawaan */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem("musiku:sidebar-collapsed", collapsed ? "1" : "0");
    } catch {
      /* abaikan */
    }
  }, [collapsed, hydrated]);

  const toggle = (
    <button
      onClick={() => setCollapsed((v) => !v)}
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Perbesar sidebar" : "Perkecil sidebar"}
      title={collapsed ? "Perbesar sidebar" : "Perkecil sidebar"}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-label2 transition-colors hover:bg-fill1 hover:text-label1 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent focus-visible:outline-offset-2"
    >
      <span
        className={`inline-flex transition-transform duration-300 ease-[var(--ease-out)] motion-reduce:transition-none ${
          collapsed ? "rotate-180" : ""
        }`}
      >
        <IconSidebar className="h-5 w-5" />
      </span>
    </button>
  );

  return (
    <aside
      className={`glass glass-lg absolute bottom-3 left-3 top-3 z-30 hidden flex-col rounded-[24px] pb-3 pt-3 transition-[width,padding] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none lg:flex ${
        collapsed ? "sidebar-collapsed w-[76px] px-2" : "w-[252px] px-3"
      }`}
      aria-label="Bilah samping"
    >
      <div className={`mb-3 flex items-center ${collapsed ? "flex-col gap-1" : "justify-between gap-2"}`}>
        {collapsed && toggle}
        <Wordmark compact={collapsed} />
        {!collapsed && toggle}
      </div>

      <nav aria-label="Navigasi utama" className="space-y-0.5">
        <NavItem href="/" label="Beranda" icon={<IconHome className="h-5 w-5" />} compact={collapsed} />
        <NavItem href="/explore" label="Explore" icon={<IconExplore className="h-5 w-5" />} compact={collapsed} />
        <NavItem href="/radio" label="Radio" icon={<IconRadio className="h-5 w-5" />} compact={collapsed} />
        <div className={`my-2.5 h-px bg-hairline ${collapsed ? "mx-1" : "mx-3"}`} aria-hidden="true" />

        <div
          className={`mb-1 flex items-center ${
            collapsed ? "justify-center" : "h-7 pl-3 pr-1"
          }`}
        >
          {!collapsed && (
            <h2 className="text-[13px] font-semibold tracking-[0.01em] text-label3">Pustaka</h2>
          )}
        </div>
        {PUSTAKA_SHORTCUTS.map((s) => (
          <NavItem
            key={s.href}
            href={s.href}
            label={s.label}
            icon={s.icon}
            compact={collapsed}
          />
        ))}
      </nav>

      <div className={`mb-1 mt-5 flex items-center ${collapsed ? "justify-center" : "justify-between pl-3 pr-1"}`}>
        {!collapsed && <h2 className="text-[13px] font-semibold text-label3">Playlist</h2>}
        <button
          onClick={() => setCreating(true)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-label2 hover:bg-fill1 hover:text-label1 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent focus-visible:outline-offset-2"
          aria-label="Buat playlist baru"
          title={collapsed ? "Buat playlist baru" : undefined}
        >
          <IconPlus className="h-4 w-4" />
        </button>
      </div>

      <div className="-mx-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1">
        {p.playlists.length === 0 && !collapsed && (
          <p className="px-3 py-2 text-[13px] leading-snug text-label3">
            Belum ada playlist. Tekan + untuk membuat.
          </p>
        )}
        {p.playlists.map((pl) => {
          const active = pathname === `/playlist/${pl.id}`;
          if (collapsed) {
            return (
              <Link
                key={pl.id}
                href={`/playlist/${pl.id}`}
                aria-label={`Playlist ${pl.name}`}
                aria-current={active ? "page" : undefined}
                title={pl.name}
                className={`flex h-10 items-center justify-center rounded-xl ${
                  active ? "bg-fill2" : "hover:bg-fill1"
                }`}
              >
                <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-fill2 text-label3">
                  <Artwork src={pl.tracks[0]?.thumbs} />
                </span>
              </Link>
            );
          }
          return (
            <div
              key={pl.id}
              className={`group flex items-center rounded-xl pr-1 transition-colors ${
                active ? "bg-fill2" : "hover:bg-fill1"
              }`}
            >
              <Link
                href={`/playlist/${pl.id}`}
                aria-current={active ? "page" : undefined}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-fill2 text-label3">
                  <Artwork src={pl.tracks[0]?.thumbs} />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-[14px] leading-tight ${
                      active ? "font-semibold text-label1" : "font-medium text-label1"
                    }`}
                  >
                    {pl.name}
                  </span>
                  <span className="block text-[12px] leading-tight text-label3">
                    {pl.tracks.length} lagu
                  </span>
                </span>
              </Link>
              <button
                className="reveal flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-label3 hover:bg-fill2 hover:text-accent"
                onClick={() => setToDelete({ id: pl.id, name: pl.name })}
                aria-label={`Hapus playlist ${pl.name}`}
              >
                <IconTrash className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      <UpdateIndicator compact={collapsed} />

      <NewPlaylistDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={(name) => {
          const id = p.createPlaylist(name);
          setCreating(false);
          router.push(`/playlist/${id}`);
        }}
      />
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Hapus “${toDelete?.name ?? ""}”?`}
        message="Playlist dihapus dari perangkat ini dan tidak bisa dikembalikan. Lagunya sendiri tidak ikut terhapus."
        confirmLabel="Hapus"
        onConfirm={() => {
          if (!toDelete) return;
          p.deletePlaylist(toDelete.id);
          if (pathname === `/playlist/${toDelete.id}`) router.push("/liked");
        }}
      />
    </aside>
  );
}

/* ── Phone: floating tab bar. Three destinations, always visible, labelled
   (tab-bars.md); targets ≥ 44 pt. ── */
export function MobileTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: "/", label: "Beranda", icon: <IconHome className="h-6 w-6" /> },
    { href: "/search", label: "Cari", icon: <IconSearch className="h-6 w-6" /> },
    { href: "/liked", label: "Pustaka", icon: <IconLibrary className="h-6 w-6" /> },
  ];
  const idx = tabs.findIndex((t) =>
    t.href === "/"
      ? pathname === "/"
      : t.href === "/liked"
        ? pathname.startsWith("/liked") || pathname.startsWith("/playlist")
        : pathname.startsWith(t.href),
  );
  return (
    <nav
      className="glass absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+10px)] z-40 flex h-[60px] gap-1 rounded-full p-1.5 lg:hidden"
      aria-label="Navigasi utama"
    >
      <span
        aria-hidden="true"
        className="absolute bottom-1.5 left-1.5 top-1.5 w-[calc((100%-20px)/3)] rounded-full bg-fill2 transition-[transform,opacity] duration-500 ease-[var(--ease-spring)]"
        style={{ transform: `translateX(calc(${Math.max(idx, 0)} * (100% + 4px)))`, opacity: idx < 0 ? 0 : 1 }}
      />
      {tabs.map((t) => {
        const active =
          t.href === "/"
            ? pathname === "/"
            : t.href === "/liked"
              ? pathname.startsWith("/liked") || pathname.startsWith("/playlist")
              : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-semibold transition-[color,transform] duration-300 active:scale-95 ${
              active ? "text-accent" : "text-label2"
            }`}
          >
            {t.icon}
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
