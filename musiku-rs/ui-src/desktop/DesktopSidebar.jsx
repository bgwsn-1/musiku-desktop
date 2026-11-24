// Sidebar kiri shell desktop: pencarian cepat di atas, menu utama,
// grup Pustaka, dan manajemen Playlist lokal.
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePlayer } from "@/lib/player";
import {
  IconClose,
  IconExplore,
  IconHeart,
  IconHome,
  IconLibAlbum,
  IconLibArtists,
  IconLibPlaylists,
  IconLibRecent,
  IconPlus,
  IconRadio,
  IconSearch,
  IconTrash,
  IconUser,
} from "@/components/Icons";
import { useAccount } from "./CloudAccountContext.jsx";
import { AccountModal } from "./AccountModal.jsx";

function IconChevronDown({ open, className = "h-3.5 w-3.5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className} transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

const MAIN_LINKS = [
  { href: "/", label: "Beranda", icon: IconHome },
  { href: "/explore", label: "Explore", icon: IconExplore },
  { href: "/radio", label: "Radio", icon: IconRadio },
];

const LIBRARY_LINKS = [
  { href: "/pustaka/recent", label: "Terakhir Diputar", icon: IconLibRecent },
  { href: "/pustaka/songs", label: "Lagu Favorit", icon: IconHeart, heart: true },
  { href: "/pustaka/album", label: "Album", icon: IconLibAlbum },
  { href: "/pustaka/artist", label: "Artis", icon: IconLibArtists },
];

export function DesktopSidebar({
  collapsed,
  onExpandForSearch,
  mobileOpen,
  onCloseMobile,
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { playlists, createPlaylist, deletePlaylist } = usePlayer();
  const account = useAccount();

  const [q, setQ] = useState(() => searchParams.get("q") || "");
  const [libOpen, setLibOpen] = useState(true);
  const [plOpen, setPlOpen] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [delTarget, setDelTarget] = useState(null);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    const paramQ = searchParams.get("q");
    if (pathname.startsWith("/search") && paramQ !== null) {
      setQ(paramQ);
    }
  }, [pathname, searchParams]);

  // Tutup modal dengan Escape.
  useEffect(() => {
    if (!createOpen && !delTarget) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setCreateOpen(false);
        setDelTarget(null);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [createOpen, delTarget]);

  const submitSearch = (e) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    router.push(`/search?q=${encodeURIComponent(term)}`);
    onCloseMobile?.();
  };

  const handleCreate = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const id = createPlaylist(name);
    setNewName("");
    setCreateOpen(false);
    router.push(`/playlist/${id}`);
    onCloseMobile?.();
  };

  const handleDelete = () => {
    if (!delTarget) return;
    const id = delTarget.id;
    deletePlaylist(id);
    setDelTarget(null);
    if (pathname === `/playlist/${id}`) {
      router.push("/liked");
    }
  };

  const isCompact = collapsed && !mobileOpen;

  return (
    <>
      {mobileOpen && (
        <div
          className="ds-backdrop lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`ds-sidebar ${mobileOpen ? "flex" : "hidden lg:flex"}`}
        data-collapsed={isCompact ? "1" : undefined}
        data-mobile={mobileOpen ? "1" : undefined}
        aria-label="Navigasi utama"
      >
        {mobileOpen && (
          <div className="mb-2 flex items-center justify-between px-1 lg:hidden">
            <span className="text-[13px] font-bold text-[#f3efec]">Musiku</span>
            <button
              type="button"
              className="ds-sec-add"
              onClick={onCloseMobile}
              aria-label="Tutup navigasi"
            >
              <IconClose className="h-4 w-4" />
            </button>
          </div>
        )}

        {isCompact ? (
          <button
            type="button"
            className="ds-search-btn"
            onClick={() => {
              onExpandForSearch?.();
              requestAnimationFrame(() => document.getElementById("ds-search-input")?.focus());
            }}
            aria-label="Cari lagu, album, atau artis"
            title="Cari (/)"
          >
            <IconSearch className="h-4 w-4" />
          </button>
        ) : (
          <form className="ds-search" onSubmit={submitSearch} role="search">
            <IconSearch className="h-4 w-4 shrink-0" />
            <label htmlFor="ds-search-input" className="sr-only">
              Cari lagu, album, atau artis
            </label>
            <input
              id="ds-search-input"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              className="ds-search-input"
            />
          </form>
        )}

        <nav className="ds-nav-scroll" aria-label="Menu sidebar">
          {MAIN_LINKS.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/" ? pathname === "/" || pathname === "" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className="ds-nav-item"
                data-active={active ? "1" : undefined}
                aria-current={active ? "page" : undefined}
                title={isCompact ? item.label : undefined}
              >
                <span className="ds-nav-ico">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                {!isCompact && <span className="ds-nav-label">{item.label}</span>}
              </Link>
            );
          })}

          {!isCompact && (
            <div className="ds-sec-head">
              <button
                type="button"
                className="ds-sec-toggle"
                onClick={() => setLibOpen((v) => !v)}
                aria-expanded={libOpen}
              >
                <span>Pustaka</span>
                <IconChevronDown open={libOpen} />
              </button>
            </div>
          )}

          {(isCompact || libOpen) &&
            LIBRARY_LINKS.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href ||
                (item.href === "/pustaka/songs" && pathname === "/liked");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onCloseMobile}
                  className="ds-nav-item"
                  data-active={active ? "1" : undefined}
                  aria-current={active ? "page" : undefined}
                  title={isCompact ? item.label : undefined}
                >
                  <span className="ds-nav-ico">
                    {item.heart ? (
                      <Icon filled={active} className="h-[17px] w-[17px]" />
                    ) : (
                      <Icon className="h-[18px] w-[18px]" />
                    )}
                  </span>
                  {!isCompact && <span className="ds-nav-label">{item.label}</span>}
                </Link>
              );
            })}

          {!isCompact && (
            <div className="ds-sec-head">
              <button
                type="button"
                className="ds-sec-toggle"
                onClick={() => setPlOpen((v) => !v)}
                aria-expanded={plOpen}
              >
                <span>Playlist</span>
                <IconChevronDown open={plOpen} />
              </button>
              <button
                type="button"
                className="ds-sec-add"
                onClick={() => setCreateOpen(true)}
                aria-label="Buat playlist baru"
                title="Buat playlist baru"
              >
                <IconPlus className="h-4 w-4" />
              </button>
            </div>
          )}

          {(isCompact || plOpen) && (
            <>
              {!isCompact && (
                <button
                  type="button"
                  className="ds-nav-item"
                  onClick={() => setCreateOpen(true)}
                >
                  <span className="ds-nav-ico">
                    <IconPlus className="h-[17px] w-[17px]" />
                  </span>
                  <span className="ds-nav-label">Buat Baru</span>
                </button>
              )}

              <Link
                href="/pustaka/playlist"
                onClick={onCloseMobile}
                className="ds-nav-item"
                data-active={pathname === "/pustaka/playlist" ? "1" : undefined}
                aria-current={pathname === "/pustaka/playlist" ? "page" : undefined}
                title={isCompact ? "Semua Playlist" : undefined}
              >
                <span className="ds-nav-ico">
                  <IconLibPlaylists className="h-[18px] w-[18px]" />
                </span>
                {!isCompact && <span className="ds-nav-label">Semua Playlist</span>}
              </Link>

              {!isCompact &&
                Array.isArray(playlists) &&
                playlists.map((pl) => {
                  const href = `/playlist/${pl.id}`;
                  const active = pathname === href;
                  return (
                    <div key={pl.id} className="ds-pl-row">
                      <Link
                        href={href}
                        onClick={onCloseMobile}
                        className="ds-nav-item"
                        data-active={active ? "1" : undefined}
                        aria-current={active ? "page" : undefined}
                      >
                        <span className="ds-nav-ico">
                          <IconLibPlaylists className="h-[16px] w-[16px]" />
                        </span>
                        <span className="ds-nav-label">{pl.name}</span>
                      </Link>
                      <button
                        type="button"
                        className="ds-pl-del"
                        onClick={() => setDelTarget(pl)}
                        aria-label={`Hapus playlist ${pl.name}`}
                        title={`Hapus ${pl.name}`}
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
            </>
          )}
        </nav>

        <div className="ds-sidebar-foot">
          <button
            type="button"
            className="ds-account-btn"
            onClick={() => setAccountOpen(true)}
            aria-label={account.user ? `Akun ${account.displayName || "Musiku"}` : "Masuk atau daftar akun Musiku"}
            title={
              isCompact
                ? account.user
                  ? account.displayName || "Akun Musiku"
                  : "Masuk / Daftar"
                : undefined
            }
          >
            <span
              className="ds-account-avatar"
              data-guest={account.user ? undefined : "1"}
              aria-hidden="true"
            >
              {account.user ? (
                (account.displayName || account.user.email || "M").slice(0, 1).toUpperCase()
              ) : (
                <IconUser className="h-4 w-4" />
              )}
            </span>
            {!isCompact && (
              <span className="ds-account-meta">
                <span className="ds-account-name">
                  {account.user ? account.displayName || "Pengguna Musiku" : "Masuk / Daftar"}
                </span>
                <span className="ds-account-sub">
                  {account.user ? (
                    <>
                      <span className="ds-account-dot" data-state={account.syncStatus} aria-hidden="true" />
                      <span>
                        {account.syncStatus === "syncing"
                          ? "Menyinkronkan..."
                          : account.syncStatus === "error"
                            ? "Gagal sinkron"
                            : account.syncStatus === "synced"
                              ? "Tersinkron"
                              : "Terhubung"}
                      </span>
                    </>
                  ) : (
                    <span>Sinkronkan pustaka</span>
                  )}
                </span>
              </span>
            )}
          </button>
        </div>
      </aside>

      {createOpen && (
        <div
          className="ds-modal-wrap"
          role="dialog"
          aria-modal="true"
          aria-label="Buat playlist baru"
          onClick={() => setCreateOpen(false)}
        >
          <form
            className="ds-modal"
            onSubmit={handleCreate}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[16px] font-bold text-[#f3efec]">Playlist Baru</h2>
            <p className="mt-1 text-[13px] text-[#b9b2ae]">
              Disimpan lokal di perangkat ini.
            </p>
            <label htmlFor="ds-new-pl-name" className="sr-only">
              Nama playlist
            </label>
            <input
              id="ds-new-pl-name"
              type="text"
              autoFocus
              maxLength={80}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nama playlist"
              className="mt-3 h-10 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-[14px] text-[#f3efec] outline-none focus:border-white/40"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="cursor-pointer rounded-xl px-4 py-2 text-[13px] font-semibold text-[#d5cfcb] hover:bg-white/10"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!newName.trim()}
                className="cursor-pointer rounded-xl bg-[#f6efe9] px-4 py-2 text-[13px] font-semibold text-[#111011] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Buat
              </button>
            </div>
          </form>
        </div>
      )}

      {delTarget && (
        <div
          className="ds-modal-wrap"
          role="dialog"
          aria-modal="true"
          aria-label="Konfirmasi hapus playlist"
          onClick={() => setDelTarget(null)}
        >
          <div className="ds-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-bold text-[#f3efec]">
              Hapus &ldquo;{delTarget.name}&rdquo;?
            </h2>
            <p className="mt-1.5 text-[13px] text-[#b9b2ae]">
              Playlist dihapus dari perangkat ini dan tidak dapat dikembalikan. Lagu yang disukai tidak ikut terhapus.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDelTarget(null)}
                className="cursor-pointer rounded-xl px-4 py-2 text-[13px] font-semibold text-[#d5cfcb] hover:bg-white/10"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="cursor-pointer rounded-xl bg-[#ff7a63] px-4 py-2 text-[13px] font-semibold text-[#111011] hover:opacity-90"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
      {accountOpen && <AccountModal onClose={() => setAccountOpen(false)} />}
    </>
  );
}
