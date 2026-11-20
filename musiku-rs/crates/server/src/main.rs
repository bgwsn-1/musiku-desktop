//! Client web Musiku (versi Rust) — dijalankan manual, dibuka lewat browser.
//!
//! ```text
//! cargo run -p musiku-server
//! # buka http://127.0.0.1:8787
//! ```

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "musiku_server=info".into()),
        )
        .init();

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8787);

    let listener = tokio::net::TcpListener::bind(("127.0.0.1", port))
        .await
        .expect("bind port");
    tracing::info!("Musiku jalan di http://127.0.0.1:{port}");
    musiku_server::serve(listener).await.expect("serve");
}
