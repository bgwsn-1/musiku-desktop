//! Cache TTL + dedup request in-flight.
//!
//! Meniru `cached()` di `src/lib/music.ts`: hasil disimpan 10 menit, dan kalau
//! ada dua permintaan untuk key yang sama bersamaan, yang kedua menunggu yang
//! pertama (tidak request dua kali ke YouTube).
//!
//! `moka::future::Cache::try_get_with` sudah melakukan keduanya:
//! - `time_to_live` → TTL,
//! - dedup otomatis per-key untuk komputasi yang berjalan bersamaan.
//!
//! Nilai yang gagal (`Err`) **tidak** disimpan — sama seperti TS, di mana
//! exception tidak masuk cache.

use std::time::Duration;

use moka::future::Cache;

/// 10 menit, sama dengan `TTL` di `src/lib/music.ts`.
pub const METADATA_TTL: Duration = Duration::from_secs(10 * 60);

/// Cache generik bertipe nilai JSON.
#[derive(Clone)]
pub struct JsonCache {
    inner: Cache<String, serde_json::Value>,
}

impl JsonCache {
    pub fn new(ttl: Duration) -> Self {
        Self {
            inner: Cache::builder().time_to_live(ttl).build(),
        }
    }

    /// Ambil dari cache, atau jalankan `compute` (sekali saja per key).
    pub async fn get_or_try<F>(&self, key: &str, compute: F) -> anyhow::Result<serde_json::Value>
    where
        F: std::future::Future<Output = anyhow::Result<serde_json::Value>>,
    {
        let key = key.to_string();
        self.inner
            .try_get_with(key, compute)
            .await
            .map_err(|e| anyhow::anyhow!("{e}"))
    }
}

/// Cache string (dipakai resolver URL stream & logo artis).
#[derive(Clone)]
pub struct StrCache {
    inner: Cache<String, String>,
}

impl StrCache {
    pub fn new(ttl: Duration) -> Self {
        Self {
            inner: Cache::builder().time_to_live(ttl).build(),
        }
    }

    pub async fn get_or_try<F>(&self, key: &str, compute: F) -> anyhow::Result<String>
    where
        F: std::future::Future<Output = anyhow::Result<String>>,
    {
        let key = key.to_string();
        self.inner
            .try_get_with(key, compute)
            .await
            .map_err(|e| anyhow::anyhow!("{e}"))
    }
}

/// Isi berkas gambar: tipe konten + byte.
pub type Blob = (String, Vec<u8>);

/// Cache byte berkas.
///
/// Penting untuk host yang membatasi laju (Wikimedia sering membalas
/// `429 Too Many Requests` kalau dihit berulang cepat). Dengan cache ini,
/// gambar yang sama cukup diambil sekali lalu disajikan dari memori.
#[derive(Clone)]
pub struct BytesCache {
    inner: Cache<String, Blob>,
}

impl BytesCache {
    pub fn new(ttl: Duration) -> Self {
        Self {
            inner: Cache::builder().time_to_live(ttl).build(),
        }
    }

    pub async fn get_or_try<F>(&self, key: &str, compute: F) -> anyhow::Result<Blob>
    where
        F: std::future::Future<Output = anyhow::Result<Blob>>,
    {
        let key = key.to_string();
        self.inner
            .try_get_with(key, compute)
            .await
            .map_err(|e| anyhow::anyhow!("{e}"))
    }
}
