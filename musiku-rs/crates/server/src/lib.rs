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

use musiku_core::apple::apple_artwork;
use musiku_core::artist_logo::{artist_logo, artist_logo_candidates};
use musiku_core::cache::BytesCache;
use musiku_core::music::{global, FILTERS, UA};
use musiku_core::stream::{
    invalidate_audio, invalidate_video, resolve_audio, resolve_video, valid_video_id,
};
use sha2::{Digest, Sha256};

mod update;

/// Batas ukuran gambar yang boleh di-buffer ke memori pada endpoint proxy (10 MB).
const MAX_IMAGE_BYTES: usize = 10 * 1024 * 1024;

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

// ── /api/artists/charts ─────────────────────────────────────────────────────

async fn artists_charts_handler() -> Result<Json<Value>, ApiError> {
    global().global_artists().await.map(Json).map_err(upstream)
}

// ── /api/moods & /api/mood/:id ─────────────────────────────────────────────

async fn moods_handler() -> Result<Json<Value>, ApiError> {
    global().moods().await.map(Json).map_err(upstream)
}

async fn mood_handler(Path(id): Path<String>) -> Result<Json<Value>, ApiError> {
    global().mood_playlists(&id).await.map(Json).map_err(upstream)
}

// ── /api/playlist/:id ─────────────────────────────────────────────────────

