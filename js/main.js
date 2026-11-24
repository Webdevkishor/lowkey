/**
 * Bootstrap: renders the 2D site first (works everywhere), then layers the
 * 3D workshop on top when the device can handle it. Handles deep links.
 */
import { CONFIG, PRODUCTS, LOOKS } from "./products.js";
import { pageUrl, formatPrice } from "./whatsapp.js";
import { validateCatalog } from "./validate.js";
import * as ui from "./ui.js";

const params = new URLSearchParams(location.search);
const reduced = params.get("motion") === "reduce" || matchMedia("(prefers-reduced-motion: reduce)").matches;
document.documentElement.classList.toggle("reduced-motion", reduced);

const { problems, usable: products } = validateCatalog(PRODUCTS, CONFIG);
problems.forEach((m) => console.warn("[LOWKEY products.js]", m));

const byId = new Map(products.map((p) => [p.id, p]));
const numberOf = (p) => products.indexOf(p) + 1;
const categories = [...new Set(products.map((p) => p.category))];

// Loading: show the page after this long (ms since it opened) even if 3D isn't ready,
// and give up on 3D (use the 2D rail) if it still isn't ready after the second value.
const LOADER_MAX_WAIT_MS = 5000;
const THREE_D_TIMEOUT_MS = 25000;

const stage = document.getElementById("stage");
const fallbackRoot = document.getElementById("fallback-rail");
const grid = document.getElementById("grid");

let rail = null; // 3D controller, when available
let drawer;
let filters;
let cursor;
let railTag;

/* ---------------- capability checks ---------------- */
function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
function lowPower() {
  const mem = navigator.deviceMemory;
  const cores = navigator.hardwareConcurrency;
  return (mem && mem < 2) || (cores && cores <= 2) || navigator.connection?.saveData === true;
}
function want3D() {
  if (params.has("no3d")) return false;
  if (params.has("3d")) return webglAvailable();
  return webglAvailable() && !lowPower();
}

/* ---------------- product opening ---------------- */
function heroInView() {
  const r = document.getElementById("rail").getBoundingClientRect();
  return r.bottom > innerHeight * 0.45 && r.top < innerHeight * 0.45;
}

function openProduct(id, opts = {}) {
  const p = byId.get(id);
  if (!p) return false;
  const fromRail = ["rail", "front", "hash"].includes(opts.from);
  if (rail && fromRail && heroInView() && rail.focus(p.id)) document.body.classList.add("is-focused");
  drawer.open(p, opts);
  return true;
}

function announce(p) {
  if (p) document.getElementById("rail-status").textContent = `${p.name}, ${formatPrice(p.price)}`;
}

function handleHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith("product-")) {
    if (!openProduct(h.slice("product-".length), { from: "hash" })) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  } else if (h.startsWith("look-")) {
    document.getElementById(h)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  }
}

/* ---------------- structured data (SEO) ---------------- */
function injectJsonLd() {
  const url = pageUrl() || location.href.split("#")[0];
  const abs = (path) => {
    try {
      return new URL(path, url).href;
    } catch {
      return path;
    }
  };
  const handle = (CONFIG.instagram || "").replace(/^@/, "").trim();
  const store = {
    "@type": "ClothingStore",
    "@id": `${url}#store`,
    name: CONFIG.storeName,
    url,
    telephone: `+${CONFIG.whatsappNumber}`,
    image: abs("assets/og-image.png"),
    address: {
      "@type": "PostalAddress",
      addressLocality: CONFIG.locality,
      addressRegion: CONFIG.region,
      addressCountry: CONFIG.country,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: CONFIG.opens,
        closes: CONFIG.closes,
      },
    ],
    sameAs: handle ? [`https://www.instagram.com/${handle}/`] : undefined,
  };
  const prices = products.map((p) => p.price);
  if (prices.length) store.priceRange = `${CONFIG.currency}${Math.min(...prices)}–${CONFIG.currency}${Math.max(...prices)}`;
  const items = products.map((p) => ({
    "@type": "Product",
    "@id": `${url}#product-${p.id}`,
    name: p.name,
    sku: p.code,
    category: p.category,
    description: p.description,
    image: p.image ? abs(p.image) : undefined,
    color: p.colors.map((c) => c.name).join(" / "),
    material: p.fabric,
    brand: { "@type": "Brand", name: CONFIG.brand },
    offers: {
      "@type": "Offer",
      price: String(p.price),
      priceCurrency: CONFIG.currencyCode,
      url: `${url}#product-${p.id}`,
      seller: { "@id": `${url}#store` },
    },
  }));
  const s = document.createElement("script");
  s.type = "application/ld+json";
  s.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": [store, ...items] });
  document.head.appendChild(s);
}

