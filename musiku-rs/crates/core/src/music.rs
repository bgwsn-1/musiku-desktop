//! Port dari `src/lib/music.ts` — semua endpoint metadata.
//!
//! Sumber data: crate `rustypipe` (client Innertube / YouTube Music), ditambah
//! lrclib untuk lirik. Bentuk nilai balik dibuat identik dengan versi TS.
//!
//! Semua hasil melewati cache TTL 10 menit (lihat `crate::cache`), meniru
//! `cached()` di `music.ts`.

use std::sync::OnceLock;

use regex::Regex;
use rustypipe::client::RustyPipe;
use rustypipe::model::{AlbumItem, AlbumType, ArtistItem, Thumbnail, TrackItem};

use crate::cache::{JsonCache, METADATA_TTL};
use crate::types::{AlbumDetail, AlbumSummary, ArtistDetail, ArtistName, Count, Duration, HomeItem, HomeItemKind, HomeShelf, Lyrics, Track};

/// UA yang dipakai untuk lrclib / Wikimedia / TheAudioDB (sama seperti TS).
pub const UA: &str = "Musiku/1.0 (music web player; contact: user)";

/// Inti aplikasi: client YouTube Music + cache + HTTP client.
///
/// Dibuat sekali (statis) dan dibagi ke seluruh proses — dipakai bareng oleh
/// server (web) dan shell desktop.
pub struct Musiku {
    pipe: RustyPipe,
    cache: JsonCache,
    http: reqwest::Client,
}

static MUSIKU: OnceLock<Musiku> = OnceLock::new();

/// Akses instance global.
pub fn global() -> &'static Musiku {
    MUSIKU.get_or_init(|| Musiku {
        pipe: RustyPipe::new(),
        cache: JsonCache::new(METADATA_TTL),
        // CATATAN: jangan pakai `.timeout(...)` di sini. Timeout itu membatasi
        // **seluruh** transfer, jadi proxy `/api/stream` (yang memakai client ini
        // juga) akan terputus di tengah lagu/video. Yang benar:
        // - `connect_timeout` membatasi handshake,
        // - `read_timeout` membatasi jeda antar-potongan data,
        // sehingga stream boleh berjalan selama data terus mengalir.
        http: reqwest::Client::builder()
            .user_agent(UA)
            .connect_timeout(std::time::Duration::from_secs(10))
            .read_timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("reqwest client"),
    })
}

// ── Thumbnail ─────────────────────────────────────────────────────────────
// Port 1:1 dari `thumb()` + `upscale()` di `src/lib/music.ts`.

fn re_google_suffix() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"=\w[\w-]*!?$").unwrap())
}

fn re_ytimg_other() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"/(mq|sd[a-z]*)default\.jpg\b").unwrap())
}

fn upscale(url: &str, width: u32) -> String {
    let target = width.clamp(544, 1200);
    let is_google = url.contains("googleusercontent.com") || url.contains("ggpht.com");
    if is_google {
        if re_google_suffix().is_match(url) {
            return re_google_suffix()
                .replace(url, format!("=w{target}-h{target}-l90-rj"))
                .into_owned();
        }
        return format!("{url}=w{target}-h{target}-l90-rj");
    }
    if url.contains("ytimg.com") {
        if url.contains("/hqdefault.jpg") {
            return url.replace("/hqdefault.jpg", "/maxresdefault.jpg");
        }
        return re_ytimg_other().replace(url, "/hqdefault.jpg").into_owned();
    }
    url.to_string()
}

fn thumb(thumbs: &[Thumbnail]) -> Option<String> {
    let best = thumbs.iter().max_by_key(|t| t.width)?;
    if best.url.is_empty() {
        return None;
    }
    Some(upscale(&best.url, best.width))
}

// ── Mapping model rustypipe → tipe Musiku ────────────────────────────────

fn to_track(item: &TrackItem, result_type: Option<&str>) -> Track {
    let first = item.artists.first();
    let artist_name = first.map(|a| a.name.clone());
    let artists = artist_name.clone().map(|n| vec![n]).unwrap_or_default();
    let artist_id = item
        .artist_id
        .clone()
        .or_else(|| first.and_then(|a| a.id.clone()));

    Track {
        video_id: item.id.clone(),
        title: item.name.clone(),
        artist: artist_name,
        artists,
        artist_id,
        album: item.album.as_ref().map(|a| a.name.clone()),
        album_id: item.album.as_ref().map(|a| a.id.clone()),
        duration: item.duration.map(|d| Duration::Secs(d as u64)),
        thumbs: thumb(&item.cover),
        is_explicit: None,
        result_type: result_type.map(str::to_string),
        views: None,
    }
}

