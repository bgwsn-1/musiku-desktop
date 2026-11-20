//! Router + UI client Musiku.
//!
//! Dipakai oleh dua "wajah":
//! - `musiku-server` (bin)   → dijalankan manual, dibuka lewat browser
//! - `musiku-desktop` (bin)  → di-embed di dalam aplikasi Tauri (`.exe`)
//!
//! UI di-serve dari server yang sama dengan API-nya, jadi halaman bisa memakai
//! URL **relatif** (`/api/search`) dan tidak ada masalah CORS sama sekali.

use axum::body::Body;
use axum::extract::{Path, Query};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{Html, IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::OnceLock;
use std::time::Duration;

use musiku_core::artist_logo::{artist_logo, artist_logo_candidates};
use musiku_core::cache::BytesCache;
use musiku_core::music::{global, FILTERS, UA};
use musiku_core::stream::{resolve_audio, resolve_video, valid_video_id};

mod update;

/// Cache byte gambar sampul (24 jam). Mencegah hit berulang ke CDN Google.
fn artwork_cache() -> &'static BytesCache {
    static C: OnceLock<BytesCache> = OnceLock::new();
    C.get_or_init(|| BytesCache::new(Duration::from_secs(24 * 60 * 60)))
}

/// Cache byte logo artis (7 hari). Wikimedia membalas 429 kalau dihit cepat,
/// jadi byte-nya disimpan di memori.
fn logo_bytes() -> &'static BytesCache {
    static C: OnceLock<BytesCache> = OnceLock::new();
    C.get_or_init(|| BytesCache::new(Duration::from_secs(7 * 24 * 60 * 60)))
}

/// UI client (HTML + JS vanilla), di-embed ke dalam binary.
const INDEX_HTML: &str = include_str!("../ui/index.html");

type ApiError = (StatusCode, Json<Value>);

fn err(code: StatusCode, msg: impl Into<String>) -> ApiError {
    (code, Json(json!({ "error": msg.into() })))
}

fn upstream(e: impl std::fmt::Display) -> ApiError {
    err(StatusCode::BAD_GATEWAY, e.to_string())
}

// ── /api/health ──────────────────────────────────────────────────────────

async fn health() -> Json<Value> {
    Json(json!({ "ok": true, "service": "musiku-server" }))
}

// ── /api/search ──────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct SearchParams {
    q: Option<String>,
    filter: Option<String>,
    limit: Option<String>,
}

async fn search_handler(Query(p): Query<SearchParams>) -> Result<Json<Value>, ApiError> {
    let q = p.q.unwrap_or_default().trim().to_string();
    if q.is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "missing q"));
    }
    let filter = p.filter.unwrap_or_else(|| "songs".to_string());
    if !FILTERS.contains(&filter.as_str()) {
        return Err(err(StatusCode::BAD_REQUEST, "bad filter"));
    }
    let limit: usize = p
        .limit
        .and_then(|l| l.parse().ok())
        .filter(|n| *n > 0)
        .unwrap_or(20);

    global().search(&q, &filter, limit).await.map(Json).map_err(upstream)
}

// ── /api/home ────────────────────────────────────────────────────────────

async fn home_handler() -> Result<Json<Value>, ApiError> {
    global().home().await.map(Json).map_err(upstream)
}

// ── /api/album/:id ───────────────────────────────────────────────────────

async fn album_handler(Path(id): Path<String>) -> Result<Json<Value>, ApiError> {
    let v = global().album(&id).await.map_err(upstream)?;
    // TS mengembalikan 404 kalau `{ error }` ada di dalam objek.
    if v.get("error").is_some() {
        return Err(err(StatusCode::NOT_FOUND, "album tidak ditemukan"));
    }
    Ok(Json(v))
}

// ── /api/artist/:id ──────────────────────────────────────────────────────

async fn artist_handler(Path(id): Path<String>) -> Result<Json<Value>, ApiError> {
    let v = global().artist(&id).await.map_err(upstream)?;
    if v.get("error").is_some() {
        return Err(err(StatusCode::NOT_FOUND, "artis tidak ditemukan"));
    }
    Ok(Json(v))
}

// ── /api/song/:id ────────────────────────────────────────────────────────

async fn song_handler(Path(id): Path<String>) -> Result<Json<Value>, ApiError> {
    let v = global().song(&id).await.map_err(upstream)?;
    if v.get("error").is_some() {
        return Err(err(StatusCode::NOT_FOUND, "lagu tidak ditemukan"));
    }
    Ok(Json(v))
}

