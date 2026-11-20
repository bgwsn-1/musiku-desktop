// Shim `next/font/google`: di web app, font di-inject sebagai CSS variable.
// Di bundle ini font sudah tersedia lewat assets/app.css (font-face Geist),
// jadi kita cukup mengembalikan nama variabel yang sama.
export function Geist() {
  return { variable: "--font-geist-sans", className: "" };
}
export function Geist_Mono() {
  return { variable: "--font-geist-mono", className: "" };
}