fn to_album_summary(item: &AlbumItem) -> AlbumSummary {
    let names: Vec<String> = item.artists.iter().map(|a| a.name.clone()).collect();
    AlbumSummary {
        browse_id: Some(item.id.clone()),
        title: item.name.clone(),
        artist: Some(ArtistName::Many(names)),
        year: item.year.map(|y| y.to_string()),
        thumbs: thumb(&item.cover),
    }
}

fn to_artist_card(item: &ArtistItem) -> ArtistDetail {
    ArtistDetail {
        browse_id: item.id.clone(),
        name: item.name.clone(),
        thumbs: thumb(&item.avatar),
        top_songs: Vec::new(),
        albums: Vec::new(),
        singles: Vec::new(),
        ..Default::default()
    }
}

fn track_to_home(t: &TrackItem) -> HomeItem {
    HomeItem {
        title: t.name.clone(),
        video_id: Some(t.id.clone()),
        browse_id: None,
        artist: t.artists.first().map(|a| a.name.clone()),
        artist_id: t.artist_id.clone().or_else(|| t.artists.first().and_then(|a| a.id.clone())),
        thumbs: thumb(&t.cover),
        kind: HomeItemKind::Song,
    }
}

fn album_to_home(a: &AlbumItem) -> HomeItem {
    HomeItem {
        title: a.name.clone(),
        video_id: None,
        browse_id: Some(a.id.clone()),
        artist: a.artists.first().map(|x| x.name.clone()),
        artist_id: a.artist_id.clone(),
        thumbs: thumb(&a.cover),
        kind: HomeItemKind::Album,
    }
}

fn artist_to_home(a: &ArtistItem) -> HomeItem {
    HomeItem {
        title: a.name.clone(),
        video_id: None,
        browse_id: Some(a.id.clone()),
        artist: None,
        artist_id: Some(a.id.clone()),
        thumbs: thumb(&a.avatar),
        kind: HomeItemKind::Artist,
    }
}

// ── Endpoint ─────────────────────────────────────────────────────────────

pub const FILTERS: [&str; 4] = ["songs", "videos", "artists", "albums"];

impl Musiku {
    pub fn pipe(&self) -> &RustyPipe {
        &self.pipe
    }

    pub fn http(&self) -> &reqwest::Client {
        &self.http
    }

    /// Cari di YouTube Music (array JSON, sama seperti versi Next.js).
    pub async fn search(
        &self,
        q: &str,
        filter: &str,
        limit: usize,
    ) -> anyhow::Result<serde_json::Value> {
        let key = format!("search:{filter}:{limit}:{q}");
        self.cache
            .get_or_try(&key, async {
                let yt = self.pipe.query();
                let value = match filter {
                    "artists" => {
                        let r = yt.music_search_artists(q).await?;
                        serde_json::to_value(
                            r.items.items.iter().take(limit).map(to_artist_card).collect::<Vec<_>>(),
                        )?
                    }
                    "albums" => {
                        let r = yt.music_search_albums(q).await?;
                        serde_json::to_value(
                            r.items.items.iter().take(limit).map(to_album_summary).collect::<Vec<_>>(),
                        )?
                    }
                    "videos" => {
                        let r = yt.music_search_videos(q).await?;
                        serde_json::to_value(
                            r.items.items.iter().take(limit).map(|t| to_track(t, Some("video"))).collect::<Vec<_>>(),
                        )?
                    }
                    _ => {
                        let r = yt.music_search_tracks(q).await?;
                        serde_json::to_value(
                            r.items.items.iter().take(limit).map(|t| to_track(t, Some("song"))).collect::<Vec<_>>(),
                        )?
                    }
                };
                Ok(value)
            })
            .await
    }