// ── /api/lyrics/:id ──────────────────────────────────────────────────────

async fn lyrics_handler(Path(id): Path<String>) -> Result<Json<Value>, ApiError> {
    global().lyrics(&id).await.map(Json).map_err(upstream)
}

// ── /api/stream/:id ──────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct StreamParams {
    /// `?video=1` → stream video-only (header artis).
    video: Option<String>,
}

async fn stream_handler(
    Path(id): Path<String>,
    Query(p): Query<StreamParams>,
    req_headers: HeaderMap,
) -> Result<Response, ApiError> {
    if !valid_video_id(&id) {
        return Err(err(StatusCode::BAD_REQUEST, "bad id"));
    }

    let is_video = p.video.as_deref() == Some("1");
    let url = if is_video {
        resolve_video(&id).await
    } else {
        resolve_audio(&id).await
    }
    .map_err(|_| err(StatusCode::BAD_GATEWAY, "resolve failed"))?;

    // Teruskan Range supaya <audio>/<video> bisa seek. Ini yang membedakan
    // proxy sederhana dengan proxy yang benar.
    let mut fetch_headers = vec![("user-agent", "Mozilla/5.0".to_string())];
    if let Some(range) = req_headers.get(header::RANGE).and_then(|r| r.to_str().ok()) {
        fetch_headers.push(("range", range.to_string()));
    }

    let mut req = global().http().get(&url);
    for (k, v) in &fetch_headers {
        req = req.header(*k, v);
    }
    let up = req.send().await.map_err(upstream)?;

    let status = StatusCode::from_u16(up.status().as_u16())
        .unwrap_or(StatusCode::BAD_GATEWAY);

    // Header yang diteruskan ke client.
    let mut out = Response::builder()
        .status(status)
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CACHE_CONTROL, "no-store")
        .header(
            header::CONTENT_TYPE,
            if is_video { "video/mp4" } else { "audio/mp4" },
        );

    for h in [
        header::CONTENT_RANGE,
        header::CONTENT_LENGTH,
        header::CONTENT_TYPE,
    ] {
        if let Some(v) = up.headers().get(&h) {
            out = out.header(h, v);
        }
    }

    // Alirkan body (streaming, tidak menahan di memori).
    let stream = up.bytes_stream();
    let body = Body::from_stream(stream);

    out.body(body)
        .map_err(|e| err(StatusCode::BAD_GATEWAY, e.to_string()))
}

// ── /api/artwork-proxy ───────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct ArtworkParams {
    url: Option<String>,
}

/// Whitelist host — sama dengan ALLOWED di route TS.
fn host_allowed(host: &str) -> bool {
    ["googleusercontent.com", "ggpht.com", "ytimg.com"]
        .iter()
        .any(|suffix| host == *suffix || host.ends_with(&format!(".{suffix}")))
}

async fn artwork_proxy(Query(p): Query<ArtworkParams>) -> Result<Response, ApiError> {
    let raw = p.url.unwrap_or_default();
    let parsed = reqwest::Url::parse(&raw)
        .map_err(|_| err(StatusCode::BAD_REQUEST, "bad url"))?;

    if parsed.scheme() != "https"
        || !host_allowed(parsed.host_str().unwrap_or_default())
    {
        return Err(err(StatusCode::BAD_REQUEST, "host tidak diizinkan"));
    }

    let key = parsed.to_string();
    let (ctype, bytes) = artwork_cache()
        .get_or_try(&key, async {
            let r = global()
                .http()
                .get(parsed)
                .header("user-agent", UA)
                .send()
                .await?;
            if !r.status().is_success() {
                anyhow::bail!("upstream {}", r.status());
            }
            let ctype = r
                .headers()
                .get(header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .unwrap_or("image/jpeg")
                .to_string();
            let bytes = r.bytes().await?.to_vec();
            Ok((ctype, bytes))
        })
        .await
        .map_err(|e| err(StatusCode::BAD_GATEWAY, format!("fetch gagal: {e}")))?;

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, ctype)
        .header(header::CACHE_CONTROL, "public, max-age=86400")
        .body(Body::from(bytes))
        .map_err(|e| err(StatusCode::BAD_GATEWAY, e.to_string()))?)
}

// ── /api/artist-logo ─────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct NameParams {
    name: Option<String>,
}

fn clean_name(p: &NameParams) -> Result<String, ApiError> {
    let name = p.name.clone().unwrap_or_default().trim().to_string();
    if name.is_empty() || name.chars().count() > 120 {
        return Err(err(StatusCode::BAD_REQUEST, "bad name"));
    }
    Ok(name)
}

