//! Port dari `src/lib/stream.ts` — resolver URL audio/video.
//!
//! Meniru perilaku versi TS:
//! - cache URL hasil resolve selama 30 menit (`TTL`),
//! - **dedup** permintaan yang bersamaan (satu lagu tidak di-resolve dua kali),
//! - utamakan **m4a/AAC** supaya bisa diputar di Safari,
//! - video header artis: mp4/H.264 ≤720p.
//!
//! Pengambilan URL tidak lewat `rustypipe` (URL-nya ter-throttle, lihat
//! `crate::player`), melainkan lewat client **VISIONOS** — sama seperti
//! `@distube/ytdl-core` di versi TS.

use std::sync::OnceLock;
use std::time::Duration;

use anyhow::{anyhow, Result};

use crate::cache::StrCache;
use crate::player;

/// URL googlevideo berlaku beberapa jam; segarkan tiap 30 menit.
const TTL: Duration = Duration::from_secs(30 * 60);

static AUDIO: OnceLock<StrCache> = OnceLock::new();
static VIDEO: OnceLock<StrCache> = OnceLock::new();

fn audio_cache() -> &'static StrCache {
    AUDIO.get_or_init(|| StrCache::new(TTL))
}
fn video_cache() -> &'static StrCache {
    VIDEO.get_or_init(|| StrCache::new(TTL))
}

/// Resolve URL stream audio (m4a/AAC diutamakan).
pub async fn resolve_audio(video_id: &str) -> Result<String> {
    audio_cache()
        .get_or_try(video_id, async {
            let resp = player::player(video_id).await?;
            player::best_audio_url(&resp)
                .ok_or_else(|| anyhow!("tidak ada stream audio untuk {video_id}"))
        })
        .await
}

/// Resolve URL stream video-only (mp4/H.264 ≤720p) untuk header artis.
pub async fn resolve_video(video_id: &str) -> Result<String> {
    video_cache()
        .get_or_try(video_id, async {
            let resp = player::player(video_id).await?;
            player::best_video_url(&resp)
                .ok_or_else(|| anyhow!("tidak ada stream video untuk {video_id}"))
        })
        .await
}

/// Validasi id video — sama dengan `/^[\w-]{6,25}$/` di route TS.
pub fn valid_video_id(id: &str) -> bool {
    let len = id.len();
    (6..=25).contains(&len) && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

/// itag audio yang dipilih (diagnostik/tests).
pub async fn audio_itag(video_id: &str) -> Result<i64> {
    let resp = player::player(video_id).await?;
    let itag = player::audio_itag(&resp);
    if itag == 0 {
        Err(anyhow!("tidak ada itag audio"))
    } else {
        Ok(itag)
    }
}
