//! Akses langsung InnerTube YouTube Music (client **WEB_REMIX**).
//!
//! `rustypipe` membuang sebagian data yang dipakai halaman artis: avatar
//! persegi, banner lebar, dan — yang paling kelihatan — jumlah pengikut &
//! pendengar bulanan sebagai **teks** berformat ("3,07 jt"), bukan angka
//! mentah. Versi web mengambilnya dengan POST ulang ke `browse` lalu membaca
//! `musicImmersiveHeaderRenderer` (lihat `artistStats()` di `src/lib/music.ts`).
//! Modul ini meniru langkah itu 1:1.
//!
//! Konfigurasi client (API key + versi) diambil dari `ytcfg.set(...)` di
//! `music.youtube.com`; nilai bawaannya disimpan di sini supaya permintaan
//! pertama tidak perlu memuat halaman dulu. Kalau YouTube memutar key/versi,
//! permintaan gagal → ambil ytcfg baru → coba sekali lagi.

use std::sync::OnceLock;
use std::time::Duration;

use anyhow::{anyhow, Result};
use serde_json::{json, Value};

use crate::cache::StrCache;
use crate::music::{global, UA};

/// Nilai cadangan (dari ytcfg 2026). Cukup sampai YouTube memutarnya; kalau
/// begitu, `load_cfg()` akan mengambil nilai baru dan menyimpannya di cache.
const DEFAULT_KEY: &str = "AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30";
const DEFAULT_CLIENT_VERSION: &str = "1.20261110.04.00";
/// `INNERTUBE_CONTEXT_CLIENT_NAME` untuk WEB_REMIX.
const CLIENT_NAME_ID: &str = "67";

/// UA browser khusus untuk memuat halaman `music.youtube.com`. YouTube
/// membalas UA `Musiku/1.0 ...` dengan halaman stub "browser sudah tidak
/// digunakan lagi" (2 KB, tanpa `ytcfg`), sehingga jalur fallback tak pernah
/// berhasil. Header Innertube lain boleh memakai `UA` biasa.
const BROWSER_UA: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/// ytcfg berlaku lama; simpan 6 jam.
const CFG_TTL: Duration = Duration::from_secs(6 * 60 * 60);

static CFG: OnceLock<StrCache> = OnceLock::new();

fn cfg_cache() -> &'static StrCache {
    CFG.get_or_init(|| StrCache::new(CFG_TTL))
}

/// Konfigurasi client hasil `ytcfg` (JSON, supaya bisa disimpan di `StrCache`).
#[derive(Debug, Clone)]
struct Cfg {
    key: String,
    client_version: String,
    visitor: Option<String>,
    gl: String,
    hl: String,
}

impl Cfg {
    fn builtin() -> Self {
        Self {
            key: DEFAULT_KEY.to_string(),
            client_version: DEFAULT_CLIENT_VERSION.to_string(),
            visitor: None,
            gl: "ID".to_string(),
            // PENTING: `HL=en`, bukan `id`. Versi web membaca `ytcfg` dari
            // music.youtube.com tanpa cookie, dan di sana `HL` selalu "en",
            // jadi yang diterimanya teks berformat Inggris ("3.07M",
            // "62.6M monthly audience"). `compactCount()` di UI hanya paham
            // bentuk itu; kalau kita minta `hl=id`, YouTube mengirim
            // "62,6 jt audiens bulanan" dan UI menambah "pendengar bulanan"
            // lagi → dobel. Jadi HL wajib "en" agar identik dengan web.
            hl: "en".to_string(),
        }
    }

    fn from_json(v: &Value) -> Self {
        let s = |k: &str| v.get(k).and_then(Value::as_str).map(str::to_string);
        let fallback = Self::builtin();
        Self {
            key: s("INNERTUBE_API_KEY").unwrap_or(fallback.key),
            client_version: s("INNERTUBE_CLIENT_VERSION")
                .unwrap_or(fallback.client_version),
            visitor: s("VISITOR_DATA"),
            gl: s("GL").unwrap_or(fallback.gl),
            hl: s("HL").unwrap_or(fallback.hl),
        }
    }
}

/// Ambil `ytcfg.set(...)` dari halaman utama YouTube Music.
async fn fetch_cfg() -> Result<String> {
    let html = global()
        .http()
        .get("https://music.youtube.com/")
        // UA browser wajib: dengan UA `Musiku/1.0 ...` YouTube membalas halaman
        // stub "browser sudah tidak digunakan lagi" yang tidak memuat ytcfg.
        .header("user-agent", BROWSER_UA)
        .header("accept-language", "en-US,en;q=0.9")
        .send()
        .await?
        .error_for_status()?
        .text()
        .await?;

    let mut merged = serde_json::Map::new();
    // `ytcfg.set({...});` — potong `ytcfg.set(` dan `);`.
    for chunk in html.split("ytcfg.set(").skip(1) {
        let Some(end) = chunk.find(");") else { continue };
        let body = chunk[..end].trim();
        if let Ok(Value::Object(o)) = serde_json::from_str::<Value>(body) {
            for (k, v) in o {
                merged.insert(k, v);
            }
        }
    }

    if merged.is_empty() {
        return Err(anyhow!("ytcfg tidak ditemukan di music.youtube.com"));
    }
    Ok(Value::Object(merged).to_string())
}