async fn ytm_playlist_handler(Path(id): Path<String>) -> Result<Json<Value>, ApiError> {
    global()
        .ytm_playlist(&id)
        .await
        .map(Json)
        .map_err(upstream)
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

// ── /api/apple-artwork ────────────────────────────────────────────────────
// Dipakai mode immersive desktop. Selalu 200 dengan field null kalau tidak
// ketemu — UI tinggal jatuh ke cover YouTube Music yang sekarang.

#[derive(Debug, Deserialize)]
struct AppleArtworkParams {
    title: Option<String>,
    artist: Option<String>,
}

async fn apple_artwork_handler(Query(p): Query<AppleArtworkParams>) -> Json<Value> {
    let title = p.title.unwrap_or_default().trim().to_string();
    let artist = p.artist.map(|a| a.trim().to_string()).filter(|a| !a.is_empty());
    if title.is_empty() {
        return Json(json!({ "motion": null, "still": null, "album": null, "artist": null, "url": null }));
    }
    let found = apple_artwork(&title, artist.as_deref()).await;
    Json(found
        .and_then(|a| serde_json::to_value(a).ok())
        .unwrap_or_else(|| {
            json!({ "motion": null, "still": null, "album": null, "artist": null, "url": null })
        }))
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
    let range_hdr = req_headers
        .get(header::RANGE)
        .and_then(|r| r.to_str().ok())
        .map(str::to_string);

    // Maksimal 2 percobaan: jika URL googlevideo di cache kedaluwarsa atau
    // ditolak karena IP berubah (401/403/410), invalidasi cache lalu resolve ulang.
    let mut up = None;
    for attempt in 0..2 {
        let url = if is_video {
            resolve_video(&id).await
        } else {
            resolve_audio(&id).await
        }
        .map_err(|_| err(StatusCode::BAD_GATEWAY, "resolve failed"))?;

        let mut req = global().http().get(&url).header("user-agent", "Mozilla/5.0");
        if let Some(range) = &range_hdr {
            req = req.header("range", range);
        }
        let resp = req.send().await.map_err(upstream)?;
        let code = resp.status().as_u16();
        if attempt == 0 && matches!(code, 401 | 403 | 410) {
            if is_video {
                invalidate_video(&id).await;
            } else {
                invalidate_audio(&id).await;
            }
            continue;
        }
        up = Some(resp);
        break;
    }
    let up = up.ok_or_else(|| err(StatusCode::BAD_GATEWAY, "resolve failed"))?;

    let status = StatusCode::from_u16(up.status().as_u16())
        .unwrap_or(StatusCode::BAD_GATEWAY);

    // Header yang diteruskan ke client. Content-Type harus tepat SATU: pakai
    // milik upstream bila ada, kalau tidak baru pakai default. Memasang keduanya
    // membuat dua header Content-Type (response malformed).
    let default_ctype = if is_video { "video/mp4" } else { "audio/mp4" };
    let ctype = single_content_type(up.headers(), default_ctype);

    let mut out = Response::builder()
        .status(status)
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CACHE_CONTROL, "no-store")
        .header(header::CONTENT_TYPE, ctype);

    for h in [header::CONTENT_RANGE, header::CONTENT_LENGTH] {
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

/// Content-Type dari upstream, atau `default` bila tidak ada/tak terbaca.
/// Dipisah supaya response tidak pernah memuat dua header Content-Type.
fn single_content_type<'a>(headers: &'a HeaderMap, default: &'a str) -> &'a str {
    headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or(default)
}

/// Hanya izinkan MIME gambar raster aman pada proxy same-origin (tolak
/// `image/svg+xml` yang bisa memuat `<script>` atau `text/html`).
fn safe_image_content_type(raw: Option<&str>, fallback: &str) -> anyhow::Result<String> {
    let mime = raw
        .and_then(|v| v.split(';').next())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .unwrap_or(fallback)
        .to_ascii_lowercase();
    match mime.as_str() {
        "image/png" | "image/jpeg" | "image/jpg" | "image/webp" | "image/gif" | "image/avif" => {
            Ok(mime)
        }
        other => anyhow::bail!("content-type gambar tidak diizinkan: {other}"),
    }
}

/// Baca body gambar upstream dengan batas maksimal `MAX_IMAGE_BYTES`.
async fn read_capped_image(mut resp: reqwest::Response) -> anyhow::Result<Vec<u8>> {
    if let Some(len) = resp.content_length() {
        if len > MAX_IMAGE_BYTES as u64 {
            anyhow::bail!("ukuran gambar melebihi batas ({len} byte)");
        }
    }
    let mut buf = Vec::new();
    while let Some(chunk) = resp.chunk().await? {
        if buf.len().saturating_add(chunk.len()) > MAX_IMAGE_BYTES {
            anyhow::bail!("ukuran gambar melebihi batas ({MAX_IMAGE_BYTES} byte)");
        }
        buf.extend_from_slice(&chunk);
    }
    Ok(buf)
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
            let ctype = safe_image_content_type(
                r.headers()
                    .get(header::CONTENT_TYPE)
                    .and_then(|v| v.to_str().ok()),
                "image/jpeg",
            )?;
            let bytes = read_capped_image(r).await?;
            Ok((ctype, bytes))
        })
        .await
        .map_err(|e| err(StatusCode::BAD_GATEWAY, format!("fetch gagal: {e}")))?;

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, ctype)
        .header(header::CACHE_CONTROL, "public, max-age=86400")
        .header(header::X_CONTENT_TYPE_OPTIONS, "nosniff")
        .header(header::CONTENT_SECURITY_POLICY, "default-src 'none'")
        .body(Body::from(bytes))
        .map_err(|e| err(StatusCode::BAD_GATEWAY, e.to_string()))
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
                let ctype = safe_image_content_type(
                    r.headers()
                        .get(header::CONTENT_TYPE)
                        .and_then(|v| v.to_str().ok()),
                    "image/png",
                )?;
                let bytes = read_capped_image(r).await?;
                Ok((ctype, bytes))
            })
            .await;

        match got {
            Ok((ctype, bytes)) => {
                return Response::builder()
                    .status(StatusCode::OK)
                    .header(header::CONTENT_TYPE, ctype)
                    .header(header::CACHE_CONTROL, "public, max-age=604800")
                    .header(header::X_CONTENT_TYPE_OPTIONS, "nosniff")
                    .header(header::CONTENT_SECURITY_POLICY, "default-src 'none'")
                    .body(Body::from(bytes))
                    .map_err(|e| err(StatusCode::BAD_GATEWAY, e.to_string()));
            }
            Err(e) => last_err = e.to_string(),
        }
    }

    Err(err(StatusCode::BAD_GATEWAY, format!("fetch gagal: {last_err}")))
}

