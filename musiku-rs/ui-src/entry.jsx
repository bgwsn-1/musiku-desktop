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
import { HomeFeed } from "@/components/HomeFeed";
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
import { DesktopAlbumPage } from "./desktop/DesktopAlbumPage.jsx";
import { DesktopArtistPage } from "./desktop/DesktopArtistPage.jsx";
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

// ── Halaman beranda (port dari src/app/page.tsx) ─────────────────────────
function HomePage() {
  const shelves = useHomeShelves();

  if (shelves === null) return <LoadingPage title="Beranda" />;

  return <HomeFeed shelves={shelves} />;
}

// ── Halaman album desktop full-bleed ─────────────────────────────────────
function AlbumPage({ id }) {
  return <DesktopAlbumPage id={id} />;
}

// ── Halaman artis desktop full-bleed ─────────────────────────────────────
function ArtistPage({ id }) {
  return <DesktopArtistPage id={id} />;
}

// ── Explore (port dari src/app/explore/page.tsx) ─────────────────────────
function ExplorePage() {
  const shelves = useHomeShelves();
  if (shelves === null)
    return <LoadingPage title="Explore" sub="Album dan lagu pilihan dari katalog Musiku." />;

  const items = shelves.flatMap((s) => (s.items ? s.items : []));
  const uniqueBy = (arr, key) => {
    const seen = new Set();
    return arr.filter((it) => {
      const id = key(it);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };
  const artists = uniqueBy(items.filter((it) => it.kind === "artist"), (it) => it.browseId);
  const albums = uniqueBy(items.filter((it) => it.kind === "album"), (it) => it.browseId);
  const songs = uniqueBy(items.filter((it) => it.videoId), (it) => it.videoId).slice(0, 24);
  const songTracks = songs.map(toTrack).filter(Boolean);
  const lead = shelves[0];

  return (
    <div>
      <header className="mb-5">
        <h1 className="t-large">Explore</h1>
        <p className="mt-1 text-[15px] text-label2">Album dan lagu pilihan dari katalog Musiku.</p>
      </header>

      {lead && lead.items.length > 0 && <FeaturedCarousel items={lead.items.slice(0, 6)} />}

      {artists.length > 0 && (
        <Shelf title="Artis populer" layout="grid">
          {artists.slice(0, 24).map((it, i) => (
            <GridCard
              key={`ar-${i}-${it.browseId}`}
              i={i}
              title={it.title}
              subtitle={it.artist}
              href={`/artist/${it.browseId}`}
              img={it.thumbs}
              round
            />
          ))}
        </Shelf>
      )}

      {albums.length > 0 && (
        <Shelf title="Album pilihan" layout="grid">
          {albums.slice(0, 24).map((it, i) => (
            <GridCard
              key={`al-${i}-${it.browseId}`}
              i={i}
              title={it.title}
              subtitle={it.artist}
              href={`/album/${it.browseId}`}
              img={it.thumbs}
            />
          ))}
        </Shelf>
      )}

      {songTracks.length > 0 && (
        <Shelf title="Lagu untuk mulai" layout="grid">
          {songs.map((it, i) => {
            const track = toTrack(it);
            if (!track) return null;
            return (
              <GridCard
                key={`song-${i}-${track.videoId}`}
                i={i}
                title={track.title}
                subtitle={track.artist}
                img={track.thumbs}
                track={track}
                queue={songTracks}
              />
            );
          })}
        </Shelf>
      )}

      {!items.length && <Centered title="Explore belum bisa dimuat" sub="Cek koneksi, lalu muat ulang." />}
    </div>
  );
}

// ── Radio (port dari src/app/radio/page.tsx) ─────────────────────────────
function RadioPage() {
  const shelves = useHomeShelves();
  if (shelves === null)
    return <LoadingPage title="Radio" sub="Stasiun mix dari katalog dan favorit lokalmu." />;

  const seen = new Set();
  const tracks = shelves
    .flatMap((s) => (s.items ? s.items : []))
    .map(toTrack)
    .filter((t) => {
      if (!t || seen.has(t.videoId)) return false;
      seen.add(t.videoId);
      return true;
    });

  return (
    <div>
      <header className="mb-5">
        <h1 className="t-large">Radio</h1>
        <p className="mt-1 text-[15px] text-label2">Stasiun mix dari katalog dan favorit lokalmu.</p>
      </header>

      <RadioStations tracks={tracks} />

      <p className="mt-8 text-[13px] leading-relaxed text-label3">
        Stasiun menyusun antrean lagu dari perangkat ini, bukan siaran internet.
      </p>
    </div>
  );
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

function useRoute() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    document.title = pageTitle(pathname);
  }, [pathname]);

  let m;
  if (pathname === "/" || pathname === "") return { page: <HomePage />, hasHero: false };
  if (pathname.startsWith("/search")) return { page: <SearchPage />, hasHero: false };
  if (pathname.startsWith("/liked")) return { page: <LikedPage />, hasHero: false };
  if ((m = pathname.match(/^\/pustaka(?:\/([^/]+))?$/))) {
    return {
      page: m[1] ? <PustakaSection section={decodeURIComponent(m[1])} /> : <LikedPage />,
      hasHero: false,
    };
  }
  if (pathname.startsWith("/explore")) return { page: <ExplorePage />, hasHero: false };
  if (pathname.startsWith("/radio")) return { page: <RadioPage />, hasHero: false };
  if ((m = pathname.match(/^\/album\/(.+)$/))) {
    return { page: <AlbumPage id={decodeURIComponent(m[1])} />, hasHero: true };
  }
  if ((m = pathname.match(/^\/artist\/(.+)$/))) {
    return { page: <ArtistPage id={decodeURIComponent(m[1])} />, hasHero: true };
  }
  if ((m = pathname.match(/^\/playlist\/(.+)$/))) {
    return { page: <PlaylistView id={decodeURIComponent(m[1])} />, hasHero: false };
  }
  if ((m = pathname.match(/^\/ytm-playlist\/(.+)$/))) {
    return { page: <YtmPlaylistView id={decodeURIComponent(m[1])} />, hasHero: false };
  }
  void searchParams;
  return {
    page: <Centered title="Halaman tidak ditemukan" sub="Tautan mungkin salah." />,
    hasHero: false,
  };
}