async fn artist_logo_json(Query(p): Query<NameParams>) -> Result<Json<Value>, ApiError> {
    let name = clean_name(&p)?;
    match artist_logo(&name).await {
        Ok(Some(url)) => Ok(Json(json!({ "url": url }))),
        // TS mengembalikan `null` (bukan error) kalau tidak ketemu.
        Ok(None) => Ok(Json(Value::Null)),
        Err(e) => Err(upstream(e)),
    }
}

async fn artist_logo_file(Query(p): Query<NameParams>) -> Result<Response, ApiError> {
    let name = clean_name(&p)?;

    let candidates = artist_logo_candidates(&name)
        .await
        .map_err(upstream)?;
    if candidates.is_empty() {
        return Err(err(StatusCode::NOT_FOUND, "no logo"));
    }

    // Coba tiap kandidat berurutan. Ini penting karena Wikimedia membalas
    // 429 (rate-limit); kalau sumber pertama gagal kita coba berikutnya.
    let mut last_err = String::from("semua sumber gagal");
    for src in candidates {
        let key = src.clone();
        let got = logo_bytes()
            .get_or_try(&key, async {
                let r = global()
                    .http()
                    .get(&src)
                    .header("user-agent", UA)
                    .send()
                    .await?;
                if !r.status().is_success() {
                    anyhow::bail!("upstream {}", r.status());
                }
                let ctype = r
                    .headers()
                    .get(header::CONTENT_TYPE)
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("image/png")
                    .to_string();
                let bytes = r.bytes().await?.to_vec();
                Ok((ctype, bytes))
            })
            .await;

        match got {
            Ok((ctype, bytes)) => {
                return Ok(Response::builder()
                    .status(StatusCode::OK)
                    .header(header::CONTENT_TYPE, ctype)
                    .header(header::CACHE_CONTROL, "public, max-age=604800")
                    .body(Body::from(bytes))
                    .map_err(|e| err(StatusCode::BAD_GATEWAY, e.to_string()))?);
            }
            Err(e) => last_err = e.to_string(),
        }
    }

    Err(err(StatusCode::BAD_GATEWAY, format!("fetch gagal: {last_err}")))
}

// ── UI ───────────────────────────────────────────────────────────────────

async fn index() -> Html<&'static str> {
    Html(INDEX_HTML)
}

// Aset UI (CSS/JS/font) di-embed ke binary supaya `.exe` benar-benar mandiri.
const APP_CSS: &[u8] = include_bytes!("../ui/assets/app.css");
const APP_JS: &[u8] = include_bytes!("../ui/assets/app.js");

/// Satu file font Geist/Geist Mono, di-embed dengan nama aslinya.
fn font_bytes(name: &str) -> Option<&'static [u8]> {
    macro_rules! fonts {
        ($($f:literal),* $(,)?) => {
            match name {
                $($f => Some(include_bytes!(concat!("../ui/assets/fonts/", $f)) as &[u8]),)*
                _ => None,
            }
        };
    }
    fonts!(
        "07935285219a259d-s.1qq4vpdcun5oj.woff2",
        "07a39a8a4660cc7c-s.p.0r6juujl39pe6.woff2",
        "2a04751c893bf294-s.1rgnod-3esatf.woff2",
        "2bb852295097cd96-s.2dbetqa9o8jxf.woff2",
        "4f6667dd39116621-s.3p2_lha1f2xer.woff2",
        "605ce01b664af129-s.p.0wgildi0cnwt9.woff2",
        "6e342921ee4dcd9d-s.2tuy5pz7dlieh.woff2",
        "77814b00d5ca94a4-s.21jp631_3pja2.woff2",
        "9eb5a876700c0028-s.1uyisp29ctx0d.woff2",
        "b0c6b664fd57c2c6-s.31988l_ccedte.woff2",
        "f58031ded4338640-s.390ncx5urfkfu.woff2",
    )
}

fn asset(bytes: &'static [u8], ctype: &'static str) -> Response {
    (
        [
            (header::CONTENT_TYPE, ctype),
            (header::CACHE_CONTROL, "public, max-age=31536000, immutable"),
        ],
        Body::from(bytes),
    )
        .into_response()
}

async fn asset_css() -> Response {
    asset(APP_CSS, "text/css; charset=utf-8")
}

async fn asset_js() -> Response {
    asset(APP_JS, "text/javascript; charset=utf-8")
}

