//! Discord Rich Presence — hanya dipakai crate desktop.
//!
//! RPC tanpa autentikasi: cukup Application ID + Discord desktop yang sedang
//! jalan. Koneksi dibuat malas (lazy) saat lagu mulai diputar, dan ditutup
//! sendiri oleh Discord ketika aplikasi keluar. Kalau Discord belum jalan,
//! gagalnya cuma di-log — playback tidak terpengaruh.
//!
//! PENTING: semua socket IPC dikerjakan di thread worker khusus lewat channel.
//! Connect/write ke pipe Discord bisa tertahan (terutama di macOS), dan kalau
//! dilakukan di main thread maka event loop Tauri membeku — app tercatat "Not
//! Responding" persis saat ganti lagu (saat presence diperbarui). Handle
//! `SharedPresence` di sini hanya mengantrikan pesan, jadi tidak blocking.

use std::sync::mpsc::{self, Receiver, Sender};
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

enum PresenceMsg {
    Set(PresencePayload),
    Clear,
}

/// Handle yang dikelola Tauri. Menyalurkannya non-blocking; socket Discord
/// hanya disentuh di thread worker.
#[derive(Clone)]
pub struct SharedPresence {
    tx: Sender<PresenceMsg>,
}

impl SharedPresence {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::channel();
        std::thread::Builder::new()
            .name("discord-presence".into())
            .spawn(move || worker(rx))
            .expect("memulai thread Discord presence");
        Self { tx }
    }

    /// Antrikan pembaruan presence. Aman dipanggil dari command Tauri.
    pub fn set(&self, payload: PresencePayload) {
        let _ = self.tx.send(PresenceMsg::Set(payload));
    }

    pub fn clear(&self) {
        let _ = self.tx.send(PresenceMsg::Clear);
    }
}

/// Satu-satunya pemilik koneksi Discord; berjalan di luar main thread.
fn worker(rx: Receiver<PresenceMsg>) {
    let mut presence = Presence::default();
    while let Ok(msg) = rx.recv() {
        match msg {
            PresenceMsg::Set(p) => presence.set(p),
            PresenceMsg::Clear => presence.clear(),
        }
    }
}

#[derive(Default)]
struct Presence {
    client: Option<DiscordIpcClient>,
    last_try: Option<Instant>,
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
    let authority = url[8..].split(['/', '?', '#']).next()?;
    if authority.is_empty() || authority.contains('@') {
        return None;
    }
    let host = authority.split(':').next()?.to_ascii_lowercase();
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

/// Discord IPC mewajibkan panjang string field `details` / `state` minimal 2
/// karakter (jika ada). Padding spasi mencegah payload ditolak untuk judul
/// 1 karakter (mis. lagu "I" atau "7").
fn pad_min_two(s: String) -> String {
    if s.chars().count() < 2 {
        format!("{s} ")
    } else {
        s
    }
}

fn state_line(artist: Option<String>, album: Option<String>) -> Option<String> {
    let artist = clip(artist);
    let album = clip(album);
    let line = match (artist, album) {
        (Some(a), Some(b)) if a != b => format!("{a} — {b}"),
        (Some(a), _) => a,
        (_, Some(b)) => b,
        _ => return None,
    };
    Some(pad_min_two(line))
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

    fn set(&mut self, payload: PresencePayload) {
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

        let details = clip(Some(payload.title))
            .map(pad_min_two)
            .unwrap_or_else(|| "Musiku".to_string());
        let mut activity = Activity::new()
            .name("Musiku")
            .activity_type(ActivityType::Listening)
            .status_display_type(StatusDisplayType::Details)
            .details(details)
            .timestamps(timestamps)
            .assets(
                Assets::new()
                    .large_image(large_image)
                    .large_text(large_text)
                    .small_image(ICON_ASSET)
                    .small_text("Musiku"),
            );
        if let Some(state) = state_line(payload.artist, payload.album) {
            activity = activity.state(state);
        }

        self.send(activity);
    }

    fn clear(&mut self) {
        // Putuskan koneksinya juga. Cukup mengirim activity=null kadang hanya
        // mengosongkan detail, tapi Discord masih menampilkan "Playing Musiku"
        // selama socket RPC-nya terbuka.
        self.last_try = None;
        let Some(mut client) = self.client.take() else {
            return;
        };
        if let Err(e) = client.clear_activity() {
            eprintln!("[discord] gagal menghapus presence: {e}");
        }
        if let Err(e) = client.close() {
            eprintln!("[discord] gagal menutup RPC: {e}");
        }
    }
}

#[command]
pub fn discord_set_activity(
    payload: PresencePayload,
    state: State<'_, SharedPresence>,
) -> std::result::Result<(), String> {
    state.set(payload);
    Ok(())
}

#[command]
pub fn discord_clear_activity(
    state: State<'_, SharedPresence>,
) -> std::result::Result<(), String> {
    state.clear();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Handle presence harus murni mengantrikan pesan. Kalau ia menyentuh
    /// socket Discord, 50 pembaruan bisa memblokir main thread berbahaya.
    #[test]
    fn presence_command_tidak_memblokir() {
        let sp = SharedPresence::new();
        let started = Instant::now();
        for i in 0..50 {
            sp.set(PresencePayload {
                title: format!("Lagu {i}"),
                artist: None,
                album: None,
                artwork: None,
                position: 0.0,
                duration: 180.0,
            });
        }
        sp.clear();
        assert!(
            started.elapsed() < Duration::from_millis(250),
            "mengirim presence memblokir {}ms",
            started.elapsed().as_millis()
        );
    }

    #[test]
    fn artwork_key_tolak_host_palsu() {
        assert!(artwork_key(Some("https://i.ytimg.com/vi/abc/hqdefault.jpg".into())).is_some());
        assert!(artwork_key(Some("https://evil.com?.ytimg.com".into())).is_none());
        assert!(artwork_key(Some("https://evil.com@i.ytimg.com/a.jpg".into())).is_none());
        assert!(artwork_key(Some("http://i.ytimg.com/a.jpg".into())).is_none());
    }

    #[test]
    fn discord_min_length_dan_state_kosong() {
        assert_eq!(pad_min_two("I".into()), "I ");
        assert_eq!(pad_min_two("OK".into()), "OK");
        assert!(state_line(None, None).is_none());
        assert_eq!(state_line(Some("X".into()), None).as_deref(), Some("X "));
    }
}
