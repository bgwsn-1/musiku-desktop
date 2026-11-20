import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PlayerProvider } from "@/lib/player";
import { MobileTabs, Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { PlayerBar } from "@/components/PlayerBar";
import { RightPanel } from "@/components/RightPanel";
import { PageFade } from "@/components/PageFade";
import { Toaster } from "@/components/Toast";
import { EdgeSwipeBack } from "@/components/EdgeSwipeBack";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Musiku",
  description:
    "Pemutar musik web. Metadata dari YouTube Music, audio asli, lirik sinkron.",
  // PWA di iOS: bisa "Add to Home Screen", tap ikon buka app penuh.
  // Link manifest + apple-touch-icon diansamb otomatis dari
  // app/manifest.ts + app/apple-icon.png (file conventions).
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Musiku",
  },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  // keyboard Android mengecilkan layout, jadi kolom cari di dock tetap terlihat
  interactiveWidget: "resizes-content",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0e" },
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden bg-window font-sans text-label1">
        <PlayerProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-surface focus:px-4 focus:py-2 focus:text-[14px] focus:font-semibold focus:text-label1"
          >
            Lompat ke konten
          </a>
          <div className="shell relative h-dvh overflow-hidden">
            {/* content layer: plain window colour, then the scrolling page */}
            <main
              id="main"
              tabIndex={-1}
              className="page-scroll absolute inset-0 z-10 overflow-y-auto outline-none"
            >
              <PageFade>{children}</PageFade>
            </main>
            <div className="scroll-edge scroll-edge-top" aria-hidden="true" />
            <div className="scroll-edge scroll-edge-bottom" aria-hidden="true" />

            {/* functional layer: the only place glass lives */}
            <TopBar />
            <Sidebar />
            <PlayerBar />
            <RightPanel />
            <MobileTabs />
            <Toaster />
            <EdgeSwipeBack />
          </div>
        </PlayerProvider>
      </body>
    </html>
  );
}