async fn asset_font(Path(name): Path<String>) -> Response {
    match font_bytes(&name) {
        Some(b) => asset(b, "font/woff2"),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

// ── /api/update/* ────────────────────────────────────────────────────────

async fn update_check() -> std::result::Result<Json<Value>, ApiError> {
    update::check()
        .await
        .map(|v| Json(json!(v)))
        .map_err(|e| upstream(e))
}

async fn update_install() -> std::result::Result<Json<Value>, ApiError> {
    update::install().await.map(Json).map_err(|e| upstream(e))
}

/// Router lengkap: API + UI.
pub fn app() -> Router {
    Router::new()
        .route("/", get(index))
        .route("/assets/app.css", get(asset_css))
        .route("/assets/app.js", get(asset_js))
        .route("/assets/fonts/{name}", get(asset_font))
        .route("/api/health", get(health))
        .route("/api/search", get(search_handler))
        .route("/api/home", get(home_handler))
        .route("/api/album/{id}", get(album_handler))
        .route("/api/artist/{id}", get(artist_handler))
        .route("/api/song/{id}", get(song_handler))
        .route("/api/lyrics/{id}", get(lyrics_handler))
        .route("/api/stream/{id}", get(stream_handler))
        .route("/api/artwork-proxy", get(artwork_proxy))
        .route("/api/artist-logo", get(artist_logo_json))
        .route("/api/artist-logo/file", get(artist_logo_file))
        .route("/api/update/check", get(update_check))
        .route("/api/update/install", post(update_install))
        // SPA fallback: rute tak dikenal balikin UI.
        .fallback(index)
}

/// Jalan-larang di listener yang sudah ada (dipakai `main.rs`).
pub async fn serve(listener: tokio::net::TcpListener) -> std::io::Result<()> {
    axum::serve(listener, app()).await
}

/// Jalankan server di thread terpisah, di port acak yang bebas.
///
/// Kembalikan nomor port begitu server siap — dipakai oleh shell desktop
/// supaya jendela Tauri tahu harus membuka URL mana.
pub fn spawn_background() -> std::io::Result<u16> {
    let (tx, rx) = std::sync::mpsc::channel();

    std::thread::spawn(move || {
        let rt = tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("tokio runtime");
        rt.block_on(async move {
            let listener = match tokio::net::TcpListener::bind(("127.0.0.1", 0)).await {
                Ok(l) => l,
                Err(e) => {
                    let _ = tx.send(Err(e));
                    return;
                }
            };
            let port = listener.local_addr().map(|a| a.port()).unwrap_or(0);
            if tx.send(Ok(port)).is_err() {
                return; // penerima sudah hilang
            }
            axum::serve(listener, app()).await.expect("serve");
        });
    });

    rx.recv().expect("server thread mati sebelum siap")
}

// Dipakai `IntoResponse` untuk pesan error internal.
#[allow(dead_code)]
fn _assert_into_response<T: IntoResponse>() {}

#[cfg(test)]
mod tests {
    use super::*;

    /// Aset UI benar-benar ter-embed dan bisa dilayani (bukan file kosong).
    #[test]
    fn aset_ui_ter_embed() {
        assert!(APP_CSS.len() > 10_000, "app.css terlalu kecil");
        assert!(APP_JS.len() > 50_000, "app.js terlalu kecil");
        // CSS memuat design system asli, JS memuat bundle React.
        let css = std::str::from_utf8(APP_CSS).unwrap();
        assert!(css.contains("@font-face"), "app.css kehilangan @font-face");
        assert!(css.contains(".shell"), "app.css kehilangan .shell");
        assert!(css.contains("fonts/"), "path font belum ditulis ulang");
        let js = std::str::from_utf8(APP_JS).unwrap();
        assert!(js.contains("shell"), "bundle tidak memuat shell");
    }

    /// Semua font yang direferensikan CSS tersedia (kalau tidak, UI kehilangan
    /// tipografi Geist → tidak mirip web).
    #[test]
    fn semua_font_tersedia() {
        let css = std::str::from_utf8(APP_CSS).unwrap();
        let mut n = 0;
        for part in css.split("url(fonts/").skip(1) {
            let name = part.split(')').next().unwrap_or("");
            assert!(
                font_bytes(name).is_some(),
                "font {name} direferensikan CSS tapi tidak ter-embed"
            );
            n += 1;
        }
        assert!(n >= 11, "hanya {n} referensi font ditemukan");
    }
}
