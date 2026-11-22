//! Musiku — aplikasi desktop (Tauri).
//!
//! Cara kerja:
//! 1. Server Axum dijalankan **di dalam proses ini** pada port bebas.
//! 2. Jendela Tauri membuka `http://127.0.0.1:<port>`.
//! 3. Karena UI dan API satu origin, pemanggilan `/api/...` relatif bekerja
//!    tanpa CORS — logika client identik dengan versi web.
//!
//! Build: `cargo build -p musiku-desktop` (butuh `libwebkit2gtk-4.1`).

// Di Windows, jangan buka jendela console di belakang UI. Tanpa ini, `.exe`
// ditandai sebagai aplikasi console (`subsystem=3`) dan Windows menampilkan
// jendela hitam kosong. Flag ini membuat PE ditandai GUI (`subsystem=2`).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod discord;

use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};

/// Alamat server lokal dipakai ulang saat membuat jendela lirik mengambang.
struct BaseUrl(String);

const LYRICS_OVERLAY_LABEL: &str = "lyrics-overlay";

/// Buka halaman release di browser sistem. URL di-whitelist supaya command
/// ini nggak bisa dipakai untuk menjalankan program sembarangan.
#[tauri::command]
fn open_external(url: String) -> std::result::Result<(), String> {
    if url != "https://github.com/bgwsn-1/musiku-desktop"
        && !url.starts_with("https://github.com/bgwsn-1/musiku-desktop/")
    {
        return Err("URL tidak diizinkan".into());
    }
    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("rundll32")
        .args(["url.dll,FileProtocolHandler", &url])
        .spawn();
    #[cfg(not(target_os = "windows"))]
    let result = std::process::Command::new("xdg-open").arg(&url).spawn();
    result.map(|_| ()).map_err(|e| e.to_string())
}

/// Installer perlu exe lama ditutup sebelum menimpanya.
#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

/// Buka (atau fokuskan) jendela lirik mengambang. Jendela utama tetap menjadi
/// pemilik audio; overlay hanya memuat UI lirik lewat query `?overlay=lyrics`.
#[tauri::command]
fn open_lyrics_overlay(app: AppHandle, base: State<'_, BaseUrl>) -> Result<(), String> {
    eprintln!("[lyrics-overlay] command dipanggil");
    if let Some(win) = app.get_webview_window(LYRICS_OVERLAY_LABEL) {
        eprintln!("[lyrics-overlay] jendela sudah ada, menampilkan ulang");
        win.show().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let mut target = tauri::Url::parse(&base.0).map_err(|e| e.to_string())?;
    target.set_path("/");
    target.set_query(Some("overlay=lyrics"));
    eprintln!("[lyrics-overlay] membuka {}", target);

    // Jendela biasa yang berdecorasi dipakai di SEMUA platform. Frameless +
    // transparent + always-on-top sering bikin jendela tak terlihat (Wayland,
    // WebView2), jadi untuk sekarang prioritaskan jendela yang benar-benar
    // muncul dan bisa dipindahkan seperti jendela lain.
    // Ukuran dikunci supaya layout lirik tetap presisi (semuanya pakai cqw).
    let win = WebviewWindowBuilder::new(&app, LYRICS_OVERLAY_LABEL, WebviewUrl::External(target))
        .title("Lirik — Musiku")
        .inner_size(360.0, 360.0)
        .resizable(false)
        .decorations(true)
        .visible(true)
        .build()
        .map_err(|e| {
            eprintln!("[lyrics-overlay] gagal membuat jendela: {e}");
            e.to_string()
        })?;
    eprintln!("[lyrics-overlay] jendela berhasil dibuat");
    win.show().map_err(|e| {
        eprintln!("[lyrics-overlay] gagal show: {e}");
        e.to_string()
    })?;
    win.set_focus().map_err(|e| {
        eprintln!("[lyrics-overlay] gagal focus: {e}");
        e.to_string()
    })?;
    Ok(())
}

#[tauri::command]
fn close_lyrics_overlay(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(LYRICS_OVERLAY_LABEL) {
        win.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn main() {
    // Server di thread sendiri; kembaliannya nomor port begitu siap.
    let port = musiku_server::spawn_background().expect("gagal menjalankan server");
    let url = format!("http://127.0.0.1:{port}");
    let discord = discord::SharedPresence::new();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            open_external,
            quit_app,
            open_lyrics_overlay,
            close_lyrics_overlay,
            discord::discord_set_activity,
            discord::discord_clear_activity
        ])
        .setup(move |app| {
            app.manage(discord.clone());
            app.manage(BaseUrl(url.clone()));
            let target: tauri::Url = url.parse().expect("url server tidak valid");
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(target))
                .title("Musiku")
                .inner_size(1040.0, 740.0)
                .min_inner_size(420.0, 520.0)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("gagal menjalankan Musiku");
}
