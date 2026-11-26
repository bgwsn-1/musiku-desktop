// Halaman Profil Akun desktop 1:1 mengikuti YesPlayMusic (lib/pages/profile.dart):
// - Header avatar bulat 120px + nama ArchivoWide 44px + badge Cloud Sync & fakta pustaka
// - Deretan kartu statistik berwarna (Wine, Amber, Sky Artis Teratas, Violet)
// - 2 kolom bawah: Lagu Terakhir Diputar / Disukai di kiri + Playlist Kamu di kanan
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePlayer } from "@/lib/player";
import { toast } from "@/components/Toast";
import {
  IconHeart,
  IconMusic,
  IconPause,
  IconPlay,
  IconUser,
} from "@/components/Icons";
import { useAccount } from "./CloudAccountContext.jsx";
import { AccountModal } from "./AccountModal.jsx";

function artistOf(t) {
  if (Array.isArray(t.artists)) return t.artists.filter(Boolean).join(", ");
  return t.artists || t.artist || "Artis tidak diketahui";
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString("en-US");
}

export function DesktopProfilePage() {
  const router = useRouter();
  const account = useAccount();
  const {
    liked = [],
    playlists = [],
    recent = [],
    current,
    playing,
    playTracks,
    toggle,
    isLiked,
    toggleLike,
  } = usePlayer();
  const [accountOpen, setAccountOpen] = useState(false);

  const displayName =
    account.displayName ||
    (account.user?.email ? account.user.email.split("@")[0] : "Pendengar Musiku");
  const initial = displayName.trim().charAt(0).toUpperCase() || "M";

  // Hitung artis teratas dari lagu nyata di pustaka & riwayat
  const topArtist = useMemo(() => {
    const map = new Map();
    const all = [
      ...liked,
      ...recent,
      ...playlists.flatMap((pl) => pl.tracks || []),
    ];
    for (const t of all) {
      if (!t) continue;
      const name = artistOf(t).split(",")[0].trim();
      if (!name || name === "Artis tidak diketahui") continue;
      const key = t.artistId || name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          name,
          artistId: t.artistId || null,
          thumb: t.thumbs || t.thumb || null,
          count: 1,
        });
      } else {
        const entry = map.get(key);
        entry.count += 1;
        if (!entry.artistId && t.artistId) entry.artistId = t.artistId;
        if (!entry.thumb && (t.thumbs || t.thumb)) {
          entry.thumb = t.thumbs || t.thumb;
        }
      }
    }
    const sorted = [...map.values()].sort((a, b) => b.count - a.count);
    return sorted[0] || null;
  }, [liked, recent, playlists]);

  const topTracks = useMemo(() => {
    const src = recent.length > 0 ? recent : liked;
    return src.slice(0, 8);
  }, [recent, liked]);

  return (
    <div className="ypm-prof">
      {/* Header Profil */}
      <header className="ypm-prof-head">
        <div className="ypm-prof-avatar" aria-hidden="true">
          {account.user ? initial : <IconUser className="h-12 w-12" />}
        </div>

        <div className="ypm-prof-id">
          <h1 className="ypm-prof-name">{displayName}</h1>
          <div className="ypm-prof-badges">
            <span
              className={`ypm-prof-badge ${account.user ? "is-accent" : ""}`}
            >
              {account.user
                ? account.syncStatus === "synced"
                  ? "Cloud Sync Aktif"
                  : "Terhubung"
                : "Mode Lokal"}
            </span>
            <span className="ypm-prof-fact">
              Disukai <strong>{fmtNum(liked.length)}</strong>
            </span>
            <span className="ypm-prof-fact">
              Playlist <strong>{fmtNum(playlists.length)}</strong>
            </span>
            <span className="ypm-prof-fact">
              Riwayat <strong>{fmtNum(recent.length)}</strong>
            </span>
          </div>
          {account.user?.email && (
            <p className="ypm-prof-email">{account.user.email}</p>
          )}
        </div>

        <div className="ypm-prof-actions">
          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            className="ypm-pill ypm-pill-primary ypm-pill-sm"
          >
            {account.user ? "Kelola Akun" : "Masuk / Sinkronkan"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/settings")}
            className="ypm-pill ypm-pill-ghost ypm-pill-sm"
          >
            Pengaturan
          </button>
        </div>
      </header>

      {/* Kartu Statistik Berwarna 1:1 YesPlayMusic (_Stats) */}
      <section className="ypm-prof-stats" aria-label="Ringkasan pustaka">
        <Link
          href="/pustaka/lagu"
          className="ypm-stat-card"
          style={{ backgroundColor: "#7b1d2e", color: "#ffffff" }}
        >
          <span className="ypm-stat-label">Lagu Disukai</span>
          <div className="ypm-stat-num-row">
            <span className="ypm-stat-num">{fmtNum(liked.length)}</span>
            <span className="ypm-stat-unit">lagu</span>
          </div>
        </Link>

        <Link
          href="/pustaka/playlist"
          className="ypm-stat-card"
          style={{ backgroundColor: "#f6b73c", color: "#0b0b0d" }}
        >
          <span className="ypm-stat-label">Playlist Lokal</span>
          <div className="ypm-stat-num-row">
            <span className="ypm-stat-num">{fmtNum(playlists.length)}</span>
            <span className="ypm-stat-unit">daftar</span>
          </div>
        </Link>

        {topArtist ? (
          <Link
            href={
              topArtist.artistId
                ? `/artist/${encodeURIComponent(topArtist.artistId)}`
                : `/search?q=${encodeURIComponent(topArtist.name)}`
            }
            className="ypm-stat-card ypm-stat-wide"
            style={{ backgroundColor: "#b8cedd", color: "#0b0b0d" }}
          >
            <div className="ypm-stat-artist-left">
              <span className="ypm-stat-label">Artis Teratas</span>
              <span className="ypm-stat-artist-name">{topArtist.name}</span>
              <span className="ypm-stat-artist-sub">
                {topArtist.count} lagu di pustakamu
              </span>
            </div>
            <div className="ypm-stat-artist-img">
              {topArtist.thumb ? (
                <img src={topArtist.thumb} alt={topArtist.name} />
              ) : (
                <IconMusic className="h-9 w-9 opacity-40" />
              )}
            </div>
          </Link>
        ) : (
          <Link
            href="/pustaka/album"
            className="ypm-stat-card ypm-stat-wide"
            style={{ backgroundColor: "#b8cedd", color: "#0b0b0d" }}
          >
            <span className="ypm-stat-label">Rak Album</span>
            <span className="ypm-stat-artist-name">Record Shelf</span>
            <span className="ypm-stat-artist-sub">
              Jelajahi koleksi piringanmu
            </span>
          </Link>
        )}

        <Link
          href="/pustaka/lagu"
          className="ypm-stat-card"
          style={{ backgroundColor: "#6a3fb5", color: "#ffffff" }}
        >
          <span className="ypm-stat-label">Baru Diputar</span>
          <div className="ypm-stat-num-row">
            <span className="ypm-stat-num">{fmtNum(recent.length)}</span>
            <span className="ypm-stat-unit">trek</span>
          </div>
        </Link>
      </section>

      {/* 2 Kolom Bawah: Lagu Terakhir Diputar + Playlist Kamu */}
      <div className="ypm-prof-cols">
        <section className="ypm-prof-col-main">
          <div className="ypm-sec-head">
            <h2 className="ypm-sec-title">
              {recent.length > 0 ? "Terakhir Diputar" : "Lagu Disukai"}
            </h2>
            {topTracks.length > 0 && (
              <button
                type="button"
                onClick={() => playTracks(topTracks, 0)}
                className="ypm-toggle-pill"
              >
                Putar Semua
              </button>
            )}
          </div>

          {topTracks.length === 0 ? (
            <div className="ypm-set-card" style={{ padding: 24 }}>
              <p className="ypm-set-desc" style={{ margin: 0 }}>
                Belum ada riwayat pemutaran. Mulai putar lagu dari Beranda atau Pencarian.
              </p>
            </div>
          ) : (
            <div className="ypm-hot-list">
              {topTracks.map((t, i) => {
                const isActive = current?.videoId === t.videoId;
                const isPlayingNow = isActive && playing;
                const likedNow = isLiked?.(t.videoId);
                const thumb = t.thumbs || t.thumb || null;
                return (
                  <div
                    key={`${t.videoId}-${i}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (isActive) toggle();
                      else playTracks(topTracks, i);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (isActive) toggle();
                        else playTracks(topTracks, i);
                      }
                    }}
                    className={`ypm-hot-row ${isActive ? "is-active" : ""}`}
                  >
                    <span className="ypm-hot-num">{i + 1}</span>
                    <div className="ypm-hot-thumb-wrap">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt=""
                          className="ypm-hot-thumb"
                          loading="lazy"
                        />
                      ) : (
                        <div className="ypm-hot-thumb ypm-hot-thumb-fb">
                          <IconMusic className="h-4 w-4" />
                        </div>
                      )}
                      <span className="ypm-hot-thumb-play" aria-hidden="true">
                        {isPlayingNow ? (
                          <IconPause className="h-3.5 w-3.5" />
                        ) : (
                          <IconPlay className="h-3.5 w-3.5" />
                        )}
                      </span>
                    </div>
                    <div className="ypm-hot-info">
                      <p className="ypm-hot-title">{t.title}</p>
                      <p className="ypm-hot-sub">{artistOf(t)}</p>
                    </div>
                    {t.duration && (
                      <span className="ypm-hot-dur">{t.duration}</span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLike?.(t);
                      }}
                      aria-label={likedNow ? "Hapus dari disukai" : "Sukai"}
                      className={`ypm-hot-like ${likedNow ? "is-liked" : ""}`}
                    >
                      <IconHeart className="h-4 w-4" filled={likedNow} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="ypm-prof-col-side">
          <div className="ypm-sec-head">
            <h2 className="ypm-sec-title">Playlist Kamu</h2>
            <Link
              href="/pustaka/playlist"
              className="ypm-search-sec-act"
              style={{ textDecoration: "none" }}
            >
              Semua
            </Link>
          </div>

          {playlists.length === 0 ? (
            <div className="ypm-set-card" style={{ padding: 24 }}>
              <p className="ypm-set-desc" style={{ margin: 0 }}>
                Belum ada playlist yang dibuat di perangkat ini.
              </p>
            </div>
          ) : (
            <div className="ypm-prof-pl-list">
              {playlists.slice(0, 6).map((pl) => {
                const thumb =
                  pl.tracks?.find((t) => t.thumbs || t.thumb)?.thumbs ||
                  pl.tracks?.find((t) => t.thumb)?.thumb ||
                  null;
                return (
                  <Link
                    key={pl.id}
                    href={`/playlist/${encodeURIComponent(pl.id)}`}
                    className="ypm-prof-pl-row"
                  >
                    <div className="ypm-prof-pl-art">
                      {thumb ? (
                        <img src={thumb} alt={pl.name} loading="lazy" />
                      ) : (
                        <IconMusic className="h-5 w-5 opacity-45" />
                      )}
                    </div>
                    <div className="ypm-hit-info">
                      <p className="ypm-hit-title">{pl.name}</p>
                      <p className="ypm-hit-sub">
                        {pl.tracks?.length || 0} lagu
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Putar ${pl.name}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (pl.tracks?.length) playTracks(pl.tracks, 0);
                        else toast("Playlist masih kosong");
                      }}
                      className="ypm-prof-pl-play"
                    >
                      <IconPlay className="h-4 w-4" />
                    </button>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {accountOpen && <AccountModal onClose={() => setAccountOpen(false)} />}
    </div>
  );
}
