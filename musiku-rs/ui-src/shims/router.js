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
  if (replace) {
    window.history.replaceState(null, "", u.pathname + u.search + u.hash);
    if (historyIndex >= 0) historyStack[historyIndex] = current;
  } else {
    historyStack.splice(historyIndex + 1);
    historyStack.push(current);
    historyIndex = historyStack.length - 1;
    window.history.pushState(null, "", u.pathname + u.search + u.hash);
  }
  if (scroll) window.scrollTo(0, 0);
  emit();
}

function refreshFromLocation() {
  current = {
    pathname: window.location.pathname || "/",
    search: window.location.search || "",
    hash: window.location.hash || "",
  };
  emit();
}

window.addEventListener("popstate", refreshFromLocation);

// seed initial history entry
historyStack.push(current);
historyIndex = 0;

export function back() {
  if (historyIndex > 0) {
    historyIndex -= 1;
    current = historyStack[historyIndex];
    window.history.back();
    window.setTimeout(refreshFromLocation, 0);
    emit();
  } else {
    window.history.back();
  }
}

export function forward() {
  if (historyIndex < historyStack.length - 1) {
    historyIndex += 1;
    current = historyStack[historyIndex];
    window.history.forward();
    window.setTimeout(refreshFromLocation, 0);
    emit();
  } else {
    window.history.forward();
  }
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
