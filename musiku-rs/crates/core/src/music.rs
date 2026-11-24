//! Port dari `src/lib/music.ts` — semua endpoint metadata.
//!
//! Sumber data: crate `rustypipe` (client Innertube / YouTube Music), ditambah
//! lrclib untuk lirik. Bentuk nilai balik dibuat identik dengan versi TS.
//!
//! Semua hasil melewati cache TTL 10 menit (lihat `crate::cache`), meniru
//! `cached()` di `music.ts`.

use std::sync::OnceLock;

use futures_util::future::join_all;
use regex::Regex;
use rustypipe::client::RustyPipe;
use rustypipe::model::{AlbumItem, AlbumType, ArtistItem, Thumbnail, TrackItem};
use rustypipe::param::Country;

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

/// Direktori cache milik aplikasi di lokasi standar OS agar `rustypipe` tidak
/// menulis `rustypipe_cache.json` / `rustypipe_reports/` ke CWD (yang bisa
/// read-only pada instalasi `/usr/bin` atau `Program Files`).
fn rustypipe_cache_dir() -> std::path::PathBuf {
    #[cfg(target_os = "windows")]
    let base = std::env::var_os("LOCALAPPDATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);

    #[cfg(target_os = "macos")]
    let base = std::env::var_os("HOME")
        .map(|h| std::path::PathBuf::from(h).join("Library").join("Caches"))
        .unwrap_or_else(std::env::temp_dir);

    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    let base = std::env::var_os("XDG_CACHE_HOME")
        .filter(|v| !v.is_empty())
        .map(std::path::PathBuf::from)
        .or_else(|| {
            std::env::var_os("HOME").map(|h| std::path::PathBuf::from(h).join(".cache"))
        })
        .unwrap_or_else(std::env::temp_dir);

    let dir = base.join("musiku").join("rustypipe");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

/// Akses instance global.
pub fn global() -> &'static Musiku {
    MUSIKU.get_or_init(|| Musiku {
        pipe: RustyPipe::builder()
            .storage_dir(rustypipe_cache_dir())
            .build()
            .unwrap_or_else(|_| RustyPipe::new()),
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
    /// rilis baru + lagu baru (region US = cakupan global) dan artis populer
    /// global (charts lintas-region, lihat `global_artist_list`).
    /// Bentuk `HomeShelf[]` tetap sama, jadi sisi UI tidak perlu diubah.
    pub async fn home(&self) -> anyhow::Result<serde_json::Value> {
        self.cache
            .get_or_try("home", async {
                let (gnew_res, artists_res) =
                    tokio::join!(self.global_new(), self.global_artist_list());

                let mut last_err: Option<anyhow::Error> = None;
                let gnew = match gnew_res {
                    Ok(v) => v,
                    Err(e) => {
                        last_err = Some(e);
                        serde_json::json!({ "albums": [], "songs": [] })
                    }
                };
                let global_artists = match artists_res {
                    Ok(v) => v,
                    Err(e) => {
                        last_err = Some(e);
                        serde_json::Value::Array(Vec::new())
                    }
                };

                let new_albums: Vec<HomeItem> =
                    serde_json::from_value(gnew["albums"].clone()).unwrap_or_default();
                let new_songs: Vec<HomeItem> =
                    serde_json::from_value(gnew["songs"].clone()).unwrap_or_default();

                let mut shelves: Vec<HomeShelf> = Vec::new();
                let push = |shelves: &mut Vec<HomeShelf>, title: &str, items: Vec<HomeItem>| {
                    if !items.is_empty() {
                        shelves.push(HomeShelf {
                            title: title.to_string(),
                            items,
                        });
                    }
                };

                push(&mut shelves, "Rilis Baru", new_albums);
                push(&mut shelves, "Lagu Baru", new_songs);

                // Artis populer global (charts lintas-region), bukan sekadar
                // artis populer region perangkat.
                let artists: Vec<HomeItem> =
                    serde_json::from_value(global_artists).unwrap_or_default();
                push(&mut shelves, "Artis Populer", artists.into_iter().take(12).collect());

                // Jangan cache beranda kosong bila terjadi kegagalan jaringan sementara.
                if shelves.is_empty() {
                    if let Some(e) = last_err {
                        return Err(e);
                    }
                }

                Ok(serde_json::to_value(shelves)?)
            })
            .await
    }

    /// Artis populer **global**: gabungan charts YouTube Music dari beberapa
    /// negara besar, bukan region perangkat. Peringkat lintas-region dihitung
    /// dari posisi tiap artis di tiap charts (semakin atas semakin tinggi),
    /// lalu diabuikan `{browseId, title, thumbs, subscribers}`.
    async fn global_artist_list(&self) -> anyhow::Result<serde_json::Value> {
        self.cache
            .get_or_try("global_artists", async {
                let yt = self.pipe.query();
                const REGIONS: [Country; 6] = [
                    Country::Us,
                    Country::Gb,
                    Country::De,
                    Country::Jp,
                    Country::Br,
                    Country::Kr,
                ];
                const PER_REGION: usize = 12;
                struct Entry {
                    score: u32,
                    hits: u32,
                    value: serde_json::Value,
                }
                let mut map: std::collections::HashMap<String, Entry> =
                    std::collections::HashMap::new();
                // 6 region sekaligus: dulu berurutan, jadi cold home nunggu
                // 6 round-trip berturut-turut sebelum bisa lanjut.
                let charts_list =
                    join_all(REGIONS.into_iter().map(|r| yt.music_charts(Some(r)))).await;
                let mut ok_count = 0usize;
                let mut last_err: Option<String> = None;
                for res in charts_list {
                    let charts = match res {
                        Ok(c) => {
                            ok_count += 1;
                            c
                        }
                        Err(e) => {
                            last_err = Some(e.to_string());
                            continue;
                        }
                    };
                    for (idx, a) in charts.artists.iter().take(PER_REGION).enumerate() {
                        let score = (PER_REGION - idx) as u32;
                        let v = serde_json::json!({
                            "browseId": a.id,
                            "title": a.name,
                            "thumbs": thumb(&a.avatar),
                            "subscribers": a.subscriber_count.unwrap_or(0),
                            "kind": "artist",
                        });
                        map.entry(a.id.clone())
                            .and_modify(|e| {
                                e.score += score;
                                e.hits += 1;
                            })
                            .or_insert(Entry {
                                score,
                                hits: 1,
                                value: v,
                            });
                    }
                }
                if ok_count == 0 {
                    anyhow::bail!(
                        "gagal memuat charts artis: {}",
                        last_err.unwrap_or_else(|| "semua region gagal".into())
                    );
                }
                let mut items: Vec<(u32, u32, serde_json::Value)> = map
                    .into_values()
                    .map(|e| (e.score, e.hits, e.value))
                    .collect();
                items.sort_by(|a, b| b.0.cmp(&a.0).then(b.1.cmp(&a.1)));
                let out: Vec<serde_json::Value> =
                    items.into_iter().map(|(_, _, v)| v).collect();
                Ok(serde_json::Value::Array(out))
            })
            .await
    }

    /// Daftar mood YouTube Music (bahan filter beranda).
    pub async fn moods(&self) -> anyhow::Result<serde_json::Value> {
        self.cache
            .get_or_try("moods", async {
                let yt = self.pipe.query();
                let list = yt.music_genres().await?;
                let out: Vec<serde_json::Value> = list
                    .into_iter()
                    .filter(|g| g.is_mood)
                    .map(|g| {
                        serde_json::json!({
                            "id": g.id,
                            "title": g.name,
                            "color": format!("#{:06x}", g.color & 0x00FF_FFFF),
                        })
                    })
                    .collect();
                Ok(serde_json::Value::Array(out))
            })
            .await
    }

    /// Playlist milik satu mood.
    pub async fn mood_playlists(&self, id: &str) -> anyhow::Result<serde_json::Value> {
        let key = format!("mood:{id}");
        self.cache
            .get_or_try(&key, async {
                let genre = self.pipe.query().music_genre(id).await?;
                let mut items: Vec<serde_json::Value> = Vec::new();
                for sec in genre.sections {
                    for pl in sec.playlists {
                        if pl.is_podcast {
                            continue;
                        }
                        items.push(serde_json::json!({
                            "browseId": pl.id,
                            "title": pl.name,
                            "thumbs": thumb(&pl.thumbnail),
                            "subtitle": sec.name,
                            "tracks": pl.track_count.unwrap_or(0),
                        }));
                    }
                }
                Ok(serde_json::Value::Array(items))
            })
            .await
    }

    /// Artis populer global (charts lintas-region) untuk hero beranda.
    pub async fn global_artists(&self) -> anyhow::Result<serde_json::Value> {
        self.global_artist_list().await
    }

    /// "Rilis Baru" & "Lagu Baru" versi global.
    ///
    /// Feed new-releases YouTube Music terkunci region perangkat (IP), jadi
    /// sumber global diambil dari album terbaru + lagu atas artis chart
    /// lintas-region. Mengembalikan `{albums: HomeItem[], songs: HomeItem[]}`.
    pub async fn global_new(&self) -> anyhow::Result<serde_json::Value> {
        self.cache
            .get_or_try("global_new", async {
                let list = self.global_artist_list().await?;
                let ids: Vec<String> = list
                    .as_array()
                    .map(|arr| {
                        arr.iter()
                            .take(6)
                            .filter_map(|v| v["browseId"].as_str().map(String::from))
                            .collect()
                    })
                    .unwrap_or_default();

                let mut albums: Vec<(i64, HomeItem)> = Vec::new();
                let mut songs: Vec<HomeItem> = Vec::new();
                // Detail 6 artis diambil paralel; `join_all` menjaga urutan ids,
                // jadi perilaku sorting/urutan shelf tidak berubah.
                let details = join_all(ids.iter().map(|id| self.artist(id))).await;
                let mut ok_count = 0usize;
                let mut last_err: Option<anyhow::Error> = None;
                for res in details {
                    let raw = match res {
                        Ok(v) => {
                            ok_count += 1;
                            v
                        }
                        Err(e) => {
                            last_err = Some(e);
                            continue;
                        }
                    };
                    let detail: ArtistDetail = match serde_json::from_value(raw) {
                        Ok(d) => d,
                        Err(_) => continue,
                    };
                    for al in detail.albums {
                        let year = al
                            .year
                            .as_deref()
                            .and_then(|y| y.parse::<i64>().ok())
                            .unwrap_or(0);
                        let artist_name = match &al.artist {
                            Some(crate::types::ArtistName::One(s)) => Some(s.clone()),
                            Some(crate::types::ArtistName::Many(v)) => {
                                if v.is_empty() {
                                    None
                                } else {
                                    Some(v.join(", "))
                                }
                            }
                            None => None,
                        };
                        albums.push((
                            year,
                            HomeItem {
                                title: al.title.clone(),
                                video_id: None,
                                browse_id: al.browse_id.clone(),
                                artist: artist_name,
                                artist_id: None,
                                thumbs: al.thumbs.clone(),
                                kind: HomeItemKind::Album,
                            },
                        ));
                    }
                    for t in detail.top_songs.iter().take(3) {
                        songs.push(HomeItem {
                            title: t.title.clone(),
                            video_id: Some(t.video_id.clone()),
                            browse_id: None,
                            artist: t
                                .artists
                                .first()
                                .cloned()
                                .or_else(|| t.artist.clone()),
                            artist_id: t.artist_id.clone(),
                            thumbs: t.thumbs.clone(),
                            kind: HomeItemKind::Song,
                        });
                    }
                }
                if !ids.is_empty() && ok_count == 0 {
                    if let Some(e) = last_err {
                        return Err(e);
                    }
                }
                albums.sort_by_key(|(year, _)| std::cmp::Reverse(*year));
                let out_albums: Vec<HomeItem> =
                    albums.into_iter().take(12).map(|(_, v)| v).collect();
                Ok(serde_json::json!({ "albums": out_albums, "songs": songs }))
            })
            .await
    }

    /// Playlist YouTube Music (mis. dari halaman mood) dengan lagu-lagunya.
    pub async fn ytm_playlist(&self, id: &str) -> anyhow::Result<serde_json::Value> {
        let key = format!("ytm_playlist:{id}");
        self.cache
            .get_or_try(&key, async {
                let pl = self.pipe.query().music_playlist(id).await?;
                let tracks: Vec<Track> = pl
                    .tracks
                    .items
                    .iter()
                    .map(|t| to_track(t, Some("song")))
                    .collect();
                Ok(serde_json::json!({
                    "browseId": pl.id,
                    "title": pl.name,
                    "thumbs": thumb(&pl.thumbnail),
                    "owner": pl.channel.as_ref().map(|c| c.name.clone()),
                    "trackCount": pl.track_count.unwrap_or(tracks.len() as u64),
                    "tracks": serde_json::to_value(tracks)?,
                }))
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
                // Dua sumber detail artis tidak saling bergantung → jalankan bareng.
                let query = self.pipe.query();
                let (artist_res, browse_res) = tokio::join!(
                    query.music_artist(browse_id, false),
                    crate::ytmusic::browse(browse_id),
                );
                let a = artist_res?;

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
                let stats = browse_res
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
                let details = yt.music_details(video_id).await?;

                let title = details.track.name.clone();
                let artist = details.track.artists.first().map(|a| a.name.clone());
                let duration = details.track.duration.map(|x| x as f64);

                if !title.is_empty() {
                    if let Some(found) = self
                        .lrclib_lookup(&title, artist.as_deref(), duration)
                        .await?
                    {
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
    /// Mengembalikan `Err` untuk error jaringan / 429 / 5xx agar tidak
    /// ter-cache sebagai "tidak ada lirik", dan `Ok(None)` bila memang tidak ada.
    async fn lrclib_lookup(
        &self,
        title: &str,
        artist: Option<&str>,
        duration: Option<f64>,
    ) -> anyhow::Result<Option<Lyrics>> {
        let mut q: Vec<(String, String)> = vec![("track_name".into(), title.to_string())];
        if let Some(a) = artist {
            q.push(("artist_name".into(), a.to_string()));
        }

        let resp = self
            .http
            .get("https://lrclib.net/api/search")
            .query(&q)
            .send()
            .await?;
        let status = resp.status();
        if status == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }
        if !status.is_success() {
            anyhow::bail!("lrclib HTTP {status}");
        }
        let items: Vec<serde_json::Value> = resp.json().await?;
        if items.is_empty() {
            return Ok(None);
        }

        let target = duration.unwrap_or(0.0);
        let score = |i: &serde_json::Value| -> f64 {
            let synced = i.get("syncedLyrics").map(|v| !v.is_null()).unwrap_or(false);
            let dur = i.get("duration").and_then(|v| v.as_f64()).unwrap_or(0.0);
            (if synced { 1_000_000.0 } else { 0.0 }) - (dur - target).abs()
        };

        let Some(best) = items.iter().max_by(|a, b| {
            score(a)
                .partial_cmp(&score(b))
                .unwrap_or(std::cmp::Ordering::Equal)
        }) else {
            return Ok(None);
        };

        let synced_text = best.get("syncedLyrics").and_then(|v| v.as_str());
        let plain_text = best.get("plainLyrics").and_then(|v| v.as_str());
        let Some(text) = synced_text.or(plain_text) else {
            return Ok(None);
        };
        if text.is_empty() {
            return Ok(None);
        }

        Ok(Some(Lyrics {
            text: Some(text.to_string()),
            synced: synced_text.is_some(),
            source: Some("lrclib".into()),
        }))
    }
}
