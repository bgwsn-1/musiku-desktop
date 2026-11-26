// Entry bundle UI Musiku (Rust server / Tauri).
//
// Shell-nya meniru `src/app/layout.tsx`; halaman-halaman yang di web adalah
// server component (home / album / artist) ditulis ulang di sini sebagai
// komponen klien yang memanggil `/api/*` — bentuk data & tampilan tetap sama
// karena komponen presentasinya diimpor langsung dari web app.
import { createRoot } from "react-dom/client";
import { Component, StrictMode, Suspense, useCallback, useEffect, useState } from "react";

import { PlayerProvider, usePlayer } from "@/lib/player";
import { PageFade } from "@/components/PageFade";
import { Toaster } from "@/components/Toast";
import { EdgeSwipeBack } from "@/components/EdgeSwipeBack";
import { GridCard, Shelf } from "@/components/GridCard";
import { FeaturedCarousel } from "@/components/HomeFeatured";
import { RadioStations } from "@/components/RadioStations";
import {
  IconBack,
  IconDisc,
  IconExpand,
  IconForward,
  IconLyrics,
  IconQueue,
  IconSidebar,
} from "@/components/Icons";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import SearchPage from "@/app/search/page";
import LikedPage from "@/app/liked/page";
import { PustakaSection } from "@/components/PustakaSection";
import { PlaylistView } from "@/components/PlaylistView";
import { YtmPlaylistView } from "@/components/YtmPlaylistView";
import DiscordPresence from "./desktop/DiscordPresence.jsx";
import { DesktopSidebar } from "./desktop/DesktopSidebar.jsx";
import { DesktopRightPanel } from "./desktop/DesktopRightPanel.jsx";
import { DesktopPlayerBar } from "./desktop/DesktopPlayerBar.jsx";
import { DesktopHomePage } from "./desktop/DesktopHomePage.jsx";
import { DesktopAlbumPage } from "./desktop/DesktopAlbumPage.jsx";
import { DesktopArtistPage } from "./desktop/DesktopArtistPage.jsx";
import { DesktopLibraryPage } from "./desktop/DesktopLibraryPage.jsx";
import { DesktopSearchPage } from "./desktop/DesktopSearchPage.jsx";
import { DesktopSettingsPage } from "./desktop/DesktopSettingsPage.jsx";
import { DesktopProfilePage } from "./desktop/DesktopProfilePage.jsx";
import {
  DesktopExplorePage,
  DesktopRadioPage,
} from "./desktop/DesktopExploreRadio.jsx";
import { initAccentTheme } from "./desktop/accentTheme.js";
import {
  DesktopPlaylistView,
  DesktopYtmPlaylistView,
} from "./desktop/DesktopPlaylistPage.jsx";
import {
  CloudAccountProvider,
  CloudSyncBridge,
  useAccount,
} from "./desktop/CloudAccountContext.jsx";
import { ImmersiveLyrics } from "./desktop/ImmersiveLyrics.jsx";
import { CoverFlow } from "./desktop/CoverFlow.jsx";
import { initElasticScroll } from "./elastic-scroll.js";

// ── helper kecil ─────────────────────────────────────────────────────────
async function jget(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

// Prefetch sekali per URL. Home, mood, dan charts dimulai bersamaan supaya
// HomeFeed tidak menunggu waterfall kedua setelah /api/home selesai.
const bootFetch = new Map();
function cachedGet(url) {
  let p = bootFetch.get(url);
  if (!p) {
    p = jget(url)
      .then((data) => {
        if (data == null || (Array.isArray(data) && data.length === 0)) {
          bootFetch.delete(url);
        }
        return data;
      })
      .catch(() => {
        // Jangan cache kegagalan jaringan secara permanen sepanjang sesi.
        bootFetch.delete(url);
        return null;
      });
    bootFetch.set(url, p);
  }
  return p;
}

function Centered({ title, sub }) {
  return (
    <div className="py-24 text-center">
      <p className="text-[17px] font-semibold text-label1">{title}</p>
      <p className="mt-1 text-[15px] text-label2">{sub}</p>
    </div>
  );
}

function toTrack(it) {
  return it.videoId
    ? {
        videoId: it.videoId,
        title: it.title,
        artist: it.artist,
        artistId: it.artistId,
        thumbs: it.thumbs,
      }
    : null;
}

function useHomeShelves() {
  const [shelves, setShelves] = useState(null); // null = memuat
  useEffect(() => {
    let live = true;
    cachedGet("/api/home").then((s) => {
      if (live) setShelves(Array.isArray(s) ? s : []);
    });
    return () => {
      live = false;
    };
  }, []);
  return shelves;
}

function LoadingPage({ title, sub }) {
  return (
    <div>
      <header className="mb-5">
        <h1 className="t-large">{title}</h1>
        {sub && <p className="mt-1 text-[15px] text-label2">{sub}</p>}
      </header>
      <div className="animate-pulse space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-fill1" />
        ))}
      </div>
    </div>
  );
}

