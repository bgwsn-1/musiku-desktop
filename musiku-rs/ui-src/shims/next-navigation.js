// Shim `next/navigation`.
export { useRouter, usePathname, useSearchParams } from "./router.js";

export function useParams() {
  // tidak dipakai oleh komponen yang di-port (halaman memakai props),
  // tapi disediakan supaya impor tetap resolve.
  return {};
}

export function redirect() {
  throw new Error("redirect() tidak tersedia di bundle klien");
}

export function notFound() {
  throw new Error("notFound() tidak tersedia di bundle klien");
}
