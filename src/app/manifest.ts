import type { MetadataRoute } from "next";

/** PWA manifest: app instalan, plus shortcut Cari & Favorit di homescreen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Musiku",
    short_name: "Musiku",
    description:
      "Pemutar musik web. Metadata dari YouTube Music, audio asli, lirik sinkron.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0b0e",
    theme_color: "#0b0b0e",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcuts: [
      { name: "Cari", url: "/search" },
      { name: "Favorit", url: "/liked" },
    ],
  };
}