// ── UI ───────────────────────────────────────────────────────────────────

fn asset_hash(bytes: &[u8]) -> String {
    let hash = Sha256::digest(bytes);
    let mut hex = String::with_capacity(16);
    for b in &hash[..8] {
        use std::fmt::Write;
        let _ = write!(&mut hex, "{b:02x}");
    }
    hex
}

fn app_css_hash() -> &'static str {
    static H: OnceLock<String> = OnceLock::new();
    H.get_or_init(|| asset_hash(APP_CSS)).as_str()
}

fn app_js_hash() -> &'static str {
    static H: OnceLock<String> = OnceLock::new();
    H.get_or_init(|| asset_hash(APP_JS)).as_str()
}

/// Suntikkan `?v=<hash>` pada URL `/assets/app.{css,js}` di `index.html` supaya
/// WebView/browser yang pernah menyimpan cache `immutable` langsung mengambil
/// bundel terbaru saat binary di-rebuild atau di-upgrade.
fn rendered_index_html() -> &'static str {
    static HTML: OnceLock<String> = OnceLock::new();
    HTML.get_or_init(|| {
        INDEX_HTML
            .replace(
                "href=\"/assets/app.css\"",
                &format!("href=\"/assets/app.css?v={}\"", app_css_hash()),
            )
            .replace(
                "src=\"/assets/app.js\"",
                &format!("src=\"/assets/app.js?v={}\"", app_js_hash()),
            )
    })
    .as_str()
}

fn html_no_store() -> Response {
    (
        [(header::CACHE_CONTROL, "no-store")],
        Html(rendered_index_html()),
    )
        .into_response()
}

async fn index() -> Response {
    html_no_store()
}

/// `/api` atau di bawahnya — dipakai membedakan fallback UI dan fallback API.
fn is_api_path(uri: &axum::http::Uri) -> bool {
    uri.path() == "/api" || uri.path().starts_with("/api/")
}

/// SPA fallback: rute non-API mengembalikan UI; `/api/*` yang tak dikenal
/// dijawab 404 JSON supaya client tidak mengira HTML sebagai data.
async fn spa_fallback(uri: axum::http::Uri) -> Response {
    if is_api_path(&uri) {
        return err(StatusCode::NOT_FOUND, "not found").into_response();
    }
    html_no_store()
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

fn app_css_etag() -> &'static str {
    static TAG: OnceLock<String> = OnceLock::new();
    TAG.get_or_init(|| format!("\"{}\"", app_css_hash())).as_str()
}

fn app_js_etag() -> &'static str {
    static TAG: OnceLock<String> = OnceLock::new();
    TAG.get_or_init(|| format!("\"{}\"", app_js_hash())).as_str()
}

fn immutable_asset(bytes: &'static [u8], ctype: &'static str) -> Response {
    (
        [
            (header::CONTENT_TYPE, ctype),
            (header::CACHE_CONTROL, "public, max-age=31536000, immutable"),
        ],
        Body::from(bytes),
    )
        .into_response()
}

/// Aset bundle tanpa hash di URL (`/assets/app.css`, `/assets/app.js`):
/// pakai `no-cache` + `ETag` supaya browser/WebView selalu memvalidasi ulang
/// saat binary di-upgrade, tapi tetap cepat (304 Not Modified) saat sama.
fn revalidated_asset(
    bytes: &'static [u8],
    ctype: &'static str,
    etag: &'static str,
    req_headers: &HeaderMap,
) -> Response {
    if req_headers
        .get(header::IF_NONE_MATCH)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.trim() == etag)
    {
        return (
            StatusCode::NOT_MODIFIED,
            [
                (header::ETAG, etag),
                (header::CACHE_CONTROL, "no-cache"),
            ],
        )
            .into_response();
    }
    (
        [
            (header::CONTENT_TYPE, ctype),
            (header::CACHE_CONTROL, "no-cache"),
            (header::ETAG, etag),
        ],
        Body::from(bytes),
    )
        .into_response()
}