/// Konfigurasi client (cache 6 jam, ambil dari halaman kalau belum ada).
async fn cfg() -> Result<Cfg> {
    let raw = cfg_cache().get_or_try("ytcfg", async { fetch_cfg().await }).await?;
    let v: Value = serde_json::from_str(&raw)?;
    Ok(Cfg::from_json(&v))
}

/// POST ke `youtubei/v1/browse` dan kembalikan respons mentah.
async fn browse_once(cfg: &Cfg, browse_id: &str) -> Result<Value> {
    let mut client = json!({
        "clientName": "WEB_REMIX",
        "clientVersion": cfg.client_version,
        "hl": cfg.hl,
        "gl": cfg.gl,
    });
    if let Some(v) = &cfg.visitor {
        client["visitorData"] = Value::String(v.clone());
    }

    let body = json!({
        "context": {
            "client": client,
            "user": { "lockedSafetyMode": false },
        },
        "browseId": browse_id,
    });

    let mut req = global()
        .http()
        .post("https://music.youtube.com/youtubei/v1/browse")
        .query(&[("alt", "json"), ("key", cfg.key.as_str())])
        .header("content-type", "application/json")
        .header("user-agent", UA)
        .header("x-youtube-client-name", CLIENT_NAME_ID)
        .header("x-youtube-client-version", cfg.client_version.as_str())
        .header("origin", "https://music.youtube.com")
        .header("referer", "https://music.youtube.com/");
    if let Some(v) = &cfg.visitor {
        req = req.header("x-goog-visitor-id", v.as_str());
    }

    let resp = req.json(&body).send().await?;
    if !resp.status().is_success() {
        return Err(anyhow!("browse HTTP {}", resp.status()));
    }
    Ok(resp.json().await?)
}

/// Respons `browse` mentah untuk sebuah id (artis/album/playlist).
///
/// Coba nilai bawaan dulu (satu POST, cepat). Kalau header artis tidak ada di
/// respons, kemungkinan key/versi sudah berganti → muat ytcfg lalu ulangi.
pub async fn browse(browse_id: &str) -> Result<Value> {
    let raw = browse_once(&Cfg::builtin(), browse_id).await?;
    if raw.pointer("/header/musicImmersiveHeaderRenderer").is_some() {
        return Ok(raw);
    }

    let fresh = cfg().await?;
    let raw = browse_once(&fresh, browse_id).await?;
    if raw.pointer("/header/musicImmersiveHeaderRenderer").is_some() {
        return Ok(raw);
    }
    Err(anyhow!("header artis tidak ada di respons browse {browse_id}"))
}

// ── Parsing ──────────────────────────────────────────────────────────────

/// Statistik + aset header artis (teks berformat, seperti versi web).
#[derive(Debug, Clone, Default, PartialEq)]
pub struct ArtistStats {
    pub subscribers: Option<String>,
    pub monthly: Option<String>,
    pub avatar: Option<String>,
    pub banner: Option<String>,
    pub top_video_id: Option<String>,
}

/// Ambil teks pertama dari `{ runs: [{ text }] }` atau `{ simpleText }`.
fn run_text(v: &Value) -> Option<String> {
    let s = v
        .pointer("/runs/0/text")
        .and_then(Value::as_str)
        .or_else(|| v.get("simpleText").and_then(Value::as_str))?;
    let t = s.trim();
    (!t.is_empty()).then(|| t.to_string())
}

/// URL terakhir (resolusi terbesar) dari array thumbnail.
fn last_url(v: &Value) -> Option<String> {
    v.as_array()?
        .iter()
        .rev()
        .find_map(|t| t.get("url").and_then(Value::as_str))
        .map(str::to_string)
}

