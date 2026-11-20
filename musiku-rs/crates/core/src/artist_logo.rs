//! Port dari `src/lib/artistLogo.ts` — wordmark artis.
//!
//! Dua sumber, dicoba berurutan:
//!  1. Wikidata klaim "logo image" (P154) → wordmark resmi di Wikimedia Commons.
//!  2. TheAudioDB `strArtistLogo`.
//!
//! Cache 24 jam + dedup, sama seperti versi TS.

use std::sync::OnceLock;
use std::time::Duration;

use regex::Regex;
use serde_json::Value;

use crate::cache::StrCache;
use crate::music::{global, UA};

const TTL: Duration = Duration::from_secs(24 * 60 * 60);

static LOGO: OnceLock<StrCache> = OnceLock::new();

fn cache() -> &'static StrCache {
    LOGO.get_or_init(|| StrCache::new(TTL))
}

/// Deskripsi harus terdengar musikal — hindari orang/kontra/negara bernama sama.
fn music_desc() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(
            r"(?i)(rapper|singer|musician|band|dj|group|artist|songwriter|producer|vocalist|duo|trio)",
        )
        .unwrap()
    })
}

/// URL thumbnail langsung dari upload.wikimedia.org. Lebar harus salah satu
/// ukuran tetap yang diizinkan Wikimedia, bukan angka bebas.
fn commons_thumb(file: &str) -> String {
    let clean = file.replace(' ', "_");
    let h = format!("{:x}", md5::compute(&clean));
    let is_svg = clean.to_ascii_lowercase().ends_with(".svg");
    format!(
        "https://upload.wikimedia.org/wikipedia/commons/thumb/{}/{}/{}/500px-{}{}",
        &h[0..1],
        &h[0..2],
        clean,
        clean,
        if is_svg { ".png" } else { "" }
    )
}

/// Logo dari Wikidata (klaim P154 pada entitas artis pertama yang cocok).
async fn wikidata_logo(name: &str) -> Option<String> {
    let http = global().http();

    let found: Value = http
        .get("https://www.wikidata.org/w/api.php")
        .query(&[
            ("action", "wbsearchentities"),
            ("search", name),
            ("language", "en"),
            ("format", "json"),
            ("limit", "5"),
            ("type", "item"),
        ])
        .header("user-agent", UA)
        .send()
        .await
        .ok()?
        .json()
        .await
        .ok()?;

    let entity_id = found
        .get("search")
        .and_then(|v| v.as_array())?
        .iter()
        .find(|s| {
            let desc = s
                .get("description")
                .and_then(|d| d.as_str())
                .unwrap_or("")
                .to_ascii_lowercase();
            !desc.contains("disambiguation") && music_desc().is_match(&desc)
        })?
        .get("id")?
        .as_str()?
        .to_string();

    let claims: Value = http
        .get("https://www.wikidata.org/w/api.php")
        .query(&[
            ("action", "wbgetclaims"),
            ("entity", &entity_id),
            ("property", "P154"),
            ("format", "json"),
        ])
        .header("user-agent", UA)
        .send()
        .await
        .ok()?
        .json()
        .await
        .ok()?;

    let file = claims
        .get("claims")?
        .get("P154")?
        .as_array()?
        .first()?
        .get("mainsnak")?
        .get("datavalue")?
        .get("value")?
        .as_str()?;

    if file.is_empty() {
        return None;
    }
    Some(commons_thumb(file))
}

/// Logo dari TheAudioDB (API publik, kunci tier gratis `123`).
async fn tadb_logo(name: &str) -> Option<String> {
    let data: Value = global()
        .http()
        .get("https://www.theaudiodb.com/api/v1/json/123/search.php")
        .query(&[("s", name)])
        .header("user-agent", UA)
        .send()
        .await
        .ok()?
        .json()
        .await
        .ok()?;

    data.get("artists")?
        .as_array()?
        .iter()
        .find_map(|a| a.get("strArtistLogo").and_then(|v| v.as_str()))
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

/// Cari wordmark artis. `Ok(None)` kalau tidak ada di kedua sumber.
pub async fn artist_logo(name: &str) -> anyhow::Result<Option<String>> {
    Ok(artist_logo_candidates(name)
        .await?
        .into_iter()
        .next())
}

/// Semua kandidat URL logo, berurutan: Wikidata dulu, lalu TheAudioDB.
///
/// Dikembalikan sebagai daftar (bukan satu URL) supaya pemanggil bisa
/// **mencoba berikutnya kalau sumber pertama membalas 429/404** — Wikimedia
/// sering membatasi laju, dan TheAudioDB biasanya tetap bisa.
pub async fn artist_logo_candidates(name: &str) -> anyhow::Result<Vec<String>> {
    let key = format!("cand:{}", name.trim().to_ascii_lowercase());

    // StrCache menyimpan satu string; kandidat digabung dengan newline.
    let joined = cache()
        .get_or_try(&key, async {
            let mut out: Vec<String> = Vec::new();
            if let Some(u) = wikidata_logo(name).await {
                out.push(u);
            }
            if let Some(u) = tadb_logo(name).await {
                out.push(u);
            }
            Ok(out.join("\n"))
        })
        .await?;

    Ok(joined
        .split('\n')
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect())
}
