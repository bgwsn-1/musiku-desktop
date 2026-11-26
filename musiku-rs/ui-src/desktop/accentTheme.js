// Manajemen warna aksen desktop ala YesPlayMusic (tersimpan di localStorage).
export const ACCENT_SWATCHES = [
  { id: "lilac", name: "Lilac", hex: "#d6b0fa" },
  { id: "rose", name: "Rose", hex: "#ff5c7a" },
  { id: "sky", name: "Sky", hex: "#7cc4fa" },
  { id: "mint", name: "Mint", hex: "#6ee7b7" },
  { id: "amber", name: "Amber", hex: "#fbbf24" },
  { id: "coral", name: "Coral", hex: "#fb923c" },
];

const LS_ACCENT = "musiku.accent";

export function readAccentId() {
  if (typeof window === "undefined") return "lilac";
  try {
    const saved = window.localStorage.getItem(LS_ACCENT);
    if (saved && ACCENT_SWATCHES.some((s) => s.id === saved)) return saved;
  } catch {
    // Abaikan storage terkunci
  }
  return "lilac";
}

export function applyAccentById(id) {
  const swatch =
    ACCENT_SWATCHES.find((s) => s.id === id) || ACCENT_SWATCHES[0];
  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty("--ypm-accent", swatch.hex);
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LS_ACCENT, swatch.id);
    } catch {
      // Abaikan storage terkunci
    }
  }
  return swatch;
}

export function initAccentTheme() {
  return applyAccentById(readAccentId());
}