/// `topVideos[0]` versi web diambil dari carousel **"Video"**. Cari carousel
/// yang judulnya "Video"/"Videos" lalu ambil entri pertamanya. (ytmusic-api
/// memakai indeks tetap yang per 2026 menunjuk carousel yang salah.)
fn top_video(raw: &Value) -> Option<String> {
    let sections = raw.pointer(
        "/contents/singleColumnBrowseResultsRenderer/tabs/0/tabRenderer/content/sectionListRenderer/contents",
    )?;
    for section in sections.as_array()? {
        let Some(shelf) = section.get("musicCarouselShelfRenderer") else {
            continue;
        };
        let title = shelf
            .pointer("/title/runs/0/text")
            .or_else(|| {
                shelf.pointer("/header/musicCarouselShelfBasicHeaderRenderer/title/runs/0/text")
            })
            .and_then(Value::as_str)
            .unwrap_or("");
        if !title.to_ascii_lowercase().starts_with("video") {
            continue;
        }
        let first = shelf.pointer("/contents/0")?;
        for key in ["musicTwoRowItemRenderer", "musicResponsiveListItemRenderer"] {
            if let Some(id) = first
                .pointer(&format!("/{key}/navigationEndpoint/watchEndpoint/videoId"))
                .and_then(Value::as_str)
            {
                return Some(id.to_string());
            }
        }
    }
    None
}

/// Baca `musicImmersiveHeaderRenderer` + microformat, persis seperti
/// `artistStats()` di versi web.
pub fn parse_artist(raw: &Value) -> ArtistStats {
    let h = raw.pointer("/header/musicImmersiveHeaderRenderer");
    ArtistStats {
        subscribers: h
            .and_then(|h| {
                h.pointer(
                    "/subscriptionButton/subscribeButtonRenderer/subscriberCountText",
                )
            })
            .and_then(run_text),
        monthly: h
            .and_then(|h| h.get("monthlyListenerCount"))
            .and_then(run_text),
        banner: h
            .and_then(|h| {
                h.pointer("/thumbnail/musicThumbnailRenderer/thumbnail/thumbnails")
            })
            .and_then(last_url),
        avatar: raw
            .pointer("/microformat/microformatDataRenderer/thumbnail/thumbnails")
            .and_then(last_url),
        top_video_id: top_video(raw),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Potongan respons browse Don Toliver (2026) yang sudah diperkecil.
    /// Teks persis seperti yang web terima (`HL=en`).
    fn fixture() -> Value {
        json!({
            "header": {
                "musicImmersiveHeaderRenderer": {
                    "monthlyListenerCount": {
                        "runs": [{ "text": "62.6M monthly audience" }]
                    },
                    "subscriptionButton": {
                        "subscribeButtonRenderer": {
                            "subscriberCountText": { "runs": [{ "text": "3.07M" }] }
                        }
                    },
                    "thumbnail": {
                        "musicThumbnailRenderer": {
                            "thumbnail": {
                                "thumbnails": [
                                    { "url": "wide-540.jpg", "width": 540, "height": 225 },
                                    { "url": "wide-1728.jpg", "width": 1728, "height": 720 }
                                ]
                            }
                        }
                    }
                }
            },
            "microformat": {
                "microformatDataRenderer": {
                    "thumbnail": {
                        "thumbnails": [{ "url": "square-544.jpg", "width": 544, "height": 544 }]
                    }
                }
            },
            "contents": {
                "singleColumnBrowseResultsRenderer": {
                    "tabs": [{
                        "tabRenderer": {
                            "content": {
                                "sectionListRenderer": {
                                    "contents": [
                                        { "musicShelfRenderer": { "title": { "runs": [{ "text": "Lagu teratas" }] } } },
                                        { "musicCarouselShelfRenderer": {
                                            "title": { "runs": [{ "text": "Album" }] },
                                            "contents": [{ "musicTwoRowItemRenderer": {
                                                "navigationEndpoint": { "watchEndpoint": { "videoId": "SALAH-ALBUM" } }
                                            } }]
                                        } },
                                        { "musicCarouselShelfRenderer": {
                                            "title": { "runs": [{ "text": "Video" }] },
                                            "contents": [{ "musicTwoRowItemRenderer": {
                                                "navigationEndpoint": { "watchEndpoint": { "videoId": "qFIJHaylMu4" } }
                                            } }]
                                        } }
                                    ]
                                }
                            }
                        }
                    }]
                }
            }
        })
    }

    #[test]
    fn parse_statistik_dan_aset() {
        let s = parse_artist(&fixture());
        assert_eq!(s.subscribers.as_deref(), Some("3.07M"));
        assert_eq!(s.monthly.as_deref(), Some("62.6M monthly audience"));
        // avatar = thumbnail persegi, banner = thumbnail lebar (paling besar)
        assert_eq!(s.avatar.as_deref(), Some("square-544.jpg"));
        assert_eq!(s.banner.as_deref(), Some("wide-1728.jpg"));
        // topVideoId dari carousel "Video", bukan carousel "Album"
        assert_eq!(s.top_video_id.as_deref(), Some("qFIJHaylMu4"));
    }

    #[test]
    fn parse_kosong_tidak_panik() {
        let s = parse_artist(&json!({}));
        assert_eq!(s, ArtistStats::default());
    }
}
