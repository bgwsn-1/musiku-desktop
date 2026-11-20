//! Port dari `src/lib/types.ts`.
//!
//! Nama field JSON dipertahankan camelCase supaya frontend yang sudah ada
//! bisa mengonsumsi output ini tanpa perubahan.

use serde::{Deserialize, Serialize};

// Catatan: field opsional di TS biasanya `undefined` kalau nggak ada, dan
// `JSON.stringify` membuang field `undefined`. Jadi `None` di-skip saat
// serialisasi supaya bentuk JSON-nya paling dekat dengan versi sekarang.

/// `Track` — menyamai objek yang dibikin `toTrack()` di `src/lib/music.ts`.
///
/// Penting: TS **selalu** menuliskan key ini (dengan `null` bila kosong),
/// karena `?? null` menghasilkan `null` yang tetap diserialisasi
/// `JSON.stringify` (beda dengan `undefined` yang dibuang). Jadi di sini
/// field-field itu **tidak** di-skip — supaya bentuk JSON-nya identik.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub video_id: String,
    pub title: String,
    pub artist: Option<String>,
    /// Di TS: `artist?.name ? [artist.name] : []` — selalu array, tak pernah null.
    #[serde(default)]
    pub artists: Vec<String>,
    pub artist_id: Option<String>,
    pub album: Option<String>,
    pub album_id: Option<String>,
    /// Di TS: `string | number | null`. Kita pakai enum yang bisa dua-duanya.
    pub duration: Option<Duration>,
    pub thumbs: Option<String>,
    /// Hanya diisi kalau ada (di `toTrack` tidak pernah diset).
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub is_explicit: Option<bool>,
    /// Hanya ada di hasil search (`"song"` / `"video"`).
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub result_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub views: Option<String>,
}

/// `duration?: string | number | null` — dukung dua bentuk.
/// `Secs` pakai `u64` supaya JSON-nya bilangan bulat (sama seperti TS).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum Duration {
    Secs(u64),
    Text(String),
}

impl Duration {
    pub fn as_text(&self) -> String {
        match self {
            Duration::Secs(s) => format_secs(*s as f64),
            Duration::Text(t) => t.clone(),
        }
    }
}

/// Format detik → `m:ss` atau `h:mm:ss`, menyamai `src/lib/timefmt.ts`.
pub fn format_secs(total: f64) -> String {
    let t = if total.is_finite() && total > 0.0 {
        total.floor() as u64
    } else {
        0
    };
    let (h, m, s) = (t / 3600, (t % 3600) / 60, t % 60);
    if h > 0 {
        format!("{h}:{m:02}:{s:02}")
    } else {
        format!("{m}:{s:02}")
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AlbumSummary {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub browse_id: Option<String>,
    pub title: String,
    /// Di TS: `string[] | string | null`.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub artist: Option<ArtistName>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub year: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub thumbs: Option<String>,
}

/// `string[] | string` — dukung dua bentuk (sama seperti TS).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum ArtistName {
    One(String),
    Many(Vec<String>),
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AlbumDetail {
    #[serde(flatten)]
    pub summary: AlbumSummary,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub artist_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub total: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub duration: Option<String>,
    pub tracks: Vec<Track>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ArtistDetail {
    pub browse_id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub desc: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub thumbs: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub avatar: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub banner: Option<String>,
    /// Video musik resmi untuk header animasi.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub top_video_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub subscribers: Option<Count>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub monthly_listeners: Option<Count>,
    pub top_songs: Vec<Track>,
    pub albums: Vec<AlbumSummary>,
    pub singles: Vec<AlbumSummary>,
}

/// `string | number` untuk subscriber / monthly listener.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum Count {
    Num(f64),
    Text(String),
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HomeItem {
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub video_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub browse_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub artist: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub artist_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub thumbs: Option<String>,
    /// Di TS: `"album" | "song"`.
    pub kind: HomeItemKind,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum HomeItemKind {
    Album,
    #[default]
    Song,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct HomeShelf {
    pub title: String,
    pub items: Vec<HomeItem>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct Lyrics {
    pub text: Option<String>,
    pub synced: bool,
    pub source: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub created_at: f64,
    pub tracks: Vec<Track>,
}

/// Sama dengan `LocalSong = Track` di TS.
pub type LocalSong = Track;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn track_keeps_null_keys_like_json_stringify() {
        let t = Track {
            video_id: "abc".into(),
            title: "Lagu".into(),
            ..Default::default()
        };
        let s = serde_json::to_string(&t).unwrap();
        assert!(s.contains("\"videoId\":\"abc\""), "{s}");
        // TS menulis `artist: null`, bukan menghapus key-nya.
        assert!(s.contains("\"artist\":null"), "{s}");
        assert!(s.contains("\"artists\":[]"), "{s}");
        // `resultType` tidak ada di `toTrack`, jadi memang dibuang.
        assert!(!s.contains("resultType"), "{s}");
    }

    #[test]
    fn duration_accepts_both_shapes() {
        let a: Duration = serde_json::from_str("210").unwrap();
        let b: Duration = serde_json::from_str("\"3:30\"").unwrap();
        assert_eq!(a, Duration::Secs(210));
        assert_eq!(b, Duration::Text("3:30".into()));
    }

    #[test]
    fn duration_serializes_as_integer_not_float() {
        let d = Duration::Secs(324);
        assert_eq!(serde_json::to_string(&d).unwrap(), "324");
    }

    #[test]
    fn timefmt_matches_ts() {
        assert_eq!(format_secs(0.0), "0:00");
        assert_eq!(format_secs(59.9), "0:59");
        assert_eq!(format_secs(210.0), "3:30");
        assert_eq!(format_secs(3661.0), "1:01:01");
    }

    #[test]
    fn album_detail_flattens_summary() {
        let d = AlbumDetail {
            summary: AlbumSummary {
                browse_id: Some("MPRE".into()),
                title: "Album".into(),
                ..Default::default()
            },
            tracks: vec![],
            ..Default::default()
        };
        let s = serde_json::to_string(&d).unwrap();
        assert!(s.contains("\"browseId\":\"MPRE\""), "{s}");
        assert!(s.contains("\"title\":\"Album\""), "{s}");
    }
}
