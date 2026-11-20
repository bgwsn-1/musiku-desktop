//! Resolver stream lewat InnerTube (client VISIONOS).
//!
//! Kenapa tidak memakai `rustypipe` untuk ini?
//!
//! `rustypipe` mengambil URL stream dengan mendeobfuscate player.js YouTube
//! (signature + parameter `n`). Per 2026 deobfuscator-nya **gagal** untuk
//! client web/Android/TV (lihat `deobfuscation error: could not get deobf
//! data`), jadi ia jatuh ke client **iOS**. URL client iOS membawa tanda
//! tangan yang ter-throttle: hanya ~1,15 MB pertama yang bisa diakses, di
//! atasnya googlevideo membalas `403`. Akibatnya lagu muter sebentar lalu
//! mati, dan seek selalu gagal.
//!
//! Versi TS (`src/lib/stream.ts`) tidak kena masalah ini karena memakai
//! `@distube/ytdl-core`, yang meminta player data dengan client **VISIONOS**
//! (Apple Vision Pro). Client itu tidak butuh player.js sama sekali dan
//! mengembalikan URL yang **bisa diakses penuh**. Modul ini meniru langkah
//! itu 1:1: satu POST ke `youtubei/v1/player` + visitor data dari
//! `youtube.com/sw.js_data`.
//!
//! Yang dipakai modul lain cuma [`best_audio_url`] dan [`best_video_url`],
//! jadi bentuk responsnya tidak pernah bocor ke UI.

use std::sync::OnceLock;
use std::time::Duration;

use anyhow::{anyhow, Result};
use serde_json::{json, Value};

use crate::cache::StrCache;
use crate::music::global;

// ── Identitas client VISIONOS ────────────────────────────────────────────
// Nilai-nilai ini diambil dari `@distube/ytdl-core` (dist/clients.js) supaya
// cocok dengan yang dipakai versi web. Kalau YouTube menolaknya, cukup
// perbarui `CLIENT_VERSION` / `USER_AGENT` dari sumber itu.

const CLIENT_NAME: &str = "VISIONOS";
const CLIENT_VERSION: &str = "1.02";
const CLIENT_NAME_ID: &str = "101";
const USER_AGENT: &str =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";

/// visitor data berlaku lama; simpan 6 jam supaya tidak fetch tiap lagu.
const VISITOR_TTL: Duration = Duration::from_secs(6 * 60 * 60);

static VISITOR: OnceLock<StrCache> = OnceLock::new();

fn visitor_cache() -> &'static StrCache {
    VISITOR.get_or_init(|| StrCache::new(VISITOR_TTL))
}

/// Ambil `visitorData` dari `youtube.com/sw.js_data`.
///
/// Tanpa visitor data, client mana pun menjawab
/// `LOGIN_REQUIRED` / "confirm you're not a bot".
async fn fetch_visitor_data() -> Result<String> {
    let text = global()
        .http()
        .get("https://www.youtube.com/sw.js_data")
        .header("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")
        .send()
        .await?
        .error_for_status()?
        .text()
        .await?;

    // Responsnya `)]}'` di depan lalu JSON.
    let json_text = text.trim_start_matches(")]}'").trim_start();
    let parsed: Value = serde_json::from_str(json_text)?;

    // Bentuk yang diharapkan: `[0][2][0][0][13]` — sama dengan
    // `at(parsed, 0, 2, 0, 0, 13)` di distube. Kalau berubah, cari string
    // mirip visitor id sebagai cadangan.
    if let Some(v) = parsed
        .get(0)
        .and_then(|x| x.get(2))
        .and_then(|x| x.get(0))
        .and_then(|x| x.get(0))
        .and_then(|x| x.get(13))
        .and_then(Value::as_str)
    {
        if !v.is_empty() {
            return Ok(v.to_string());
        }
    }

    // Cadangan: telusuri nilai string yang diawali "Cg" dan cukup panjang.
    fn scan(v: &Value) -> Option<String> {
        match v {
            Value::String(s)
                if s.starts_with("Cg") && s.len() > 40 && !s.contains('/') =>
            {
                Some(s.clone())
            }
            Value::Array(a) => a.iter().find_map(scan),
            _ => None,
        }
    }
    scan(&parsed).ok_or_else(|| anyhow!("visitorData tidak ditemukan di sw.js_data"))
}