/* ---------------- 3D / 2D rail ---------------- */
async function start3D(loader, isAborted) {
  const mod = await import("./scene.js");
  loader.set(55);
  if (isAborted()) throw new Error("aborted");
  railTag = ui.createRailTag();
  const r = await mod.createRail({
    container: stage,
    products,
    reduced,
    onProgress: (f) => loader.set(55 + f * 40),
    onHover: (p, pos) => {
      if (p && pos) {
        railTag.show(p, numberOf(p));
        railTag.move(pos.x, pos.y);
      } else railTag.hide();
      cursor.setView(!!p);
    },
    onHoverMove: (pos) => railTag.move(pos.x, pos.y),
    onSelect: (p) => openProduct(p.id, { from: "rail", trigger: stage }),
    onFront: (p) => ui.setFront(p, numberOf(p)),
    onFocused: (p, rect) => {
      if (drawer.product?.id === p.id && innerWidth >= 960) ui.drawChalk(p, rect);
    },
    onInteract: hideHint,
  });
  if (isAborted()) {
    r.dispose();
    throw new Error("aborted");
  }
  document.body.classList.add("has-3d");
  if (matchMedia("(pointer: coarse)").matches) {
    const hint = document.getElementById("hint");
    hint.lastChild.textContent = "Swipe to turn the rail";
  }

  document.getElementById("rail-prev").addEventListener("click", () => announce(r.prev()));
  document.getElementById("rail-next").addEventListener("click", () => announce(r.next()));
  document.getElementById("front-info").addEventListener("click", (e) => {
    const id = e.currentTarget.dataset.id;
    if (id) openProduct(id, { from: "front", trigger: e.currentTarget });
  });
  stage.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      announce(r.prev());
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      announce(r.next());
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const p = r.front();
      if (p) openProduct(p.id, { from: "front", trigger: stage });
    }
  });
  r.setFilter(filters.get());
  return r;
}

/**
 * Load the 3D rail in the background. Resolves with the rail controller, or
 * null if it fails or takes longer than THREE_D_TIMEOUT_MS (the 2D rail is used then).
 */
function load3D(loader) {
  let aborted = false;
  let timer;
  return Promise.race([
    start3D(loader, () => aborted),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        aborted = true;
        reject(new Error("3D took too long to load"));
      }, THREE_D_TIMEOUT_MS);
    }),
  ])
    .then((r) => (rail = r))
    .catch((err) => {
      console.warn("[LOWKEY] 3D rail unavailable, showing the 2D rail instead:", err?.message || err);
      rail = null;
      stage.replaceChildren();
      return null;
    })
    .finally(() => clearTimeout(timer));
}

/** Show the 3D rail: fade the canvas in and switch the spotlights on. */
function revealRail(r) {
  document.body.classList.remove("is-warming");
  document.body.classList.add("rail-ready");
  r.reveal();
}

let started2D = false;
function start2D() {
  if (started2D) return;
  started2D = true;
  document.body.classList.remove("is-warming");
  document.body.classList.add("no-3d");
  stage.hidden = true;
  ui.renderFallbackRail(fallbackRoot, products, { onOpen: openProduct });
  ui.filterFallbackRail(fallbackRoot, filters.get());
}

function hideHint() {
  document.getElementById("hint")?.classList.add("is-gone");
}

/* ---------------- scroll reveals ---------------- */
function initReveals() {
  const els = document.querySelectorAll("[data-reveal]");
  if (reduced || !("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("js-reveal");
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("is-visible");
          io.unobserve(en.target);
        }
      }),
    { rootMargin: "0px 0px -10% 0px" }
  );
  els.forEach((el) => io.observe(el));
}

/* ---------------- boot ---------------- */
async function boot() {
  ui.applyConfig(CONFIG);
  ui.initImageFallback(byId);
  ui.initPhotoTrim();
  cursor = ui.initCursor(reduced);
  ui.initGrain(reduced);
  ui.initTape();
  const loader = ui.createLoader(reduced);
  loader.set(12);

  ui.renderIndex(grid, products, { onOpen: openProduct });
  ui.initTilt(grid, reduced);
  ui.renderLooks(document.getElementById("looks-strip"), LOOKS, byId, { onOpen: openProduct });
  ui.initSizeHelp();
  injectJsonLd();
  initReveals();
  document.getElementById("index-count").textContent = `No. 01 — No. ${ui.pad(products.length)}`;

  drawer = ui.createDrawer({
    numberOf,
    backLabel: () => (rail ? "Back to the rail" : "Back to the collection"),
    onColor: (p, c) => rail?.setColor(p.id, c),
    onClose: () => {
      ui.clearChalk();
      document.body.classList.remove("is-focused");
      rail?.release();
    },
  });

  filters = ui.createFilters(document.querySelectorAll("[data-filters]"), categories, (cat) => {
    ui.filterGrid(grid, cat);
    if (rail) rail.setFilter(cat);
    else ui.filterFallbackRail(fallbackRoot, cat);
  });
  loader.set(30);

  // Wait for the 3D rail behind the loader, but never longer than
  // LOADER_MAX_WAIT_MS after the page opened. On slow connections the page is
  // shown first and the rail fades in and lights up when it arrives.
  const threeD = want3D() ? load3D(loader) : null;
  if (!threeD) {
    start2D();
  } else {
    const SLOW = Symbol("slow");
    const left = Math.max(0, LOADER_MAX_WAIT_MS - performance.now());
    const first = await Promise.race([threeD, new Promise((r) => setTimeout(() => r(SLOW), left))]);
    if (first === SLOW) document.body.classList.add("is-warming");
    else if (!first) start2D();
  }

  await loader.done();
  threeD?.then((r) => (r ? revealRail(r) : start2D()));
  handleHash();
  addEventListener("hashchange", handleHash);
}

boot();