    /// Beranda.
    ///
    /// CATATAN: `rustypipe` tidak menyediakan "startpage" seperti
    /// `getHomeSections()` milik `ytmusic-api`. Jadi beranda disintesis dari
    /// rilis baru + daftar artis populer.
    ///
    /// `music_charts().top_tracks` sengaja **tidak** dipakai: per 2026 YouTube
    /// mengubah susunan respons charts sehingga mapper rustypipe menghasilkan
    /// daftar lagu kosong (artis masih terisi). Bagian yang stabil dipakai.
    /// Bentuk `HomeShelf[]` tetap sama, jadi sisi UI tidak perlu diubah.
    pub async fn home(&self) -> anyhow::Result<serde_json::Value> {
        self.cache
            .get_or_try("home", async {
                let yt = self.pipe.query();

                // Dua sumber utama wajib berhasil: kegagalan dikembalikan sebagai error
                // (sama seperti `getHomeSections()` di versi TS), bukan beranda
                // kosong yang tampak sukses. Charts tetap opsional karena
                // susunannya kerap berubah.
                let new_albums = yt.music_new_albums().await?;
                let new_videos = yt.music_new_videos().await?;
                let charts = yt.music_charts(None).await.ok();

                let mut shelves: Vec<HomeShelf> = Vec::new();
                let push = |shelves: &mut Vec<HomeShelf>, title: &str, items: Vec<HomeItem>| {
                    if !items.is_empty() {
                        shelves.push(HomeShelf {
                            title: title.to_string(),
                            items,
                        });
                    }
                };

                push(
                    &mut shelves,
                    "Rilis Baru",
                    new_albums.iter().take(12).map(album_to_home).collect(),
                );
                push(
                    &mut shelves,
                    "Video Musik Baru",
                    new_videos.iter().take(12).map(track_to_home).collect(),
                );

                if let Some(c) = charts {
                    // Artis populer → sajian grid di UI, tapi tetap bertipe
                    // `artist`: browseId-nya `UC...`, bukan `MPREb_...`.
                    let artists: Vec<HomeItem> = c
                        .artists
                        .iter()
                        .take(12)
                        .map(artist_to_home)
                        .collect();
                    push(&mut shelves, "Artis Populer", artists);

                    // Kalau suatu saat YouTube memulihkan charts lagu, ikut dipakai.
                    push(
                        &mut shelves,
                        "Tangga Lagu",
                        c.top_tracks.iter().take(12).map(track_to_home).collect(),
                    );
                }

                Ok(serde_json::to_value(shelves)?)
            })
            .await
    }

    /// Detail album.
    pub async fn album(&self, browse_id: &str) -> anyhow::Result<serde_json::Value> {
        // Id artis (`UC...`) bukan id album. Dulu kartu "Artis Populer" dikirim
        // ke sini dan bikin 502/putus di desktop. Kalau masih ada klien dengan
        // home cache lama, jawab 404 cepat lewat `{ error }` (dicek handler).
        if browse_id.starts_with("UC") {
            return Ok(serde_json::json!({ "error": "bukan id album" }));
        }
        let key = format!("album:{browse_id}");
        self.cache
            .get_or_try(&key, async {
                let a = self.pipe.query().music_album(browse_id).await?;
                let tracks: Vec<Track> = a.tracks.iter().map(|t| to_track(t, None)).collect();
                let total_sec: u64 = a
                    .tracks
                    .iter()
                    .filter_map(|t| t.duration)
                    .map(|d| d as u64)
                    .sum();

                let detail = AlbumDetail {
                    summary: AlbumSummary {
                        browse_id: Some(a.id.clone()),
                        title: a.name.clone(),
                        artist: Some(ArtistName::Many(
                            a.artists.iter().map(|x| x.name.clone()).collect(),
                        )),
                        year: a.year.map(|y| y.to_string()),
                        thumbs: thumb(&a.cover),
                    },
                    artist_id: a.artist_id.clone(),
                    total: Some(tracks.len() as u32),
                    duration: if total_sec > 0 {
                        Some(format!("{} menit", (total_sec as f64 / 60.0).round() as u64))
                    } else {
                        None
                    },
                    tracks,
                };
                Ok(serde_json::to_value(detail)?)
            })
            .await
    }

    /// Detail artis.
    pub async fn artist(&self, browse_id: &str) -> anyhow::Result<serde_json::Value> {
        let key = format!("artist:{browse_id}");
        self.cache
            .get_or_try(&key, async {
                let a = self.pipe.query().music_artist(browse_id, false).await?;

                // rustypipe tidak memisahkan single; kita pisahkan sendiri.
                let mut albums: Vec<AlbumSummary> = Vec::new();
                let mut singles: Vec<AlbumSummary> = Vec::new();
                for al in &a.albums {
                    match al.album_type {
                        AlbumType::Single | AlbumType::Ep => singles.push(to_album_summary(al)),
                        _ => albums.push(to_album_summary(al)),
                    }
                }

                // rustypipe hanya memberi header + angka mentah. Avatar persegi,
                // banner lebar, jumlah pengikut berformat, pendengar bulanan, dan
                // id video header semuanya dibaca dari respons browse mentah —
                // sama seperti `artistStats()` di versi web.
                let stats = crate::ytmusic::browse(browse_id)
                    .await
                    .map(|raw| crate::ytmusic::parse_artist(&raw))
                    .unwrap_or_default();

                let thumbs = thumb(&a.header_image);
                let detail = ArtistDetail {
                    browse_id: a.id.clone(),
                    name: a.name.clone(),
                    // TS selalu null di sini; rustypipe punya deskripsi asli.
                    desc: a.description.clone(),
                    thumbs: thumbs.clone(),
                    avatar: stats.avatar,
                    // banner lebar dari header; cadangan ke thumbnail biasa.
                    banner: stats.banner.or(thumbs),
                    top_video_id: stats.top_video_id,
                    // Teks berformat ("3,07 jt") supaya `compactCount()` di UI
                    // bekerja. Cadangan ke angka mentah rustypipe kalau header
                    // tidak memuat teks pengikut.
                    subscribers: stats
                        .subscribers
                        .map(Count::Text)
                        .or_else(|| a.subscriber_count.map(|n| Count::Num(n as f64))),
                    monthly_listeners: stats.monthly.map(Count::Text),
                    top_songs: a.tracks.iter().map(|t| to_track(t, None)).collect(),
                    albums,
                    singles,
                };
                Ok(serde_json::to_value(detail)?)
            })
            .await
    }