async fn visitor_data() -> Result<String> {
    visitor_cache()
        .get_or_try("visitor", async { fetch_visitor_data().await })
        .await
}

/// Panggil `youtubei/v1/player` dengan client VISIONOS. Respons mentah.
pub async fn player(video_id: &str) -> Result<Value> {
    let visitor = visitor_data().await?;

    let body = json!({
        "context": {
            "client": {
                "clientName": CLIENT_NAME,
                "clientVersion": CLIENT_VERSION,
                "deviceMake": "Apple",
                "deviceModel": "RealityDevice17,1",
                "osName": "visionOS",
                "osVersion": "26.5.23O471",
                "userAgent": USER_AGENT,
                "hl": "en",
                "gl": "US",
                "visitorData": visitor,
            }
        },
        "videoId": video_id,
        "contentCheckOk": true,
        "racyCheckOk": true,
        "playbackContext": {
            "contentPlaybackContext": {
                "html5Preference": "HTML5_PREF_WANTS"
            }
        }
    });

    let resp: Value = global()
        .http()
        .post("https://www.youtube.com/youtubei/v1/player?prettyPrint=false")
        .header("content-type", "application/json")
        .header("user-agent", USER_AGENT)
        .header("x-youtube-client-name", CLIENT_NAME_ID)
        .header("x-youtube-client-version", CLIENT_VERSION)
        .header("x-goog-visitor-id", visitor)
        .header("origin", "https://www.youtube.com")
        .json(&body)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    // Status pemutaran: OK / LOGIN_REQUIRED / UNPLAYABLE dll.
    if let Some(status) = resp
        .get("playabilityStatus")
        .and_then(|p| p.get("status"))
        .and_then(Value::as_str)
    {
        if status != "OK" {
            let reason = resp
                .pointer("/playabilityStatus/reason")
                .and_then(Value::as_str)
                .unwrap_or("");
            return Err(anyhow!("playability {status}: {reason}"));
        }
    }

    Ok(resp)
}

/// Iterasi `streamingData.adaptiveFormats` yang punya `url` langsung.
fn adaptive_formats(resp: &Value) -> Vec<&Value> {
    resp.pointer("/streamingData/adaptiveFormats")
        .and_then(Value::as_array)
        .map(|a| {
            a.iter()
                .filter(|f| f.get("url").and_then(Value::as_str).is_some())
                .collect()
        })
        .unwrap_or_default()
}

fn mime(f: &Value) -> &str {
    f.get("mimeType").and_then(Value::as_str).unwrap_or("")
}

fn num(f: &Value, key: &str) -> i64 {
    f.get(key).and_then(Value::as_i64).unwrap_or(0)
}

/// URL audio terbaik: utamakan **m4a/AAC** (bisa diputar di semua browser,
/// termasuk Safari), lalu bitrate rata-rata tertinggi. Sama dengan peringkat
/// di `src/lib/stream.ts` (`container: "mp4"` dulu).
pub fn best_audio_url(resp: &Value) -> Option<String> {
    let formats = adaptive_formats(resp);
    let audio: Vec<&Value> = formats
        .into_iter()
        .filter(|f| mime(f).starts_with("audio/") && !mime(f).contains("drm"))
        .collect();

    let score = |f: &&Value| {
        let is_m4a_aac = mime(f).starts_with("audio/mp4") as i64;
        (is_m4a_aac, num(f, "averageBitrate"), num(f, "bitrate"))
    };

    audio
        .iter()
        .max_by_key(|f| score(f))
        .or_else(|| audio.first())
        .and_then(|f| f.get("url").and_then(Value::as_str))
        .map(str::to_string)
}

