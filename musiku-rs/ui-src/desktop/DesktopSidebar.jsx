// Bilah navigasi ikon tipis 72px di kiri (gaya YesPlayMusic).
// Latar transparan agar warna sampul halaman album/artis dapat tembus ke bawahnya.
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconClose,
  IconExplore,
  IconHome,
  IconLibrary,
  IconMusic,
  IconRadio,
  IconSearch,
  IconUser,
} from "@/components/Icons";
import { useAccount } from "./CloudAccountContext.jsx";
import { AccountModal } from "./AccountModal.jsx";

const RAIL_LINKS = [
  { href: "/", label: "Beranda", icon: IconHome, match: (p) => p === "/" || p === "" },
  { href: "/explore", label: "Explore", icon: IconExplore, match: (p) => p.startsWith("/explore") },
  { href: "/radio", label: "Radio", icon: IconRadio, match: (p) => p.startsWith("/radio") },
  {
    href: "/liked",
    label: "Pustaka",
    icon: IconLibrary,
    match: (p) =>
      p.startsWith("/liked") ||
      p.startsWith("/pustaka") ||
      p.startsWith("/playlist") ||
      p.startsWith("/ytm-playlist") ||
      p.startsWith("/album"),
  },
  { href: "/search", label: "Cari", icon: IconSearch, match: (p) => p.startsWith("/search") },
];

export function DesktopSidebar({ mobileOpen, onCloseMobile }) {
  const pathname = usePathname();
  const account = useAccount();
  const [accountOpen, setAccountOpen] = useState(false);

  const initial = (account.displayName || account.user?.email || "M").slice(0, 1).toUpperCase();

  return (
    <>
      {mobileOpen && (
        <div
          className="ds-backdrop lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`ypm-rail ${mobileOpen ? "flex" : "hidden lg:flex"}`}
        data-mobile={mobileOpen ? "1" : undefined}
        aria-label="Navigasi utama"
      >
        {mobileOpen && (
          <div className="mb-3 flex w-full items-center justify-between px-3 lg:hidden">
            <span className="text-[14px] font-bold text-[#f7f7f8]">Musiku</span>
            <button
              type="button"
              className="ypm-icon-btn"
              onClick={onCloseMobile}
              aria-label="Tutup navigasi"
            >
              <IconClose className="h-4 w-4" />
            </button>
          </div>
        )}

        <Link
          href="/"
          onClick={onCloseMobile}
          className="ypm-rail-logo"
          aria-label="Musiku Beranda"
          title="Musiku"
        >
          <IconMusic className="h-[22px] w-[22px]" />
        </Link>

        <nav className="ypm-rail-nav" aria-label="Menu utama">
          {RAIL_LINKS.map((item) => {
            const Icon = item.icon;
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className="ypm-rail-btn"
                data-active={active ? "1" : undefined}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                title={item.label}
              >
                <Icon className="h-[22px] w-[22px]" />
                {mobileOpen && <span className="ypm-rail-label lg:hidden">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="ypm-rail-foot">
          <Link
            href="/settings"
            onClick={onCloseMobile}
            className="ypm-rail-btn"
            data-active={pathname.startsWith("/settings") ? "1" : undefined}
            aria-current={pathname.startsWith("/settings") ? "page" : undefined}
            aria-label="Pengaturan"
            title="Pengaturan"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-[20px] w-[20px]"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            {mobileOpen && <span className="ypm-rail-label lg:hidden">Pengaturan</span>}
          </Link>

          <Link
            href="/profile"
            onClick={onCloseMobile}
            className="ypm-rail-avatar-btn"
            aria-current={pathname.startsWith("/profile") ? "page" : undefined}
            aria-label={
              account.user
                ? `Profil ${account.displayName || "Musiku"}`
                : "Profil & Akun Musiku"
            }
            title={
              account.user
                ? `${account.displayName || "Akun Musiku"} (${account.syncStatus === "synced" ? "Tersinkron" : "Cloud Sync"})`
                : "Profil & Akun"
            }
          >
            <span
              className="ypm-rail-avatar"
              data-guest={account.user ? undefined : "1"}
              aria-hidden="true"
            >
              {account.user ? initial : <IconUser className="h-[18px] w-[18px]" />}
            </span>
            {account.user && (
              <span
                className="ypm-rail-dot"
                data-state={account.syncStatus}
                aria-hidden="true"
              />
            )}
          </Link>
        </div>
      </aside>

      {accountOpen && <AccountModal onClose={() => setAccountOpen(false)} />}
    </>
  );
}
