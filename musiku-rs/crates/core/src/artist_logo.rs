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

/// URL thumbnail Wikimedia Commons lewat `Special:FilePath` dengan percent-encoding
/// yang benar untuk nama berkas berkarakter khusus (`%`, `#`, `?`, `&`, Unicode).
/// Wikimedia otomatis merender SVG ke PNG 500px dan melayani gambar raster kecil
/// tanpa membalas 404.
fn commons_thumb(file: &str) -> String {
    let clean = file.trim().replace(' ', "_");
    let mut url = reqwest::Url::parse("https://commons.wikimedia.org/wiki/Special:FilePath/")
        .expect("url commons valid");
    if let Ok(mut segs) = url.path_segments_mut() {
        segs.pop_if_empty();
        segs.push(&clean);
    }
    url.query_pairs_mut().append_pair("width", "500");
    url.into()
}

/// Logo dari Wikidata (klaim P154 pada entitas artis pertama yang cocok).
/// Mengembalikan `Err` untuk kegagalan jaringan/HTTP agar tidak di-cache
/// sebagai hasil kosong selama 24 jam.
async fn wikidata_logo(name: &str) -> anyhow::Result<Option<String>> {
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
        .await?
        .error_for_status()?
        .json()
        .await?;

    let Some(entity_id) = found
        .get("search")
        .and_then(|v| v.as_array())
        .and_then(|arr| {
            arr.iter().find(|s| {
                let desc = s
                    .get("description")
                    .and_then(|d| d.as_str())
                    .unwrap_or("")
                    .to_ascii_lowercase();
                !desc.contains("disambiguation") && music_desc().is_match(&desc)
            })
        })
        .and_then(|s| s.get("id"))
        .and_then(|id| id.as_str())
        .map(str::to_string)
    else {
        return Ok(None);
    };

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
        .await?
        .error_for_status()?
        .json()
        .await?;

    let Some(file) = claims
        .get("claims")
        .and_then(|c| c.get("P154"))
        .and_then(|p| p.as_array())
        .and_then(|a| a.first())
        .and_then(|x| x.get("mainsnak"))
        .and_then(|x| x.get("datavalue"))
        .and_then(|x| x.get("value"))
        .and_then(|x| x.as_str())
    else {
        return Ok(None);
    };

    if file.is_empty() {
        return Ok(None);
    }
    Ok(Some(commons_thumb(file)))
}

/// Logo dari TheAudioDB (API publik, kunci tier gratis `123`).
async fn tadb_logo(name: &str) -> anyhow::Result<Option<String>> {
    let data: Value = global()
        .http()
        .get("https://www.theaudiodb.com/api/v1/json/123/search.php")
        .query(&[("s", name)])
        .header("user-agent", UA)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let found = data
        .get("artists")
        .and_then(|v| v.as_array())
        .and_then(|arr| {
            arr.iter()
                .find_map(|a| a.get("strArtistLogo").and_then(|v| v.as_str()))
        })
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    Ok(found)
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
            let mut last_err: Option<anyhow::Error> = None;

            match wikidata_logo(name).await {
                Ok(Some(u)) => out.push(u),
                Ok(None) => {}
                Err(e) => last_err = Some(e),
            }
            match tadb_logo(name).await {
                Ok(Some(u)) => out.push(u),
                Ok(None) => {}
                Err(e) => last_err = Some(e),
            }

            // Jangan cache hasil kosong 24 jam jika sumber gagal karena error jaringan/429.
            if out.is_empty() {
                if let Some(e) = last_err {
                    return Err(e);
                }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn commons_thumb_encode_karakter_khusus() {
        let u = commons_thumb("P!nk & 100% #1? logo.svg");
        assert!(u.starts_with("https://commons.wikimedia.org/wiki/Special:FilePath/"));
        assert!(u.ends_with("?width=500"));
        assert!(u.contains("%25"));
        assert!(u.contains("%23"));
        assert!(u.contains("%3F"));
    }
}