// ── Halaman beranda desktop (gaya YesPlayMusic) ──────────────────────────
function HomePage() {
  const shelves = useHomeShelves();

  if (shelves === null) {
    return (
      <div className="ypm-home animate-pulse">
        <div className="ypm-hero-grid">
          <div className="h-[200px] rounded-[20px] bg-white/5" />
          <div className="h-[200px] rounded-[20px] bg-white/5" />
        </div>
        <div className="mt-9 ypm-card-grid">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="aspect-square rounded-[16px] bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  return <DesktopHomePage shelves={shelves} />;
}

// ── Halaman album desktop full-bleed ─────────────────────────────────────
function AlbumPage({ id }) {
  return <DesktopAlbumPage id={id} />;
}

// ── Halaman artis desktop full-bleed ─────────────────────────────────────
function ArtistPage({ id }) {
  return <DesktopArtistPage id={id} />;
}

// ── Explore (YesPlayMusic-aligned) ───────────────────────────────────────
function ExplorePage() {
  const shelves = useHomeShelves();
  return <DesktopExplorePage shelves={shelves} />;
}

// ── Radio (YesPlayMusic-aligned) ─────────────────────────────────────────
function RadioPage() {
  const shelves = useHomeShelves();
  return <DesktopRadioPage shelves={shelves} />;
}

// ── Router + shell ───────────────────────────────────────────────────────
// Judul dokumen mengikuti halaman, seperti metadata Next.
function pageTitle(pathname) {
  if (pathname === "/" || pathname === "") return "Musiku";
  if (pathname.startsWith("/search")) return "Pencarian — Musiku";
  if (pathname.startsWith("/explore")) return "Explore — Musiku";
  if (pathname.startsWith("/radio")) return "Radio — Musiku";
  if (pathname.startsWith("/liked")) return "Disukai — Musiku";
  if (pathname.startsWith("/pustaka")) return "Pustaka — Musiku";
  if (pathname.startsWith("/album/")) return "Album — Musiku";
  if (pathname.startsWith("/artist/")) return "Artis — Musiku";
  if (pathname.startsWith("/playlist/")) return "Playlist — Musiku";
  if (pathname.startsWith("/ytm-playlist/")) return "Playlist — Musiku";
  return "Musiku";
}

function useRoute(onOpenCoverFlow) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    document.title = pageTitle(pathname);
  }, [pathname]);

  let m;
  if (pathname === "/" || pathname === "") return { page: <HomePage />, hasHero: false };
  if (pathname.startsWith("/search")) return { page: <DesktopSearchPage />, hasHero: false };
  if (pathname.startsWith("/settings")) return { page: <DesktopSettingsPage />, hasHero: false };
  if (pathname.startsWith("/profile")) return { page: <DesktopProfilePage />, hasHero: false };
  if (pathname.startsWith("/liked")) {
    return {
      page: (
        <DesktopLibraryPage
          initialTab="albums"
          onOpenCoverFlow={onOpenCoverFlow}
        />
      ),
      hasHero: false,
    };
  }
  if ((m = pathname.match(/^\/pustaka(?:\/([^/]+))?$/))) {
    const raw = (m[1] || "").toLowerCase();
    const mapped =
      raw === "lagu" || raw === "songs"
        ? "songs"
        : raw === "playlist" || raw === "playlists"
          ? "playlists"
          : raw === "artis" || raw === "artists"
            ? "artists"
            : "albums";
    return {
      page: (
        <DesktopLibraryPage
          initialTab={mapped}
          onOpenCoverFlow={onOpenCoverFlow}
        />
      ),
      hasHero: false,
    };
  }
  if (pathname.startsWith("/explore")) return { page: <ExplorePage />, hasHero: false };
  if (pathname.startsWith("/radio")) return { page: <RadioPage />, hasHero: false };
  if ((m = pathname.match(/^\/album\/(.+)$/))) {
    return { page: <AlbumPage id={decodeURIComponent(m[1])} />, hasHero: false };
  }
  if ((m = pathname.match(/^\/artist\/(.+)$/))) {
    return { page: <ArtistPage id={decodeURIComponent(m[1])} />, hasHero: false };
  }
  if ((m = pathname.match(/^\/playlist\/(.+)$/))) {
    return { page: <DesktopPlaylistView id={decodeURIComponent(m[1])} />, hasHero: false };
  }
  if ((m = pathname.match(/^\/ytm-playlist\/(.+)$/))) {
    return { page: <DesktopYtmPlaylistView id={decodeURIComponent(m[1])} />, hasHero: false };
  }
  void searchParams;
  return {
    page: <Centered title="Halaman tidak ditemukan" sub="Tautan mungkin salah." />,
    hasHero: false,
  };
}

