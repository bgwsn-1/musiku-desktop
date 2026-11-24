// Router SPA minimal + store langganan, dipakai oleh shim `next/link` dan
// `next/navigation` (usePathname / useRouter / useSearchParams).
import { useSyncExternalStore } from "react";

let current = {
  pathname: window.location.pathname || "/",
  search: window.location.search || "",
  hash: window.location.hash || "",
};
const listeners = new Set();
const historyStack = [];
let historyIndex = -1;

function snapshot() {
  return current;
}

function emit() {
  for (const l of listeners) l();
}

export function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getSnapshot() {
  return current;
}

export function navigate(url, { replace = false, scroll = false } = {}) {
  const u = new URL(url, window.location.origin);
  const next = { pathname: u.pathname, search: u.search, hash: u.hash };
  if (
    next.pathname === current.pathname &&
    next.search === current.search &&
    next.hash === current.hash
  ) {
    return;
  }
  current = next;
  const full = u.pathname + u.search + u.hash;
  if (replace) {
    if (historyIndex >= 0) historyStack[historyIndex] = current;
    try {
      window.history.replaceState(
        { ...(window.history.state && typeof window.history.state === "object" ? window.history.state : {}), __musikuIdx: historyIndex },
        "",
        full,
      );
    } catch {
      window.history.replaceState(null, "", full);
    }
  } else {
    historyStack.splice(historyIndex + 1);
    historyStack.push(current);
    historyIndex = historyStack.length - 1;
    window.history.pushState({ __musikuIdx: historyIndex }, "", full);
  }
  if (scroll) {
    window.scrollTo(0, 0);
    document.getElementById("main")?.scrollTo(0, 0);
  }
  emit();
}

function refreshFromLocation(e) {
  current = {
    pathname: window.location.pathname || "/",
    search: window.location.search || "",
    hash: window.location.hash || "",
  };
  const idx = e?.state?.__musikuIdx ?? window.history.state?.__musikuIdx;
  if (typeof idx === "number" && idx >= 0) {
    historyIndex = idx;
    historyStack[idx] = current;
  }
  emit();
}

window.addEventListener("popstate", refreshFromLocation);

// seed initial history entry
historyStack.push(current);
historyIndex = 0;
try {
  window.history.replaceState(
    { ...(window.history.state && typeof window.history.state === "object" ? window.history.state : {}), __musikuIdx: 0 },
    "",
    window.location.pathname + window.location.search + window.location.hash,
  );
} catch {}

export function back() {
  window.history.back();
}

export function forward() {
  window.history.forward();
}

export function useRouter() {
  return {
    push: (url) => navigate(url, { scroll: true }),
    replace: (url) => navigate(url, { replace: true }),
    back,
    forward,
    refresh: refreshFromLocation,
    prefetch: () => {},
  };
}

export function usePathname() {
  return useSyncExternalStore(subscribe, () => current.pathname, () => current.pathname);
}

export function useSearchParams() {
  const search = useSyncExternalStore(subscribe, () => current.search, () => current.search);
  return new URLSearchParams(search);
}