    /// Detail lagu + daftar "selanjutnya".
    pub async fn song(&self, video_id: &str) -> anyhow::Result<serde_json::Value> {
        let key = format!("song:{video_id}");
        self.cache
            .get_or_try(&key, async {
                let d = self.pipe.query().music_details(video_id).await?;
                let title = d.track.name.clone();
                let thumbs = thumb(&d.track.cover);

                let mut related: Vec<Track> = Vec::new();
                if let Some(rid) = d.related_id {
                    if let Ok(rel) = self.pipe.query().music_related(rid).await {
                        related = rel.tracks.iter().take(25).map(|t| to_track(t, None)).collect();
                    }
                }

                Ok(serde_json::json!({
                    "videoId": video_id,
                    "title": title,
                    "thumbs": thumbs,
                    "related": related,
                }))
            })
            .await
    }

    /// Lirik: LRCLIB saja, tanpa fallback lirik YouTube Music.
    pub async fn lyrics(&self, video_id: &str) -> anyhow::Result<serde_json::Value> {
        let key = format!("lyrics:{video_id}");
        self.cache
            .get_or_try(&key, async {
                let yt = self.pipe.query();

                let mut title: Option<String> = None;
                let mut artist: Option<String> = None;
                let mut duration: Option<f64> = None;

                let details = yt.music_details(video_id).await.ok();
                if let Some(d) = &details {
                    title = Some(d.track.name.clone());
                    artist = d.track.artists.first().map(|a| a.name.clone());
                    duration = d.track.duration.map(|x| x as f64);
                }

                if let Some(t) = &title {
                    if let Some(found) = self.lrclib_lookup(t, artist.as_deref(), duration).await {
                        return Ok(serde_json::to_value(found)?);
                    }
                }

                Ok(serde_json::to_value(Lyrics {
                    text: None,
                    synced: false,
                    source: None,
                })?)
            })
            .await
    }

    /// Pencarian lirik di lrclib.net (port `fromLrclib()`).
    async fn lrclib_lookup(
        &self,
        title: &str,
        artist: Option<&str>,
        duration: Option<f64>,
    ) -> Option<Lyrics> {
        let mut q: Vec<(String, String)> = vec![("track_name".into(), title.to_string())];
        if let Some(a) = artist {
            q.push(("artist_name".into(), a.to_string()));
        }

        let resp = self.http.get("https://lrclib.net/api/search").query(&q).send().await.ok()?;
        if !resp.status().is_success() {
            return None;
        }
        let items: Vec<serde_json::Value> = resp.json().await.ok()?;
        if items.is_empty() {
            return None;
        }

        let target = duration.unwrap_or(0.0);
        let score = |i: &serde_json::Value| -> f64 {
            let synced = i.get("syncedLyrics").map(|v| !v.is_null()).unwrap_or(false);
            let dur = i.get("duration").and_then(|v| v.as_f64()).unwrap_or(0.0);
            (if synced { 1_000_000.0 } else { 0.0 }) - (dur - target).abs()
        };

        let best = items.iter().max_by(|a, b| {
            score(a).partial_cmp(&score(b)).unwrap_or(std::cmp::Ordering::Equal)
        })?;

        let synced_text = best.get("syncedLyrics").and_then(|v| v.as_str());
        let plain_text = best.get("plainLyrics").and_then(|v| v.as_str());
        let text = synced_text.or(plain_text)?;
        if text.is_empty() {
            return None;
        }

        Some(Lyrics {
            text: Some(text.to_string()),
            synced: synced_text.is_some(),
            source: Some("lrclib".into()),
        })
    }
}