/// URL video-only terbaik: mp4/H.264 (`avc1`) ≤720p, sama dengan
/// `resolveVideoStream()` di TS. Kalau tidak ada yang ≤720p, ambil yang
/// paling rendah (paling ringan); kalau tidak ada avc1 sama sekali, pakai
/// mp4 apa pun.
pub fn best_video_url(resp: &Value) -> Option<String> {
    let formats = adaptive_formats(resp);
    let video_only: Vec<&Value> = formats
        .into_iter()
        .filter(|f| {
            let m = mime(f);
            m.starts_with("video/") && !m.contains("drm")
        })
        .collect();

    let avc_mp4: Vec<&Value> = video_only
        .iter()
        .copied()
        .filter(|f| mime(f).starts_with("video/mp4") && mime(f).contains("avc1"))
        .collect();

    let chosen = avc_mp4
        .iter()
        .copied()
        .filter(|f| num(f, "height") <= 720)
        .max_by_key(|f| num(f, "height"))
        .or_else(|| avc_mp4.iter().copied().min_by_key(|f| num(f, "height")))
        .or_else(|| video_only.iter().copied().find(|f| mime(f).starts_with("video/mp4")))
        .or_else(|| video_only.first().copied());

    chosen
        .and_then(|f| f.get("url").and_then(Value::as_str))
        .map(str::to_string)
}

/// itag audio (untuk diagnostik/tests).
pub fn audio_itag(resp: &Value) -> i64 {
    adaptive_formats(resp)
        .iter()
        .filter(|f| mime(f).starts_with("audio/mp4"))
        .filter_map(|f| f.get("itag").and_then(Value::as_i64))
        .next()
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Respons tiruan berisi audio m4a/opus + video avc1 1080p & 360p.
    fn sample() -> Value {
        json!({
            "playabilityStatus": { "status": "OK" },
            "streamingData": {
                "adaptiveFormats": [
                    { "itag": 251, "mimeType": "audio/webm; codecs=\"opus\"",
                      "averageBitrate": 138770, "url": "https://x/opus" },
                    { "itag": 140, "mimeType": "audio/mp4; codecs=\"mp4a.40.2\"",
                      "averageBitrate": 129566, "url": "https://x/m4a" },
                    { "itag": 137, "mimeType": "video/mp4; codecs=\"avc1.640020\"",
                      "height": 1080, "url": "https://x/1080" },
                    { "itag": 134, "mimeType": "video/mp4; codecs=\"avc1.4D4015\"",
                      "height": 360, "url": "https://x/360" },
                    { "itag": 244, "mimeType": "video/webm; codecs=\"vp9\"",
                      "height": 480, "url": "https://x/vp9" },
                ]
            }
        })
    }

    #[test]
    fn audio_utamakan_m4a_walau_bitrate_opuss_lebih_tinggi() {
        // 251 (opus) bitrate 138k > 140 (m4a) 129k, tapi m4a menang karena
        // bisa diputar di Safari — sama seperti versi TS.
        assert_eq!(best_audio_url(&sample()).as_deref(), Some("https://x/m4a"));
    }

    #[test]
    fn video_pilih_avc1_tertinggi_di_bawah_720p() {
        // 137 (1080p) di atas batas; 134 (360p) yang dipakai. vp9 diabaikan.
        assert_eq!(best_video_url(&sample()).as_deref(), Some("https://x/360"));
    }

    #[test]
    fn video_tanpa_avc1_72_jatuh_ke_mp4_apa_pun() {
        let v = json!({
            "streamingData": { "adaptiveFormats": [
                { "itag": 244, "mimeType": "video/webm; codecs=\"vp9\"", "height": 480, "url": "https://x/vp9" },
                { "itag": 136, "mimeType": "video/mp4; codecs=\"avc1.4D401F\"", "height": 900, "url": "https://x/900" },
            ]}
        });
        assert_eq!(best_video_url(&v).as_deref(), Some("https://x/900"));
    }

    #[test]
    fn format_tanpa_url_langsung_diabaikan() {
        // Format yang cuma punya signatureCipher (tanpa `url`) harus di-skip.
        let v = json!({
            "streamingData": { "adaptiveFormats": [
                { "itag": 140, "mimeType": "audio/mp4", "averageBitrate": 129566,
                  "signatureCipher": "s=abc" },
                { "itag": 139, "mimeType": "audio/mp4", "averageBitrate": 48859,
                  "url": "https://x/139" },
            ]}
        });
        assert_eq!(best_audio_url(&v).as_deref(), Some("https://x/139"));
    }

    #[test]
    fn itag_audio_m4a_pertama() {
        assert_eq!(audio_itag(&sample()), 140);
    }
}

