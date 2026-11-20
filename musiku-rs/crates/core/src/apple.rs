//! Resolver artwork Apple Music untuk mode immersive desktop.
//!
//! APK Apple Music (7.0.0) mengonfirmasi dua hal: endpoint katalog
//! `amp-api.music.apple.com` dan format Motion Art / Animated Artwork sebagai
//! HLS (`format=m3u8-aapl`). Token yang tertanam di APK sudah expired sejak
//! 2018, jadi jalur yang dipakai di sini adalah jalur **publik**:
//!
//! 1. `itunes.apple.com/search` (tanpa auth) → album Apple + cover statis.
//! 2. Halaman album `music.apple.com/.../{id}` → `motionDetailSquare.video`
//!    (URL `.m3u8`) dan `previewFrame.url` (cover statis Apple).
//!
//! Ini hanya mengambil artwork promosi, bukan audio — tidak ada DRM yang
//! disentuh. Hasil di-cache 6 jam supaya ganti lagu bolak-balik tidak
//! mem-bombard Apple.

use std::sync::OnceLock;
use std::time::Duration;

use anyhow::{anyhow, Result};
use reqwest::Url;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::cache::JsonCache;
use crate::music::global;

const ITUNES_SEARCH: &str = "https://itunes.apple.com/search";
const BROWSER_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/// Hasil resolver. `motion` adalah Motion Art (HLS), `still` cover statis Apple.
/// Keduanya bisa `null` — UI lalu jatuh ke cover YouTube Music yang sekarang.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppleArtwork {
    pub motion: Option<String>,
    pub still: Option<String>,
    pub album: Option<String>,
    pub artist: Option<String>,
    pub url: Option<String>,
}

fn cache() -> &'static JsonCache {
    static C: OnceLock<JsonCache> = OnceLock::new();
    C.get_or_init(|| JsonCache::new(Duration::from_secs(6 * 60 * 60)))
}

/// Cari artwork untuk judul + artis. Gagal apa pun → `None` (fallback UI).
pub async fn apple_artwork(title: &str, artist: Option<&str>) -> Option<AppleArtwork> {
    let title = title.trim();
    if title.is_empty() {
        return None;
    }
    let artist = artist.map(str::trim).filter(|s| !s.is_empty());
    let key = format!(
        "{}|{}",
        title.to_lowercase(),
        artist.unwrap_or("").to_lowercase()
    );

    let value = cache()
        .get_or_try(&key, {
            let title = title.to_string();
            let artist = artist.map(str::to_string);
            async move {
                let found = fetch(&title, artist.as_deref()).await?;
                Ok(serde_json::to_value(found)?)
            }
        })
        .await
        .ok()?;
    serde_json::from_value(value).ok()
}

async fn fetch(title: &str, artist: Option<&str>) -> Result<AppleArtwork> {
    let term = match artist {
        Some(a) => format!("{title} {a}"),
        None => title.to_string(),
    };

    // Judul lagu biasanya bukan judul album. Cari track dulu supaya halaman
    // album yang dipakai benar-benar album dari lagu ini, bukan hasil pertama
    // pencarian album yang kebetulan mirip (mis. "past life" → My Everything).
    let songs = search("song", &term, 12).await?;
    let picked = pick(&songs, "trackName", title, artist);

    let (album, artist_name, art, page) = if let Some(song) = picked {
        fields(song)
    } else {
        let albums = search("album", &term, 10).await?;
        let album = pick(&albums, "collectionName", title, artist)
            .ok_or_else(|| anyhow!("itunes: album tidak ditemukan"))?;
        fields(album)
    };

    let (motion, frame) = match page.as_deref() {
        Some(p) => fetch_motion(p).await.unwrap_or((None, None)),
        None => (None, None),
    };

    Ok(AppleArtwork {
        motion,
        still: frame.or(art),
        album,
        artist: artist_name,
        url: page,
    })
}

