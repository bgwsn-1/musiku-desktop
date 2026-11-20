//! Musiku core — port dari `src/lib/*.ts` (web) ke Rust.
//!
//! Modul ini dipakai bersama oleh dua "wajah":
//! - `musiku-server`  → server Axum untuk web / jendela Tauri
//! - shell desktop    → aplikasi Tauri (`.exe`)
//!
//! Aturan: bentuk JSON tiap tipe & endpoint harus identik dengan versi TS,
//! supaya sisi UI tidak perlu diubah.

pub mod artist_logo;
pub mod cache;
pub mod music;
pub mod player;
pub mod stream;
pub mod types;
pub mod ytmusic;
