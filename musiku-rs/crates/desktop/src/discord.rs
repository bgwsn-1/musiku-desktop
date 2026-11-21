//! Discord Rich Presence — hanya dipakai crate desktop.
//!
//! RPC tanpa autentikasi: cukup Application ID + Discord desktop yang sedang
//! jalan. Koneksi dibuat malas (lazy) saat lagu mulai diputar, dan ditutup
//! sendiri oleh Discord ketika aplikasi keluar. Kalau Discord belum jalan,
//! gagalnya cuma di-log — playback tidak terpengaruh.

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use discord_rich_presence::{
    activity::{Activity, ActivityType, Assets, StatusDisplayType, Timestamps},
    DiscordIpc, DiscordIpcClient,
};
use serde::Deserialize;
use tauri::{command, State};

const CLIENT_ID: &str = "1573677271888298104";
const ICON_ASSET: &str = "musiku_icon";
const RETRY_AFTER: Duration = Duration::from_secs(5);
const MAX_FIELD: usize = 120;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresencePayload {
    pub title: String,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub artwork: Option<String>,
    /// Posisi putar dalam detik.
    pub position: f64,
    /// Durasi lagu dalam detik; 0 kalau belum diketahui.
    pub duration: f64,
}

pub type SharedPresence = Arc<Mutex<Presence>>;

pub struct Presence {
    client: Option<DiscordIpcClient>,
    last_try: Option<Instant>,
}

impl Default for Presence {
    fn default() -> Self {
        Self {
            client: None,
            last_try: None,
        }
    }
}

fn clip(value: Option<String>) -> Option<String> {
    let s = value?.trim().to_string();
    if s.is_empty() {
        return None;
    }
    Some(s.chars().take(MAX_FIELD).collect())
}

fn artwork_key(url: Option<String>) -> Option<String> {
    let url = url?;
    if !url.starts_with("https://") || url.len() > 512 {
        return None;
    }
    let host = url[8..].split('/').next()?.to_ascii_lowercase();
    let allowed = [
        "ytimg.com",
        "ggpht.com",
        "googleusercontent.com",
        "mzstatic.com",
        "apple.com",
    ];
    let known = allowed
        .iter()
        .any(|h| host == *h || host.ends_with(&format!(".{h}")));
    known.then_some(url)
}

fn state_line(artist: Option<String>, album: Option<String>) -> Option<String> {
    let artist = clip(artist);
    let album = clip(album);
    match (artist, album) {
        (Some(a), Some(b)) if a != b => Some(format!("{a} — {b}")),
        (Some(a), _) => Some(a),
        (_, Some(b)) => Some(b),
        _ => None,
    }
}

impl Presence {
    fn connect(&mut self) -> bool {
        if self.client.is_some() {
            return true;
        }
        if self
            .last_try
            .is_some_and(|at| at.elapsed() < RETRY_AFTER)
        {
            return false;
        }
        self.last_try = Some(Instant::now());
        let mut client = DiscordIpcClient::new(CLIENT_ID);
        match client.connect() {
            Ok(()) => {
                self.client = Some(client);
                self.last_try = None;
                true
            }
            Err(e) => {
                eprintln!("[discord] RPC tidak tersedia: {e}");
                false
            }
        }
    }

    fn send(&mut self, activity: Activity<'static>) {
        if !self.connect() {
            return;
        }
        let result = self.client.as_mut().and_then(|client| client.set_activity(activity).ok());
        if result.is_none() {
            // Discord bisa keluar mendadak; buang koneksi supaya dicoba lagi.
            self.client = None;
            self.last_try = Some(Instant::now());
        }
    }

    pub fn set(&mut self, payload: PresencePayload) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;
        let position = if payload.position.is_finite() {
            payload.position.max(0.0)
        } else {
            0.0
        };
        let duration = if payload.duration.is_finite() {
            payload.duration.max(0.0)
        } else {
            0.0
        };
        let pos_ms = (position * 1000.0) as i64;
        let dur_ms = (duration * 1000.0) as i64;

        let mut timestamps = Timestamps::new().start(now - pos_ms);
        if dur_ms > pos_ms {
            timestamps = timestamps.end(now + (dur_ms - pos_ms));
        }

        let large_image = artwork_key(payload.artwork).unwrap_or_else(|| ICON_ASSET.to_string());
        let large_text = clip(payload.album.clone())
            .or_else(|| clip(Some(payload.title.clone())))
            .unwrap_or_else(|| "Musiku".to_string());

        let activity = Activity::new()
            .name("Musiku")
            .activity_type(ActivityType::Listening)
            .status_display_type(StatusDisplayType::Details)
            .details(clip(Some(payload.title)).unwrap_or_else(|| "Musiku".to_string()))
            .state(state_line(payload.artist, payload.album).unwrap_or_default())
            .timestamps(timestamps)
            .assets(
                Assets::new()
                    .large_image(large_image)
                    .large_text(large_text)
                    .small_image(ICON_ASSET)
                    .small_text("Musiku"),
            );

        self.send(activity);
    }

    pub fn clear(&mut self) {
        if let Some(client) = self.client.as_mut() {
            if let Err(e) = client.clear_activity() {
                eprintln!("[discord] gagal menghapus presence: {e}");
                self.client = None;
            }
        }
    }
}

#[command]
pub fn discord_set_activity(
    payload: PresencePayload,
    state: State<'_, SharedPresence>,
) -> std::result::Result<(), String> {
    let mut guard = state.lock().map_err(|_| "state terkunci".to_string())?;
    guard.set(payload);
    Ok(())
}

#[command]
pub fn discord_clear_activity(
    state: State<'_, SharedPresence>,
) -> std::result::Result<(), String> {
    let mut guard = state.lock().map_err(|_| "state terkunci".to_string())?;
    guard.clear();
    Ok(())
}
