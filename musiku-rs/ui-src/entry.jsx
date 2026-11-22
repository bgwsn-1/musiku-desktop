// Entry bundle UI Musiku (Rust server / Tauri).
//
// Shell-nya meniru `src/app/layout.tsx`; halaman-halaman yang di web adalah
// server component (home / album / artist) ditulis ulang di sini sebagai
// komponen klien yang memanggil `/api/*` — bentuk data & tampilan tetap sama
// karena komponen presentasinya diimpor langsung dari web app.
import { createRoot } from "react-dom/client";
import { StrictMode, Suspense, useEffect, useState } from "react";

import { PlayerProvider, usePlayer } from "@/lib/player";
import { MobileTabs, Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { PlayerBar } from "@/components/PlayerBar";
import { RightPanel } from "@/components/RightPanel";
import { PageFade } from "@/components/PageFade";
import { Toaster } from "@/components/Toast";
import { EdgeSwipeBack } from "@/components/EdgeSwipeBack";
import { GridCard, Shelf } from "@/components/GridCard";
import { FeaturedCarousel, SongColumns } from "@/components/HomeFeatured";
import { RecentShelf } from "@/components/RecentShelf";
import { RadioStations } from "@/components/RadioStations";
import { TrackRow } from "@/components/TrackRow";
import { PlayAllButton, ShuffleButton } from "@/components/PlayAllButton";
import { MediaArt, MediaHeader } from "@/components/MediaHeader";
import { ArtistHeader } from "@/components/ArtistHeader";
import { IconSearch } from "@/components/Icons";
import { usePathname, useSearchParams } from "next/navigation";

import SearchPage from "@/app/search/page";
import LikedPage from "@/app/liked/page";
import { PustakaSection } from "@/components/PustakaSection";
import { PlaylistView } from "@/components/PlaylistView";
import DiscordPresence from "./desktop/DiscordPresence.jsx";
import LyricsBridge from "./desktop/LyricsBridge.jsx";
import LyricsOverlay from "./desktop/LyricsOverlay.jsx";
import { initElasticScroll } from "./elastic-scroll.js";

// ── helper kecil ─────────────────────────────────────────────────────────
async function jget(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
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
    jget("/api/home")
      .then((s) => live && setShelves(Array.isArray(s) ? s : []))
      .catch(() => live && setShelves([]));
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

  const lead = shelves[0];
  const songsIdx = shelves.findIndex(
    (s, i) => i > 0 && s.items.filter((x) => x.videoId).length >= 3,
  );
  const songs = songsIdx > 0 ? shelves[songsIdx] : undefined;
  const rest = shelves.filter((_, i) => i !== 0 && i !== songsIdx);

  return (
    <div>
      <header className="mb-5">
        <h1 className="t-large">Beranda</h1>
      </header>
      {lead && lead.items.length > 0 && (
        <FeaturedCarousel items={lead.items.slice(0, 6)} />
      )}
      {songs && (
        <SongColumns title={songs.title || "Lagu Terbaru"} items={songs.items.slice(0, 12)} />
      )}
      <RecentShelf />
      {rest.map((sh, si) => (
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
            const track = it.videoId
              ? {
                  videoId: it.videoId,
                  title: it.title,
                  artist: it.artist,
                  artistId: it.artistId,
                  thumbs: it.thumbs,
                }
              : undefined;
            return (
              <GridCard
                key={`s${i}-${it.videoId ?? i}`}
                i={i}
                title={it.title}
                subtitle={it.artist}
                href={it.kind === "album" && it.browseId ? `/album/${it.browseId}` : undefined}
                img={it.thumbs}
                track={track}
              />
            );
          })}
        </Shelf>
      ))}
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

// ── Halaman album (port dari src/app/album/[id]/page.tsx) ────────────────
function AlbumPage({ id }) {
  const [album, setAlbum] = useState(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let live = true;
    setAlbum(null);
    setMissing(false);
    jget(`/api/album/${encodeURIComponent(id)}`)
      .then((a) => live && setAlbum(a))
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [id]);

  if (missing) return <Centered title="Album tidak ditemukan" sub="Mungkin sudah dihapus atau tautannya salah." />;
  if (!album) {
    return (
      <div className="animate-pulse space-y-2 py-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-fill1" />
        ))}
      </div>
    );
  }
  if (!album.title) return <Centered title="Album tidak ditemukan" sub="Mungkin sudah dihapus atau tautannya salah." />;

  const artistName = Array.isArray(album.artist) ? album.artist[0] : album.artist;
  const facts = [album.year, album.duration, album.tracks.length ? `${album.tracks.length} lagu` : null].filter(Boolean);

  return (
    <div>
      <MediaHeader
        kind="Album"
        title={album.title}
        backdrop={album.thumbs}
        art={<MediaArt src={album.thumbs} alt={`Sampul ${album.title}`} />}
        meta={
          <>
            {artistName &&
              (album.artistId ? (
                <a href={`/artist/${album.artistId}`} className="font-semibold text-label1 hover:underline">
                  {artistName}
                </a>
              ) : (
                <span className="font-semibold text-label1">{artistName}</span>
              ))}
            {artistName && facts.length > 0 && " · "}
            {facts.join(" · ")}
          </>
        }
        actions={
          <>
            <PlayAllButton tracks={album.tracks} />
            <ShuffleButton tracks={album.tracks} />
          </>
        }
      />
      <section className="mt-10" aria-label="Daftar lagu">
        {album.tracks.map((t, i) => (
          <TrackRow
            key={`${t.videoId}-${i}`}
            track={{ ...t, album: t.album || album.title, albumId: album.browseId }}
            queue={album.tracks}
            index={i}
          />
        ))}
      </section>
    </div>
  );
}

