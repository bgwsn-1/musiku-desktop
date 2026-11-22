//! Pemeriksa pembaruan dari GitHub Release.
//!
//! Tidak memakai Tauri updater plugin (butuh signing key + artefak `.sig` dari
//! CI). GitHub API sudah mengembalikan `digest: sha256:...` untuk tiap aset,
//! jadi cukup unduh + verifikasi hash sebelum menjalankan apa pun.

use anyhow::{anyhow, bail, Context, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

const API: &str = "https://api.github.com/repos/bgwsn-1/musiku-desktop/releases/latest";
const RELEASE_PAGE: &str = "https://github.com/bgwsn-1/musiku-desktop/releases/latest";
const TTL: Duration = Duration::from_secs(30 * 60);

#[derive(Clone)]
struct GhAsset {
    name: String,
    size: u64,
    browser_download_url: String,
    digest: Option<String>,
}

#[derive(Clone)]
struct GhRelease {
    tag_name: String,
    body: Option<String>,
    html_url: String,
    published_at: String,
    assets: Vec<GhAsset>,
}

impl<'de> Deserialize<'de> for GhAsset {
    fn deserialize<D>(d: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct Raw {
            name: String,
            size: u64,
            browser_download_url: String,
            digest: Option<String>,
        }
        let r = Raw::deserialize(d)?;
        Ok(Self {
            name: r.name,
            size: r.size,
            browser_download_url: r.browser_download_url,
            digest: r.digest,
        })
    }
}

impl<'de> Deserialize<'de> for GhRelease {
    fn deserialize<D>(d: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct Raw {
            tag_name: String,
            body: Option<String>,
            html_url: String,
            published_at: String,
            assets: Vec<GhAsset>,
        }
        let r = Raw::deserialize(d)?;
        Ok(Self {
            tag_name: r.tag_name,
            body: r.body,
            html_url: r.html_url,
            published_at: r.published_at,
            assets: r.assets,
        })
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAsset {
    pub name: String,
    pub size: u64,
    pub url: String,
    pub digest: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub current: String,
    pub latest: String,
    pub update_available: bool,
    pub notes: String,
    pub url: String,
    pub published_at: String,
    pub assets: Vec<UpdateAsset>,
}

struct Cache {
    at: Option<Instant>,
    release: Option<GhRelease>,
}

fn cache() -> &'static Mutex<Cache> {
    static C: OnceLock<Mutex<Cache>> = OnceLock::new();
    C.get_or_init(|| {
        Mutex::new(Cache {
            at: None,
            release: None,
        })
    })
}

/// `1.2.10` > `1.2.9` (perpintaan string biasa akan salah di sini).
fn version_newer(latest: &str, current: &str) -> bool {
    let nums = |s: &str| -> Vec<u64> {
        s.trim()
            .trim_start_matches(|c: char| !c.is_ascii_digit())
            .split(|c: char| !c.is_ascii_digit())
            .filter(|p| !p.is_empty())
            .filter_map(|p| p.parse().ok())
            .collect()
    };
    let a = nums(latest);
    let b = nums(current);
    if a.is_empty() {
        return false;
    }
    for i in 0..a.len().max(b.len()) {
        let av = *a.get(i).unwrap_or(&0);
        let bv = *b.get(i).unwrap_or(&0);
        if av != bv {
            return av > bv;
        }
    }
    false
}

async fn fetch_release() -> Result<GhRelease> {
    if let Some(r) = cache().lock().await.release.clone() {
        // dicek lagi di bawah supaya cache hangat nggak nunggu network
        if cache().lock().await.at.is_some_and(|at| at.elapsed() < TTL) {
            return Ok(r);
        }
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()?;
    let got: GhRelease = client
        .get(API)
        .header("User-Agent", "musiku-desktop")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await?
        .error_for_status()
        .context("GitHub Release tidak merespons")?
        .json()
        .await?;
    let mut c = cache().lock().await;
    c.at = Some(Instant::now());
    c.release = Some(got.clone());
    Ok(got)
}

pub async fn check() -> Result<UpdateInfo> {
    let r = fetch_release().await?;
    let current = env!("CARGO_PKG_VERSION").to_string();
    Ok(UpdateInfo {
        latest: r.tag_name.clone(),
        update_available: version_newer(&r.tag_name, &current),
        current,
        notes: r.body.unwrap_or_default(),
        url: if r.html_url.is_empty() {
            RELEASE_PAGE.to_string()
        } else {
            r.html_url
        },
        published_at: r.published_at,
        assets: r
            .assets
            .into_iter()
            .map(|a| UpdateAsset {
                name: a.name,
                size: a.size,
                url: a.browser_download_url,
                digest: a.digest,
            })
            .collect(),
    })
}

/// Pilih aset berdasarkan sufiks nama berkas (huruf besar/kecil diabaikan).
fn pick_asset<'a>(assets: &'a [UpdateAsset], suffixes: &[&str]) -> Option<&'a UpdateAsset> {
    assets.iter().find(|a| {
        let n = a.name.to_ascii_lowercase();
        suffixes.iter().any(|s| n.ends_with(s))
    })
}

/// Keluarga Debian/Ubuntu menandakan dirinya dengan `/etc/debian_version`;
/// distro lain (Arch, Fedora, …) lebih cocok dengan AppImage.
fn linux_prefers_deb() -> bool {
    Path::new("/etc/debian_version").exists()
}

/// Aset yang cocok untuk OS ini:
/// - Windows: installer NSIS (`-setup.exe`, dijalankan silent)
/// - macOS: `.dmg` (dibuka lewat `open`)
/// - Linux Debian/Ubuntu: `.deb`; distro lain: `.AppImage`
fn platform_asset(info: &UpdateInfo) -> Option<&UpdateAsset> {
    if cfg!(target_os = "windows") {
        pick_asset(&info.assets, &["-setup.exe"])
            .or_else(|| pick_asset(&info.assets, &[".exe"]))
    } else if cfg!(target_os = "macos") {
        pick_asset(&info.assets, &[".dmg"])
            .or_else(|| pick_asset(&info.assets, &[".app"]))
    } else if linux_prefers_deb() {
        pick_asset(&info.assets, &[".deb"])
            .or_else(|| pick_asset(&info.assets, &[".appimage"]))
    } else {
        pick_asset(&info.assets, &[".appimage"])
            .or_else(|| pick_asset(&info.assets, &[".deb"]))
    }
}

fn download_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        std::env::var_os("TEMP")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir)
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var_os("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir)
            .join("Downloads")
    }
}