async fn search(entity: &str, term: &str, limit: u32) -> Result<Vec<Value>> {
    let limit = limit.to_string();
    let url = Url::parse_with_params(
        ITUNES_SEARCH,
        &[
            ("term", term),
            ("entity", entity),
            ("limit", &limit),
            ("country", "us"),
        ],
    )?;

    let res: Value = global()
        .http()
        .get(url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    Ok(res
        .get("results")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default())
}

fn fields(r: &Value) -> (Option<String>, Option<String>, Option<String>, Option<String>) {
    let album = r
        .get("collectionName")
        .and_then(Value::as_str)
        .map(str::to_string);
    let artist = r
        .get("artistName")
        .and_then(Value::as_str)
        .map(str::to_string);
    let art = r
        .get("artworkUrl100")
        .and_then(Value::as_str)
        .map(upgrade_art);
    // URL track punya `?i=...`; halaman album tetap dipakai untuk Motion Art.
    let page = r
        .get("collectionViewUrl")
        .and_then(Value::as_str)
        .map(|u| u.split('?').next().unwrap_or(u).to_string());
    (album, artist, art, page)
}

/// Huruf kecil + buang tanda baca/spasi, supaya "Past Life" = "past-life".
fn norm(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric())
        .collect()
}

fn artist_ok(r: &Value, artist: Option<&str>) -> bool {
    let Some(want) = artist.map(norm).filter(|s| !s.is_empty()) else {
        return true;
    };
    let got = norm(r.get("artistName").and_then(Value::as_str).unwrap_or_default());
    got.contains(&want) || want.contains(&got)
}

fn score(r: &Value, key: &str, title: &str) -> u8 {
    let want = norm(title);
    let got = norm(r.get(key).and_then(Value::as_str).unwrap_or_default());
    if got == want {
        3
    } else if got.starts_with(&want) || want.starts_with(&got) {
        2
    } else if got.contains(&want) || want.contains(&got) {
        1
    } else {
        0
    }
}

/// Pilih hasil dengan skor tertinggi. Nggak pernah jatuh ke hasil pertama
/// kalau judulnya memang nggak cocok.
fn pick<'a>(results: &'a [Value], key: &str, title: &str, artist: Option<&str>) -> Option<&'a Value> {
    let mut best: Option<&Value> = None;
    let mut best_score = 0;
    for r in results {
        if !artist_ok(r, artist) {
            continue;
        }
        let s = score(r, key, title);
        if s > best_score {
            best_score = s;
            best = Some(r);
        }
    }
    best
}

/// `100x100bb.jpg` → `1200x1200bb.jpg`.
fn upgrade_art(url: &str) -> String {
    for (small, large) in [
        ("/100x100bb.jpg", "/1200x1200bb.jpg"),
        ("/100x100bb.png", "/1200x1200bb.png"),
    ] {
        if let Some(base) = url.strip_suffix(small) {
            return format!("{base}{large}");
        }
    }
    url.to_string()
}

async fn fetch_motion(page: &str) -> Result<(Option<String>, Option<String>)> {
    let html = global()
        .http()
        .get(page)
        .header(reqwest::header::USER_AGENT, BROWSER_UA)
        .header(reqwest::header::ACCEPT_LANGUAGE, "en-US,en;q=0.9")
        .send()
        .await?
        .error_for_status()?
        .text()
        .await?;
    Ok(parse_motion(&html))
}

/// Ambil `motionDetailSquare` (Motion Art versi kotak) dari snapshot halaman.
fn parse_motion(html: &str) -> (Option<String>, Option<String>) {
    let Some(i) = html.find("\"motionDetailSquare\"") else {
        return (None, None);
    };
    let end = (i + 12_000).min(html.len());
    let tail = &html[i..end];

    let motion = json_string_after(tail, "\"video\":\"")
        .filter(|u| u.starts_with("https://") && u.contains(".m3u8"));
    let still = json_string_after(tail, "\"url\":\"")
        .map(|u| fill_image_template(&u))
        .filter(|u| u.starts_with("https://") && u.contains("mzstatic.com"));

    (motion, still)
}

fn fill_image_template(url: &str) -> String {
    url.replace("{w}", "1200")
        .replace("{h}", "1200")
        .replace("{c}", "bb")
        .replace("{f}", "jpg")
}