// ── Halaman artis (port dari src/app/artist/[id]/page.tsx) ───────────────
function descSnippet(d) {
  return d.length > 700 ? d.slice(0, 700).trimEnd() + "…" : d;
}

function ArtistPage({ id }) {
  const [artist, setArtist] = useState(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let live = true;
    setArtist(null);
    setMissing(false);
    jget(`/api/artist/${encodeURIComponent(id)}`)
      .then((a) => live && setArtist(a))
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [id]);

  if (missing) return <Centered title="Artis tidak ditemukan" sub="Mungkin sudah dihapus atau tautannya salah." />;
  if (!artist) {
    return (
      <div className="animate-pulse space-y-2 py-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-fill1" />
        ))}
      </div>
    );
  }
  if (!artist.name) return <Centered title="Artis tidak ditemukan" sub="Mungkin sudah dihapus atau tautannya salah." />;

  return (
    <div>
      <ArtistHeader
        name={artist.name}
        image={artist.banner ?? artist.thumbs}
        avatar={artist.avatar ?? artist.thumbs}
        videoId={artist.topVideoId}
        followers={artist.subscribers}
        monthly={artist.monthlyListeners}
        actions={
          <>
            <PlayAllButton tracks={artist.topSongs} />
            <ShuffleButton tracks={artist.topSongs} />
          </>
        }
      />

      {artist.topSongs.length > 0 && (
        <section className="mt-10" aria-label="Populer">
          <h2 className="t-title mb-2 text-label1">Populer</h2>
          {artist.topSongs.map((t, i) => (
            <TrackRow key={`${t.videoId}-${i}`} track={t} queue={artist.topSongs} index={i} showAlbum={false} />
          ))}
        </section>
      )}

      {artist.albums.length > 0 && (
        <div className="mt-12">
          <Shelf title="Album">
            {artist.albums.map((a, i) => (
              <GridCard key={`a${i}-${a.browseId}`} i={i} title={a.title} subtitle={a.year ?? undefined} href={a.browseId ? `/album/${a.browseId}` : undefined} img={a.thumbs} />
            ))}
          </Shelf>
        </div>
      )}

      {artist.singles.length > 0 && (
        <Shelf title="Single & EP">
          {artist.singles.map((a, i) => (
            <GridCard key={`s${i}-${a.browseId}`} i={i} title={a.title} subtitle={a.year ?? undefined} href={a.browseId ? `/album/${a.browseId}` : undefined} img={a.thumbs} />
          ))}
        </Shelf>
      )}

      {artist.desc && (
        <section className="mt-2" aria-label="Tentang">
          <h2 className="t-title mb-2 text-label1">Tentang</h2>
          <p className="max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-label2">
            {descSnippet(artist.desc)}
          </p>
        </section>
      )}
    </div>
  );
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
  return "Musiku";
}

function useRoute() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    document.title = pageTitle(pathname);
  }, [pathname]);

  let m;
  if (pathname === "/" || pathname === "") return { page: <HomePage /> };
  if (pathname.startsWith("/search")) return { page: <SearchPage /> };
  if (pathname.startsWith("/liked")) return { page: <LikedPage /> };
  if ((m = pathname.match(/^\/pustaka(?:\/([^/]+))?$/))) {
    return m[1]
      ? { page: <PustakaSection section={decodeURIComponent(m[1])} /> }
      : { page: <LikedPage /> };
  }
  if (pathname.startsWith("/explore")) return { page: <ExplorePage /> };
  if (pathname.startsWith("/radio")) return { page: <RadioPage /> };
  if ((m = pathname.match(/^\/album\/(.+)$/))) return { page: <AlbumPage id={decodeURIComponent(m[1])} /> };
  if ((m = pathname.match(/^\/artist\/(.+)$/))) return { page: <ArtistPage id={decodeURIComponent(m[1])} /> };
  if ((m = pathname.match(/^\/playlist\/(.+)$/))) return { page: <PlaylistView id={decodeURIComponent(m[1])} /> };
  void searchParams;
  return { page: <Centered title="Halaman tidak ditemukan" sub="Tautan mungkin salah." /> };
}

function Shell() {
  const { page } = useRoute();
  return (
    <div className="shell relative h-dvh overflow-hidden">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-surface focus:px-4 focus:py-2 focus:text-[14px] focus:font-semibold focus:text-label1"
      >
        Lompat ke konten
      </a>
      <main id="main" tabIndex={-1} className="page-scroll absolute inset-0 z-10 overflow-y-auto outline-none">
        <Suspense
          fallback={
            <div className="px-5 py-24 text-center text-[15px] text-label2">Memuat…</div>
          }
        >
          <PageFade>{page}</PageFade>
        </Suspense>
      </main>
      <div className="scroll-edge scroll-edge-top" aria-hidden="true" />
      <div className="scroll-edge scroll-edge-bottom" aria-hidden="true" />
      <TopBar />
      <Sidebar />
      <PlayerBar />
      <RightPanel />
      <MobileTabs />
      <Toaster />
      <EdgeSwipeBack />
    </div>
  );
}

function App() {
  // Overscroll "rubber band" ala Apple untuk semua container scroll.
  useEffect(() => initElasticScroll(), []);
  return (
    <PlayerProvider>
      <DiscordPresence />
      <LyricsBridge />
      <Shell />
    </PlayerProvider>
  );
}

const el = document.getElementById("root");
const isLyricsOverlay =
  new URLSearchParams(window.location.search).get("overlay") === "lyrics";
createRoot(el).render(
  <StrictMode>{isLyricsOverlay ? <LyricsOverlay /> : <App />}</StrictMode>,
);
