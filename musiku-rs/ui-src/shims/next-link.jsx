// Shim `next/link` untuk bundle offline (Tauri/browser).
// Perilaku yang dipakai aplikasi ini: <Link href> yang merender <a> dan
// menavigasi lewat router SPA kita (pushState), bukan reload halaman.
import { forwardRef } from "react";
import { navigate } from "./router.js";

const Link = forwardRef(function Link(
  { href, replace = false, scroll = true, prefetch, onClick, children, ...rest },
  ref,
) {
  const url = typeof href === "string" ? href : (href?.pathname ?? "/");
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