/// String JSON pertama setelah `marker`, dengan escape `\/` dan `\u002F`.
fn json_string_after(hay: &str, marker: &str) -> Option<String> {
    let start = hay.find(marker)? + marker.len();
    let mut out = String::new();
    let mut chars = hay[start..].chars();
    while let Some(c) = chars.next() {
        match c {
            '"' => return Some(out),
            '\\' => match chars.next()? {
                '/' => out.push('/'),
                '"' => out.push('"'),
                '\\' => out.push('\\'),
                'n' => out.push('\n'),
                'r' => out.push('\r'),
                't' => out.push('\t'),
                'u' => {
                    let hex: String = chars.by_ref().take(4).collect();
                    if hex.eq_ignore_ascii_case("002f") {
                        out.push('/');
                    } else {
                        out.push('\\');
                        out.push('u');
                        out.push_str(&hex);
                    }
                }
                other => out.push(other),
            },
            _ => out.push(c),
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_motion_detail_square() {
        let html = r#""videoArtwork":{"dictionary":{"motionDetailSquare":{"previewFrame":{"bgColor":"c7c9c7","url":"https:\/\/is1-ssl.mzstatic.com\/image\/thumb\/Video122\/x.png\/{w}x{h}bb.{f}"},"video":"https:\/\/mvod.itunes.apple.com\/itunes-assets\/HLSMusic112\/x\/P1_default.m3u8"}},"cropStyle":"cc"},"title":"LIVING THINGS""#;
        let (motion, still) = parse_motion(html);
        assert!(motion.unwrap().ends_with(".m3u8"));
        let still = still.unwrap();
        assert!(still.contains("mzstatic.com"));
        assert!(still.contains("1200x1200bb.jpg"));
    }

    #[test]
    fn halaman_tanpa_motion_tidak_panic() {
        let (motion, still) = parse_motion(r#"<html><title>album</title></html>"#);
        assert!(motion.is_none() && still.is_none());
    }

    #[test]
    fn upgrade_cover_itunes() {
        assert_eq!(
            upgrade_art("https://is1-ssl.mzstatic.com/image/thumb/x.jpg/100x100bb.jpg"),
            "https://is1-ssl.mzstatic.com/image/thumb/x.jpg/1200x1200bb.jpg"
        );
    }

    #[test]
    fn pick_song_mengutamakan_judul_exact() {
        use serde_json::json;
        let results = vec![
            json!({"trackName": "past life (instrumental)", "artistName": "Ariana Grande"}),
            json!({"trackName": "past life", "artistName": "Ariana Grande", "collectionName": "eternal sunshine deluxe: brighter days ahead"}),
            json!({"trackName": "Past Life", "artistName": "Trevor Daniel & Selena Gomez"}),
        ];
        let best = pick(&results, "trackName", "past life", Some("Ariana Grande")).unwrap();
        assert_eq!(
            best["collectionName"].as_str(),
            Some("eternal sunshine deluxe: brighter days ahead")
        );
    }

    #[test]
    fn pick_tidak_memilih_hasil_pertama_yang_tidak_cocok() {
        use serde_json::json;
        let results = vec![
            json!({"collectionName": "My Everything", "artistName": "Ariana Grande"}),
            json!({"collectionName": "Christmas & Chill - EP", "artistName": "Ariana Grande"}),
        ];
        assert!(pick(&results, "collectionName", "past life", Some("Ariana Grande")).is_none());
    }

    #[test]
    fn pick_album_exact_masih_kerja_untuk_judul_album() {
        use serde_json::json;
        let results = vec![
            json!({"collectionName": "LIVING THINGS", "artistName": "LINKIN PARK"}),
            json!({"collectionName": "Hybrid Theory", "artistName": "LINKIN PARK"}),
        ];
        let best = pick(&results, "collectionName", "LIVING THINGS", Some("LINKIN PARK")).unwrap();
        assert_eq!(best["collectionName"].as_str(), Some("LIVING THINGS"));
    }
}
