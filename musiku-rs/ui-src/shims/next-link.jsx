// Shim `next/link` untuk bundle offline (Tauri/browser).
// Perilaku yang dipakai aplikasi ini: <Link href> yang merender <a> dan
// menavigasi lewat router SPA kita (pushState), bukan reload halaman.
import { forwardRef } from "react";
import { navigate } from "./router.js";

function resolveHref(href) {
  if (typeof href === "string") return href;
  if (!href || typeof href !== "object") return "/";
  const pathname = href.pathname ?? "/";
  let search = "";
  if (typeof href.search === "string" && href.search) {
    search = href.search.startsWith("?") ? href.search : `?${href.search}`;
  } else if (href.query && typeof href.query === "object") {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(href.query)) {
      if (v == null) continue;
      if (Array.isArray(v)) {
        for (const item of v) params.append(k, String(item));
      } else {
        params.set(k, String(v));
      }
    }
    const qs = params.toString();
    if (qs) search = `?${qs}`;
  }
  const hash =
    typeof href.hash === "string" && href.hash
      ? href.hash.startsWith("#")
        ? href.hash
        : `#${href.hash}`
      : "";
  return `${pathname}${search}${hash}`;
}

const Link = forwardRef(function Link(
  { href, replace = false, scroll = true, prefetch, onClick, children, ...rest },
  ref,
) {
  const url = resolveHref(href);
  const handle = (e) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (/^(https?:)?\/\//.test(url) || url.startsWith("#")) return;
    e.preventDefault();
    navigate(url, { replace, scroll });
  };
  return (
    <a ref={ref} href={url} onClick={handle} {...rest}>
      {children}
    </a>
  );
});

export default Link;