function readSidebarCollapsed() {
  try {
    return window.localStorage.getItem("musiku:sidebar-collapsed") === "1";
  } catch {
    return false;
  }
}

function Shell() {
  const { page, hasHero } = useRoute();
  const router = useRouter();
  const player = usePlayer();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window === "undefined" || window.matchMedia("(min-width: 1024px)").matches,
  );
  const [rightOpen, setRightOpen] = useState(
    () => typeof window === "undefined" || window.matchMedia("(min-width: 1180px)").matches,
  );
  const [rightMode, setRightMode] = useState("queue");
  const [immersiveOpen, setImmersiveOpen] = useState(false);
  const [coverFlowOpen, setCoverFlowOpen] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem("musiku:sidebar-collapsed", sidebarCollapsed ? "1" : "0");
    } catch {}
  }, [sidebarCollapsed]);

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

  const handleToggleSidebar = useCallback(() => {
    if (isDesktop) {
      setSidebarCollapsed((v) => !v);
    } else {
      setMobileNavOpen((v) => !v);
    }
  }, [isDesktop]);

  return (
    <div className="ds-shell force-dark">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-[#f6efe9] focus:px-4 focus:py-2 focus:text-[14px] focus:font-semibold focus:text-[#111011]"
      >
        Lompat ke konten
      </a>

      <DesktopSidebar
        collapsed={sidebarCollapsed}
        onExpandForSearch={() => setSidebarCollapsed(false)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="ds-center">
        <header className="ds-top-bar" aria-label="Kontrol navigasi kanvas">
          <div className="ds-top-group">
            <button
              type="button"
              className="ds-top-btn"
              onClick={handleToggleSidebar}
              aria-expanded={isDesktop ? !sidebarCollapsed : mobileNavOpen}
              aria-label={isDesktop ? "Ciutkan atau lebarkan sidebar" : "Buka navigasi"}
              title="Toggle sidebar"
            >
              <IconSidebar
                className={`h-4 w-4 transition-transform ${sidebarCollapsed && isDesktop ? "rotate-180" : ""}`}
              />
            </button>
            <button
              type="button"
              className="ds-top-btn"
              onClick={() => router.back()}
              aria-label="Halaman sebelumnya"
              title="Kembali"
            >
              <IconBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="ds-top-btn"
              onClick={() => router.forward()}
              aria-label="Halaman berikutnya"
              title="Maju"
            >
              <IconForward className="h-4 w-4" />
            </button>
          </div>

          <div className="ds-top-group">
            {player.current && (
              <>
                <button
                  type="button"
                  className="ds-top-btn hidden lg:inline-flex"
                  onClick={() => setCoverFlowOpen(true)}
                  aria-label="Buka Cover Flow"
                  title="Cover Flow"
                >
                  <IconDisc className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="ds-top-btn hidden lg:inline-flex"
                  onClick={() => setImmersiveOpen(true)}
                  aria-label="Buka mode lirik imersif"
                  title="Mode Imersif (F)"
                >
                  <IconExpand className="h-4 w-4" />
                </button>
              </>
            )}
            <button
              type="button"
              className="ds-top-btn"
              onClick={() => handleToggleRight("lyrics")}
              data-active={rightOpen && rightMode === "lyrics" ? "1" : undefined}
              aria-pressed={rightOpen && rightMode === "lyrics"}
              aria-label="Panel lirik"
              title="Lirik (Y)"
            >
              <IconLyrics className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="ds-top-btn"
              onClick={() => handleToggleRight("queue")}
              data-active={rightOpen && rightMode === "queue" ? "1" : undefined}
              aria-pressed={rightOpen && rightMode === "queue"}
              aria-label="Panel antrean"
              title="Antrean (Q)"
            >
              <IconQueue className="h-4 w-4" />
            </button>
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
      {coverFlowOpen && player.current && (
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
  useEffect(() => initElasticScroll(), []);
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