/// Tulis berkas installer, sekaligus membuat direktori induknya bila belum ada
/// (mis. `$HOME/Downloads` sering tidak ada di instalasi minimal).
async fn write_installer(path: &Path, bytes: &[u8]) -> Result<()> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    tokio::fs::write(path, bytes).await?;
    Ok(())
}

/// Unduh aset, verifikasi SHA-256 dari GitHub, lalu jalankan.
/// Windows: installer NSIS `/S` (silent, per-user). macOS: `.dmg` dibuka lewat
/// `open`. Linux: `.deb`/`.AppImage` dibuka lewat xdg-open agar package manager
/// yang meminta konfirmasi ke user.
pub async fn install() -> Result<serde_json::Value> {
    let info = check().await?;
    let asset = platform_asset(&info)
        .ok_or_else(|| anyhow!("release terbaru belum punya aset untuk platform ini"))?;

    if !asset.url.starts_with("https://github.com/") {
        bail!("URL aset bukan github.com");
    }
    let file_name = Path::new(&asset.name)
        .file_name()
        .ok_or_else(|| anyhow!("nama aset tidak valid"))?;
    let path = download_dir().join(file_name);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(300))
        .build()?;
    let bytes = client
        .get(&asset.url)
        .header("User-Agent", "musiku-desktop")
        .send()
        .await?
        .error_for_status()?
        .bytes()
        .await?;

    if let Some(digest) = &asset.digest {
        let want = digest.strip_prefix("sha256:").unwrap_or(digest);
        let hash = Sha256::digest(&bytes);
        let got: String = hash.iter().map(|b| format!("{b:02x}")).collect();
        if got != want {
            bail!("SHA-256 tidak cocok: unduhan dibatalkan");
        }
    } else {
        bail!("GitHub tidak mengirim digest SHA-256 untuk aset ini");
    }
    write_installer(&path, &bytes).await?;

    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new(&path);
        c.arg("/S");
        c
    } else if cfg!(target_os = "macos") {
        let mut c = Command::new("open");
        c.arg(&path);
        c
    } else {
        let mut c = Command::new("xdg-open");
        c.arg(&path);
        c
    };
    cmd.spawn().with_context(|| format!("gagal menjalankan {}", path.display()))?;

    Ok(serde_json::json!({
        "ok": true,
        "name": asset.name,
        "file": path.to_string_lossy(),
        "version": info.latest,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn asset(name: &str) -> UpdateAsset {
        UpdateAsset {
            name: name.into(),
            size: 1,
            url: "https://github.com/x".into(),
            digest: None,
        }
    }

    #[test]
    fn pilih_aset_sesuai_sufiks() {
        let a = vec![
            asset("Musiku-0.1.6-setup.exe"),
            asset("Musiku_0.1.6_amd64.deb"),
            asset("Musiku_0.1.6_amd64.AppImage"),
            asset("Musiku_0.1.6_x64.dmg"),
        ];
        assert_eq!(
            pick_asset(&a, &["-setup.exe"]).unwrap().name,
            "Musiku-0.1.6-setup.exe"
        );
        assert_eq!(
            pick_asset(&a, &[".deb"]).unwrap().name,
            "Musiku_0.1.6_amd64.deb"
        );
        // AppImage dipilih dengan benar walau huruf besar di depan.
        assert_eq!(
            pick_asset(&a, &[".appimage"]).unwrap().name,
            "Musiku_0.1.6_amd64.AppImage"
        );
        assert_eq!(
            pick_asset(&a, &[".dmg"]).unwrap().name,
            "Musiku_0.1.6_x64.dmg"
        );
        assert!(pick_asset(&a, &[".msi"]).is_none());
    }

    #[test]
    fn versi_dibandingkan_per_numerik() {
        assert!(version_newer("v1.2.10", "1.2.9"));
        assert!(!version_newer("v1.2.9", "1.2.10"));
        assert!(!version_newer("v0.1.6", "0.1.7"));
        assert!(version_newer("0.1.8", "0.1.7"));
        assert!(!version_newer("bukan-versi", "0.1.7"));
    }

    #[tokio::test]
    async fn unduhan_membuat_direktori_induk() {
        let base = std::env::temp_dir().join(format!("musiku-upd-test-{}", std::process::id()));
        let path = base.join("Downloads").join("Musiku.deb");
        write_installer(&path, b"installer").await.unwrap();
        assert!(path.exists());
        let _ = tokio::fs::remove_dir_all(&base).await;
    }
}
