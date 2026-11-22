// Overscroll "rubber band" ala Apple.
//
// WebView desktop (WebKitGTK/WebView2/WKWebView) dan Chrome/Firefox tidak punya
// bounce native pada overflow:auto, jadi efek dibuat di JS: di batas scroll,
// delta roda/sentuh dijaga dengan resistensi lalu dipulangkan dengan easing
// spring-back. listener dipasang sekali di window dan memilih container terdekat
// yang benar-benar bisa gulir vertikal, jadi panel yang muncul belakangan ikut
// terbawa tanpa perlu didaftarkan satu per satu.

const MAX_PULL = 160; // batas tarikan piksel
const WHEEL_RESIST = 0.35; // semakin kecil = makin "berat"
const TOUCH_RESIST = 0.5;
const IDLE_MS = 90; // jeda roda terakhir sebelum spring-back
const SPRING_MS = 480;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

// `.page-scroll` = konten utama; `[data-elastic]` = opt-in; `.overflow-y-auto`
// = semua panel Tailwind (antrian, lirik, sidebar, menu).
const SELECTOR = ".page-scroll, [data-elastic], .overflow-y-auto";

const states = new WeakMap();

function isScrollableY(el) {
  const oy = getComputedStyle(el).overflowY;
  return oy === "auto" || oy === "scroll";
}

function currentVisual(el) {
  // Kalau kontainer punya tepat satu anak (mis. pembungkus PageFade), geser
  // anak itu supaya frame/scrollbar ikut diam. Kalau banyak anak, geser
  // kontainernya — umpan balik batas tetap terasa.
  return el.children.length === 1 && el.children[0].nodeType === 1
    ? el.children[0]
    : el;
}

function stateOf(el) {
  let s = states.get(el);
  if (!s) {
    s = { offset: 0, timer: 0, visual: null };
    states.set(el, s);
  }
  return s;
}

function clampOffset(v) {
  return Math.max(-MAX_PULL, Math.min(MAX_PULL, v));
}

function applyOffset(el, offset) {
  const s = stateOf(el);
  const visual = currentVisual(el);
  if (s.visual && s.visual !== visual) {
    s.visual.style.transform = "";
  }
  s.visual = visual;
  s.offset = offset;
  visual.style.transform =
    offset === 0 ? "" : `translate3d(0, ${offset.toFixed(1)}px, 0)`;
}

function release(el) {
  const s = stateOf(el);
  clearTimeout(s.timer);
  s.timer = 0;
  const visual = s.visual || currentVisual(el);
  visual.style.transition = `transform ${SPRING_MS}ms ${EASE}`;
  visual.style.transform = "translate3d(0, 0, 0)";
  s.offset = 0;
  setTimeout(() => {
    visual.style.transition = "";
    visual.style.transform = "";
  }, SPRING_MS + 40);
}

function scheduleRelease(el) {
  const s = stateOf(el);
  clearTimeout(s.timer);
  s.timer = setTimeout(() => release(el), IDLE_MS);
}

function cancelIfIdle(el) {
  const s = states.get(el);
  if (s && s.offset !== 0) release(el);
}

function normalizeDelta(delta, mode) {
  if (mode === 1) return delta * 16; // DOM_DELTA_LINE
  if (mode === 2) return delta * 100; // DOM_DELTA_PAGE
  return delta;
}

function nearestScrollable(target) {
  if (!(target instanceof Element)) return null;
  const el = target.closest(SELECTOR);
  if (!el || !isScrollableY(el)) return null;
  return el;
}

function atBounds(el) {
  const top = el.scrollTop <= 0.5;
  const bottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
  return { top, bottom };
}

function onWheel(e) {
  if (e.ctrlKey) return; // pinch-zoom
  const el = nearestScrollable(e.target);
  if (!el) return;
  const dy = normalizeDelta(e.deltaY, e.deltaMode);
  if (!dy) return;
  const { top, bottom } = atBounds(el);
  const over = (dy < 0 && top) || (dy > 0 && bottom);
  if (!over) {
    cancelIfIdle(el);
    return;
  }
  e.preventDefault();
  const s = stateOf(el);
  applyOffset(el, clampOffset(s.offset + dy * WHEEL_RESIST));
  scheduleRelease(el);
}

let touch = null;

function onTouchStart(e) {
  const el = nearestScrollable(e.target);
  const t = e.touches[0];
  touch = el && t ? { el, y: t.clientY } : null;
}

function onTouchMove(e) {
  if (!touch) return;
  const { el } = touch;
  const t = e.touches[0];
  if (!t) return;
  const dy = touch.y - t.clientY; // positif = gulir ke atas
  touch.y = t.clientY;
  const { top, bottom } = atBounds(el);
  const over = (dy < 0 && top) || (dy > 0 && bottom);
  if (over) {
    e.preventDefault();
    const s = stateOf(el);
    applyOffset(el, clampOffset(s.offset - dy * TOUCH_RESIST));
    scheduleRelease(el);
  } else {
    cancelIfIdle(el);
  }
}

function onTouchEnd() {
  if (!touch) return;
  const { el } = touch;
  touch = null;
  if (stateOf(el).offset !== 0) scheduleRelease(el);
}

/// Pasang overscroll elastis. Mengembalikan fungsi cleanup (dipakai useEffect).
export function initElasticScroll() {
  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("touchcancel", onTouchEnd, { passive: true });
  return () => {
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("touchcancel", onTouchEnd);
  };
}
