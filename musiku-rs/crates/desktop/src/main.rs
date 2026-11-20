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

use tauri::{WebviewUrl, WebviewWindowBuilder};

fn main() {
    // Server di thread sendiri; kembaliannya nomor port begitu siap.
    let port = musiku_server::spawn_background().expect("gagal menjalankan server");
    let url = format!("http://127.0.0.1:{port}");

    tauri::Builder::default()
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
