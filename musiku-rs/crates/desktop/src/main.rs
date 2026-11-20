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

use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};

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

fn main() {
    // Server di thread sendiri; kembaliannya nomor port begitu siap.
    let port = musiku_server::spawn_background().expect("gagal menjalankan server");
    let url = format!("http://127.0.0.1:{port}");

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![open_external, quit_app])
        .setup(move |app| {
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