async fn asset_css(headers: HeaderMap) -> Response {
    revalidated_asset(APP_CSS, "text/css; charset=utf-8", app_css_etag(), &headers)
}

async fn asset_js(headers: HeaderMap) -> Response {
    revalidated_asset(
        APP_JS,
        "text/javascript; charset=utf-8",
        app_js_etag(),
        &headers,
    )
}

async fn asset_font(Path(name): Path<String>) -> Response {
    match font_bytes(&name) {
        Some(b) => immutable_asset(b, "font/woff2"),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

// ── /api/update/* ────────────────────────────────────────────────────────

/// Validasi same-origin untuk POST sensitif (`/api/update/install`) agar situs
/// web lain di browser tidak dapat memicu unduh/eksekusi installer via CSRF.
fn is_same_origin_post(headers: &HeaderMap) -> bool {
    let Some(host) = headers.get(header::HOST).and_then(|v| v.to_str().ok()) else {
        return false;
    };
    let Some(origin) = headers.get(header::ORIGIN).and_then(|v| v.to_str().ok()) else {
        return false;
    };
    let expected_http = format!("http://{host}");
    let expected_https = format!("https://{host}");
    if origin != expected_http && origin != expected_https {
        return false;
    }
    if let Some(site) = headers.get("sec-fetch-site").and_then(|v| v.to_str().ok()) {
        if site != "same-origin" {
            return false;
        }
    }
    true
}

async fn update_check() -> std::result::Result<Json<Value>, ApiError> {
    update::check()
        .await
        .map(|v| Json(json!(v)))
        .map_err(upstream)
}

async fn update_install_desktop(
    headers: HeaderMap,
) -> std::result::Result<Json<Value>, ApiError> {
    if !is_same_origin_post(&headers) {
        return Err(err(
            StatusCode::FORBIDDEN,
            "permintaan lintas origin ditolak",
        ));
    }
    update::install().await.map(Json).map_err(upstream)
}

async fn update_install_disabled() -> ApiError {
    err(
        StatusCode::FORBIDDEN,
        "pembaruan otomatis hanya tersedia pada aplikasi desktop",
    )
}

fn build_router(allow_update_install: bool) -> Router {
    let r = Router::new()
        .route("/", get(index))
        .route("/assets/app.css", get(asset_css))
        .route("/assets/app.js", get(asset_js))
        .route("/assets/fonts/{name}", get(asset_font))
        .route("/api/health", get(health))
        .route("/api/search", get(search_handler))
        .route("/api/home", get(home_handler))
        .route("/api/album/{id}", get(album_handler))
        .route("/api/artist/{id}", get(artist_handler))
        .route("/api/artists/charts", get(artists_charts_handler))
        .route("/api/moods", get(moods_handler))
        .route("/api/mood/{id}", get(mood_handler))
        .route("/api/playlist/{id}", get(ytm_playlist_handler))
        .route("/api/song/{id}", get(song_handler))
        .route("/api/lyrics/{id}", get(lyrics_handler))
        .route("/api/apple-artwork", get(apple_artwork_handler))
        .route("/api/stream/{id}", get(stream_handler))
        .route("/api/artwork-proxy", get(artwork_proxy))
        .route("/api/artist-logo", get(artist_logo_json))
        .route("/api/artist-logo/file", get(artist_logo_file))
        .route("/api/update/check", get(update_check));

    let r = if allow_update_install {
        r.route("/api/update/install", post(update_install_desktop))
    } else {
        r.route("/api/update/install", post(update_install_disabled))
    };

    // SPA fallback: rute tak dikenal balikin UI, /api/* → 404 JSON.
    r.fallback(spa_fallback)
}

/// Router lengkap untuk server web standalone (`/api/update/install` dinonaktifkan).
pub fn app() -> Router {
    build_router(false)
}

/// Router untuk shell desktop Tauri (`/api/update/install` aktif dengan guard same-origin).
fn desktop_app() -> Router {
    build_router(true)
}

/// Jalan-larang di listener yang sudah ada (dipakai `main.rs`).
pub async fn serve(listener: tokio::net::TcpListener) -> std::io::Result<()> {
    axum::serve(listener, app()).await
}

/// Port bawaan tetap untuk aplikasi desktop agar Origin WebView
/// (`http://127.0.0.1:<port>`) konsisten antar-sesi dan `localStorage`
/// (playlist, lagu disukai, riwayat, pengaturan) tetap terjaga saat restart.
/// Dipilih di luar rentang ephemeral OS (Linux 32768-60999, Windows/macOS
/// 49152-65535) dan berbeda dari port server manual (`8787`).
pub const DEFAULT_DESKTOP_PORT: u16 = 28787;

async fn bind_preferred_or_ephemeral(
    preferred: u16,
) -> std::io::Result<tokio::net::TcpListener> {
    if preferred != 0 {
        match tokio::net::TcpListener::bind(("127.0.0.1", preferred)).await {
            Ok(listener) => return Ok(listener),
            Err(e) if e.kind() == std::io::ErrorKind::AddrInUse => {
                tracing::warn!(
                    "port {preferred} sedang dipakai; jatuh ke port acak (origin localStorage berbeda dari sesi utama)"
                );
            }
            Err(e) => return Err(e),
        }
    }
    tokio::net::TcpListener::bind(("127.0.0.1", 0)).await
}

/// Jalankan server di thread terpisah dengan port tetap (`DEFAULT_DESKTOP_PORT`,
/// dapat ditimpa via env `MUSIKU_DESKTOP_PORT`), jatuh ke port acak hanya jika
/// port tersebut sedang dipakai proses lain.
///
/// Kembalikan nomor port begitu server siap — dipakai oleh shell desktop
/// supaya jendela Tauri tahu harus membuka URL mana.
pub fn spawn_background() -> std::io::Result<u16> {
    let preferred = std::env::var("MUSIKU_DESKTOP_PORT")
        .ok()
        .and_then(|v| v.parse::<u16>().ok())
        .unwrap_or(DEFAULT_DESKTOP_PORT);
    spawn_background_on(preferred)
}

/// Varian `spawn_background` dengan port pilihan eksplisit (memudahkan pengujian).
pub fn spawn_background_on(preferred_port: u16) -> std::io::Result<u16> {
    let (tx, rx) = std::sync::mpsc::channel();

    std::thread::spawn(move || {
        let rt = tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            // Parser YouTube Music (rustypipe) rekursif cukup dalam; stack
            // default 2 MB sempat overflow saat memproses JSON artis/beranda.
            .thread_stack_size(32 * 1024 * 1024)
            .build()
            .expect("tokio runtime");
        rt.block_on(async move {
            let listener = match bind_preferred_or_ephemeral(preferred_port).await {
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
            axum::serve(listener, desktop_app()).await.expect("serve");
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

    #[test]
    fn path_api_dikenali() {
        use axum::http::Uri;
        assert!(is_api_path(&Uri::from_static("/api/nope")));
        assert!(is_api_path(&Uri::from_static("/api")));
        assert!(!is_api_path(&Uri::from_static("/album/MPRE_x")));
        assert!(!is_api_path(&Uri::from_static("/")));
    }

    /// Content-Type upstream dipakai; default hanya bila upstream tak mengirim.
    #[test]
    fn content_type_hanya_satu() {
        let mut h = HeaderMap::new();
        assert_eq!(single_content_type(&h, "audio/mp4"), "audio/mp4");
        h.insert(header::CONTENT_TYPE, "audio/mp4".parse().unwrap());
        assert_eq!(single_content_type(&h, "video/mp4"), "audio/mp4");
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

    #[tokio::test]
    async fn bind_memakai_port_tetap_saat_bebas() {
        let probe = tokio::net::TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let port = probe.local_addr().unwrap().port();
        drop(probe);

        let first = bind_preferred_or_ephemeral(port).await.unwrap();
        assert_eq!(first.local_addr().unwrap().port(), port);
        drop(first);

        let second = bind_preferred_or_ephemeral(port).await.unwrap();
        assert_eq!(second.local_addr().unwrap().port(), port);
    }

    #[tokio::test]
    async fn bind_jatuh_ke_port_acak_saat_terpakai() {
        let occupied = tokio::net::TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let port = occupied.local_addr().unwrap().port();

        let fallback = bind_preferred_or_ephemeral(port).await.unwrap();
        let fallback_port = fallback.local_addr().unwrap().port();
        assert_ne!(fallback_port, 0);
        assert_ne!(fallback_port, port);
    }

    #[test]
    fn same_origin_post_tolak_csrf() {
        let mut ok = HeaderMap::new();
        ok.insert(header::HOST, "127.0.0.1:28787".parse().unwrap());
        ok.insert(header::ORIGIN, "http://127.0.0.1:28787".parse().unwrap());
        ok.insert("sec-fetch-site", "same-origin".parse().unwrap());
        assert!(is_same_origin_post(&ok));

        let mut evil = HeaderMap::new();
        evil.insert(header::HOST, "127.0.0.1:28787".parse().unwrap());
        evil.insert(header::ORIGIN, "https://evil.example".parse().unwrap());
        assert!(!is_same_origin_post(&evil));

        let mut cross = ok.clone();
        cross.insert("sec-fetch-site", "cross-site".parse().unwrap());
        assert!(!is_same_origin_post(&cross));

        let no_origin = HeaderMap::new();
        assert!(!is_same_origin_post(&no_origin));
    }

    #[test]
    fn proxy_gambar_tolak_svg_dan_html() {
        assert_eq!(
            safe_image_content_type(Some("image/png; charset=binary"), "image/png").unwrap(),
            "image/png"
        );
        assert!(safe_image_content_type(Some("image/svg+xml"), "image/png").is_err());
        assert!(safe_image_content_type(Some("text/html"), "image/jpeg").is_err());
    }

    #[test]
    fn bundle_aset_pakai_no_cache_dan_etag_304() {
        let resp = revalidated_asset(APP_JS, "text/javascript; charset=utf-8", app_js_etag(), &HeaderMap::new());
        assert_eq!(resp.status(), StatusCode::OK);
        assert_eq!(resp.headers().get(header::CACHE_CONTROL).unwrap(), "no-cache");
        let etag = resp.headers().get(header::ETAG).unwrap().to_str().unwrap().to_string();

        let mut req = HeaderMap::new();
        req.insert(header::IF_NONE_MATCH, etag.parse().unwrap());
        let cached = revalidated_asset(APP_JS, "text/javascript; charset=utf-8", app_js_etag(), &req);
        assert_eq!(cached.status(), StatusCode::NOT_MODIFIED);
    }

    #[test]
    fn index_html_menyisipkan_hash_aset() {
        let html = rendered_index_html();
        assert!(html.contains(&format!("/assets/app.css?v={}", app_css_hash())));
        assert!(html.contains(&format!("/assets/app.js?v={}", app_js_hash())));
        let resp = html_no_store();
        assert_eq!(resp.headers().get(header::CACHE_CONTROL).unwrap(), "no-store");
    }
}