function Shell() {
  const [immersiveOpen, setImmersiveOpen] = useState(false);
  const [coverFlowOpen, setCoverFlowOpen] = useState(false);
  const openCoverFlow = useCallback(() => setCoverFlowOpen(true), []);
  const pathname = usePathname() || "/";
  const { page, hasHero } = useRoute(openCoverFlow);
  const router = useRouter();
  const player = usePlayer();
  const isSubPage = /^\/(album|artist|playlist|ytm-playlist|settings|profile)(\/|$)/.test(
    pathname,
  );

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window === "undefined" || window.matchMedia("(min-width: 1024px)").matches,
  );
  const [rightOpen, setRightOpen] = useState(false);
  const [rightMode, setRightMode] = useState("queue");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      setIsDesktop(mq.matches);
      if (mq.matches) setMobileNavOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Sinkronkan toggleUi("queue" | "lyrics") dari komponen web ke panel kanan desktop.
  useEffect(() => {
    if (player.ui === "queue" || player.ui === "lyrics") {
      setRightMode(player.ui);
      setRightOpen(true);
    }
  }, [player.ui]);

  const handleToggleRight = useCallback(
    (targetMode) => {
      if (!targetMode) {
        setRightOpen((o) => !o);
        return;
      }
      if (rightOpen && rightMode === targetMode) {
        setRightOpen(false);
      } else {
        setRightMode(targetMode);
        setRightOpen(true);
      }
    },
    [rightOpen, rightMode],
  );

  return (
    <div className="ds-shell force-dark">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-[#f7f7f8] focus:px-4 focus:py-2 focus:text-[14px] focus:font-semibold focus:text-[#0b0b0d]"
      >
        Lompat ke konten
      </a>

      <DesktopSidebar
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="ds-center">
        <header className="ypm-topbar" aria-label="Kontrol navigasi kanvas">
          <div className="ypm-topbar-left">
            <button
              type="button"
              className="ypm-mobile-menu-btn"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-expanded={mobileNavOpen}
              aria-label="Buka navigasi"
              title="Menu"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                className="h-[18px] w-[18px]"
                aria-hidden="true"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>

            {isSubPage && (
              <div className="ypm-nav-pair">
                <button
                  type="button"
                  className="ypm-back-pill"
                  onClick={() => router.back()}
                  aria-label="Kembali ke halaman sebelumnya"
                  title="Kembali"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="M19 12H5" />
                    <path d="M12 19l-7-7 7-7" />
                  </svg>
                  <span>Kembali</span>
                </button>
                <button
                  type="button"
                  className="ypm-nav-circle"
                  onClick={() => router.forward()}
                  aria-label="Maju ke halaman berikutnya"
                  title="Maju"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14" />
                    <path d="M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          <div className="ypm-topbar-right">
            <div className="ypm-panel-seg" role="group" aria-label="Panel samping">
              <button
                type="button"
                className="ypm-panel-seg-btn"
                onClick={() => handleToggleRight("lyrics")}
                data-active={rightOpen && rightMode === "lyrics" ? "1" : undefined}
                aria-pressed={rightOpen && rightMode === "lyrics"}
                aria-label="Panel lirik"
                title="Lirik (Y)"
              >
                <IconLyrics className="h-[15px] w-[15px]" />
                <span>Lirik</span>
              </button>
              <button
                type="button"
                className="ypm-panel-seg-btn"
                onClick={() => handleToggleRight("queue")}
                data-active={rightOpen && rightMode === "queue" ? "1" : undefined}
                aria-pressed={rightOpen && rightMode === "queue"}
                aria-label="Panel antrean"
                title="Antrean (Q)"
              >
                <IconQueue className="h-[15px] w-[15px]" />
                <span>Antrean</span>
              </button>
            </div>
          </div>
        </header>

        <main
          id="main"
          tabIndex={-1}
          className="page-scroll ds-scroll"
          data-hero={hasHero ? "1" : undefined}
          data-has-player={player.current ? "1" : "0"}
        >
          <Suspense
            fallback={
              <div className="px-5 py-24 text-center text-[15px] text-label2">Memuat…</div>
            }
          >
            <PageFade>{page}</PageFade>
          </Suspense>
        </main>

        <DesktopPlayerBar
          rightOpen={rightOpen}
          onToggleRight={handleToggleRight}
          onOpenImmersive={() => setImmersiveOpen(true)}
          onOpenCoverFlow={() => setCoverFlowOpen(true)}
          overlaysOpen={immersiveOpen || coverFlowOpen}
        />
      </div>

      <DesktopRightPanel
        open={rightOpen}
        mode={rightMode}
        onChangeMode={setRightMode}
        onClose={() => setRightOpen(false)}
        onOpenImmersive={() => setImmersiveOpen(true)}
        isMobile={!isDesktop}
      />

      {immersiveOpen && player.current && (
        <ImmersiveLyrics onExit={() => setImmersiveOpen(false)} />
      )}
      {coverFlowOpen && (
        <CoverFlow onExit={() => setCoverFlowOpen(false)} />
      )}

      <Toaster />
      <EdgeSwipeBack />
    </div>
  );
}

function PlayerWithCloud() {
  const { playerEpoch } = useAccount();
  // Overscroll "rubber band" ala Apple untuk semua container scroll.
  useEffect(() => {
    initAccentTheme();
    return initElasticScroll();
  }, []);
  return (
    <PlayerProvider key={playerEpoch}>
      <CloudSyncBridge />
      <DiscordPresence />
      <Shell />
    </PlayerProvider>
  );
}

function App() {
  return (
    <CloudAccountProvider>
      <PlayerWithCloud />
    </CloudAccountProvider>
  );
}

// Hangatkan tiga endpoint beranda sebelum React selesai mount. Server sudah
// mendebup request yang sama (moka try_get_with), jadi ini tidak menambah
// fetch upstream — hanya menggeser semuanya ke awal.
void cachedGet("/api/home");
void cachedGet("/api/moods");
void cachedGet("/api/artists/charts");

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#0b0a0b] p-6 text-[#f6efe9]">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#1a1819] p-6 shadow-2xl">
            <h1 className="text-[17px] font-bold">Terjadi kesalahan antarmuka</h1>
            <p className="mt-2 break-words text-[13px] text-[#b5aeaa]">
              {String(this.state.error?.message || this.state.error)}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 cursor-pointer rounded-xl bg-[#e3a28c] px-4 py-2 text-[13px] font-bold text-[#151010] hover:bg-[#edb39f]"
            >
              Muat Ulang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const el = document.getElementById("root");
// Lirik mengambang (jendela `?overlay=lyrics` + LyricsBridge) dinonaktifkan:
// masih ada bug, dan jendelanya tidak lagi dibuat sama sekali.
createRoot(el).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
