/**
 * 2D interface: Index grid, Shop the Look, fallback rail, filters, product drawer,
 * size help, loader, measuring-tape scroll indicator, cursor, grain, chalk marks.
 * Works without Three.js; the 3D rail is an optional layer on top.
 */
import { CONFIG } from "./products.js";
import { flatSVG, hangerSVG } from "./flats.js";
import { formatPrice, formatPhone, waLink, productMessage, lookMessage, generalMessage, NOT_SURE } from "./whatsapp.js";

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const pad = (n) => String(n).padStart(2, "0");
export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const WA_ICON = `<svg class="i-wa" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z"/></svg>`;

const colorOf = (p, name) => p.colors.find((c) => c.name === name) || p.colors[0];

/* ------------------------------------------------------------------ */
/* Store details from CONFIG                                           */
/* ------------------------------------------------------------------ */
export function applyConfig(config = CONFIG) {
  $$("[data-brand]").forEach((el) => (el.textContent = config.brand));
  $$("[data-store]").forEach((el) => (el.textContent = config.storeName));
  $$("[data-tagline]").forEach((el) => (el.textContent = config.tagline));
  $$("[data-address]").forEach((el) => (el.textContent = config.address));
  $$("[data-hours]").forEach((el) => (el.textContent = config.hours));
  $$("[data-phone]").forEach((el) => (el.textContent = formatPhone(config.whatsappNumber)));
  $$("[data-year]").forEach((el) => (el.textContent = String(new Date().getFullYear())));
  $$("[data-wa-general]").forEach((a) => (a.href = waLink(generalMessage(config))));
  $$("[data-wa-size-help]").forEach(
    (a) => (a.href = waLink(`Hi ${config.storeName}, could you help me choose the right size?`))
  );
  const handle = (config.instagram || "").replace(/^@/, "").trim();
  $$("[data-instagram]").forEach((el) => {
    if (!handle) {
      el.hidden = true;
      return;
    }
    const a = el.querySelector("a") || el;
    a.href = `https://www.instagram.com/${encodeURIComponent(handle)}/`;
    a.textContent = `@${handle}`;
    el.hidden = false;
  });
}

/* ------------------------------------------------------------------ */
/* Product media: real photo when set, otherwise the generated flat     */
/* ------------------------------------------------------------------ */
/* Cut-out photos (PNG / WebP with a see-through background) usually keep big
   empty margins. Trim them so the garment fills its card, as on the 3D rail.
   Ordinary JPG photos are left exactly as they are. */
const trimJobs = new Map(); // original src -> Promise<trimmed blob URL | null>
const trimmedSrc = new Map(); // original src -> trimmed blob URL (once ready)

function trimPhoto(src, img) {
  if (!trimJobs.has(src)) {
    const job = (async () => {
      if (/\.jpe?g(\?|$)/i.test(src)) return null;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      if (!iw || !ih) return null;
      const sw = Math.min(256, iw);
      const sh = Math.max(1, Math.round((sw * ih) / iw));
      const probe = document.createElement("canvas");
      probe.width = sw;
      probe.height = sh;
      const pctx = probe.getContext("2d", { willReadFrequently: true });
      pctx.drawImage(img, 0, 0, sw, sh);
      const d = pctx.getImageData(0, 0, sw, sh).data;
      let minX = sw;
      let minY = sh;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          if (d[(y * sw + x) * 4 + 3] < 16) continue;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      if (maxX < 0) return null;
      const cx = Math.max(0, ((minX - 2) / sw) * iw);
      const cy = Math.max(0, ((minY - 2) / sh) * ih);
      const cw = Math.min(iw, ((maxX + 3) / sw) * iw) - cx;
      const ch = Math.min(ih, ((maxY + 3) / sh) * ih) - cy;
      if (cw > iw * 0.96 && ch > ih * 0.96) return null; // nothing worth trimming
      const k = Math.min(1, 1400 / Math.max(cw, ch));
      const out = document.createElement("canvas");
      out.width = Math.max(1, Math.round(cw * k));
      out.height = Math.max(1, Math.round(ch * k));
      out.getContext("2d").drawImage(img, cx, cy, cw, ch, 0, 0, out.width, out.height);
      const blob = await new Promise((resolve) => out.toBlob(resolve, "image/png"));
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      trimmedSrc.set(src, url);
      return url;
    })().catch(() => null);
    trimJobs.set(src, job);
  }
  return trimJobs.get(src);
}

/** Trim each product photo once it has loaded (Index, drawer, Shop the Look, 2D rail). */
export function initPhotoTrim() {
  document.addEventListener(
    "load",
    (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || !img.dataset.fallback || img.dataset.trimmed) return;
      img.dataset.trimmed = "1";
      trimPhoto(img.getAttribute("src"), img).then((url) => {
        if (url && img.isConnected) img.src = url;
      });
    },
    true
  );
}

function media(p, color, { decorative = true, annotate = false, align } = {}) {
  if (p.image) {
    const ready = trimmedSrc.get(p.image);
    const src = ready || p.image;
    return `<img src="${esc(src)}" alt="${decorative ? "" : esc(`${p.name} in ${color.name}`)}" loading="lazy" decoding="async" data-fallback="${esc(p.id)}" data-color="${esc(color.name)}"${ready ? ' data-trimmed="1"' : ""}>`;
  }
  return flatSVG(p, color, { annotate, label: `${p.name} in ${color.name}, illustration`, decorative, align });
}

/** If a photo path is wrong or missing, swap in the generated drawing. */
export function initImageFallback(byId) {
  document.addEventListener(
    "error",
    (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || !img.dataset.fallback) return;
      const p = byId.get(img.dataset.fallback);
      if (!p) return;
      const wrap = document.createElement("span");
      wrap.className = "media-fallback";
      wrap.innerHTML = flatSVG(p, colorOf(p, img.dataset.color), { label: `${p.name}, illustration` });
      img.replaceWith(wrap);
    },
    true
  );
}

/* ------------------------------------------------------------------ */
/* The Index                                                           */
/* ------------------------------------------------------------------ */
export function renderIndex(list, products, { onOpen }) {
  list.innerHTML = products
    .map((p, i) => {
      const c = p.colors[0];
      const dots = p.colors
        .map((col) => `<span class="dot" style="--c:${esc(col.hex)};--c2:${esc(col.hex2 || col.hex)}"></span>`)
        .join("");
      return `<li class="card-wrap" data-category="${esc(p.category)}">
        <a class="card" href="#product-${esc(p.id)}" data-id="${esc(p.id)}" data-cursor="view">
          <span class="card__media">${media(p, c)}<span class="card__no">No. ${pad(i + 1)}</span></span>
          <span class="card__body">
            <span class="card__row"><span class="card__name">${esc(p.name)}</span><span class="card__price">${formatPrice(p.price)}</span></span>
            <span class="card__meta">${esc(p.category)} · ${esc(p.fit)} fit</span>
            <span class="card__dots" aria-label="${p.colors.length} colour${p.colors.length > 1 ? "s" : ""}: ${esc(p.colors.map((x) => x.name).join(", "))}">${dots}</span>
          </span>
        </a>
      </li>`;
    })
    .join("");

  list.addEventListener("click", (e) => {
    const a = e.target.closest("a.card");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onOpen(a.dataset.id, { from: "index", trigger: a });
  });
}

/** CSS 3D tilt for Index cards (skipped for reduced motion / touch). */
export function initTilt(list, reduced) {
  if (reduced || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  list.addEventListener("pointermove", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    card.style.setProperty("--ry", `${(px * 10).toFixed(2)}deg`);
    card.style.setProperty("--rx", `${(-py * 8).toFixed(2)}deg`);
    card.style.setProperty("--gx", `${((px + 0.5) * 100).toFixed(1)}%`);
    card.style.setProperty("--gy", `${((py + 0.5) * 100).toFixed(1)}%`);
  });
  list.addEventListener(
    "pointerout",
    (e) => {
      const card = e.target.closest(".card");
      if (card && !card.contains(e.relatedTarget)) {
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      }
    },
    true
  );
}

export function filterGrid(list, category) {
  $$(".card-wrap", list).forEach((li) => {
    const show = category === "All" || li.dataset.category === category;
    if (show && li.hidden) {
      li.hidden = false;
      li.classList.remove("is-in");
      void li.offsetWidth;
      li.classList.add("is-in");
    } else if (!show) li.hidden = true;
  });
}

/* ------------------------------------------------------------------ */
/* Shop the Look                                                       */
/* ------------------------------------------------------------------ */
export function renderLooks(root, looks, byId, { onOpen }) {
  root.innerHTML = looks
    .map((look, li) => {
      const items = look.items
        .map((it) => {
          const product = byId.get(it.id);
          return product ? { product, color: colorOf(product, it.color) } : null;
        })
        .filter(Boolean);
      const total = items.reduce((s, it) => s + it.product.price, 0);
      const msg = lookMessage(
        look,
        items.map((it) => ({ product: it.product, color: it.color.name }))
      );
      return `<article class="look" id="look-${esc(look.id)}" aria-labelledby="look-${esc(look.id)}-t">
        <header class="look__head">
          <p class="eyebrow">Look ${pad(li + 1)}</p>
          <h3 class="look__title" id="look-${esc(look.id)}-t">${esc(look.name)}</h3>
          <p class="look__note">${esc(look.note)}</p>
        </header>
        <ol class="look__items">
          ${items
            .map(
              (it) => `<li><button type="button" class="look__item" data-id="${esc(it.product.id)}" data-color="${esc(it.color.name)}" data-cursor="view">
                <span class="look__media">${media(it.product, it.color)}</span>
                <span class="look__name">${esc(it.product.name)}</span>
                <span class="look__meta">${esc(it.color.name)} · ${formatPrice(it.product.price)}</span>
              </button></li>`
            )
            .join("")}
        </ol>
        <footer class="look__foot">
          <p class="look__total">Total <strong>${formatPrice(total)}</strong> <span>· ${items.length} pieces</span></p>
          <a class="btn btn--wa" href="${esc(waLink(msg))}" target="_blank" rel="noopener">${WA_ICON}<span>Enquire about this look</span></a>
        </footer>
      </article>`;
    })
    .join("");

  root.addEventListener("click", (e) => {
    const b = e.target.closest(".look__item");
    if (b) onOpen(b.dataset.id, { from: "looks", color: b.dataset.color, trigger: b });
  });
}

/* ------------------------------------------------------------------ */
/* 2D rail (no WebGL / low-power fallback)                             */
/* ------------------------------------------------------------------ */
export function renderFallbackRail(root, products, { onOpen }) {
  root.innerHTML = `<div class="frail__bar" aria-hidden="true"></div>
    <ul class="frail__list">${products
      .map(
        (p, i) => `<li data-category="${esc(p.category)}">
          <button type="button" class="frail__item" data-id="${esc(p.id)}" data-cursor="view" aria-label="View ${esc(p.name)}, ${formatPrice(p.price)}">
            ${hangerSVG()}
            <span class="frail__media">${media(p, p.colors[0], { align: "top" })}</span>
            <span class="frail__tag" aria-hidden="true"><b>No. ${pad(i + 1)}</b> ${esc(p.name)}</span>
          </button>
        </li>`
      )
      .join("")}</ul>`;
  root.hidden = false;
  root.addEventListener("click", (e) => {
    const b = e.target.closest(".frail__item");
    if (b) onOpen(b.dataset.id, { from: "rail2d", trigger: b });
  });
}

export function filterFallbackRail(root, category) {
  $$("li", root).forEach((li) => (li.hidden = !(category === "All" || li.dataset.category === category)));
}

/* ------------------------------------------------------------------ */
/* Filters (chip groups stay in sync)                                  */
/* ------------------------------------------------------------------ */
export function createFilters(roots, categories, onChange) {
  const all = ["All", ...categories];
  let current = "All";
  roots.forEach((r) => {
    r.innerHTML = all
      .map((c) => `<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${c === "All"}">${esc(c)}</button>`)
      .join("");
    r.addEventListener("click", (e) => {
      const b = e.target.closest(".chip");
      if (b && b.dataset.cat !== current) set(b.dataset.cat);
    });
  });
  function set(c) {
    current = c;
    roots.forEach((r) => $$(".chip", r).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cat === c))));
    onChange(c);
  }
  return { set, get: () => current };
}

/* ------------------------------------------------------------------ */
/* Product drawer / bottom sheet                                       */
/* ------------------------------------------------------------------ */
export function createDrawer({ onClose, onColor, numberOf, backLabel }) {
  const root = $("#drawer");
  const panel = $(".drawer__panel", root);
  const scroller = $(".drawer__scroll", root);
  const el = {
    no: $("#d-no"),
    code: $("#d-code"),
    name: $("#d-name"),
    price: $("#d-price"),
    figure: $("#d-figure"),
    desc: $("#d-desc"),
    cat: $("#d-cat"),
    fabric: $("#d-fabric"),
    fit: $("#d-fit"),
    label: $("#d-label"),
    colorName: $("#d-color-name"),
    swatches: $("#d-swatches"),
    sizesSet: $("#d-sizes"),
    sizeKind: $("#d-size-kind"),
    sizeList: $("#d-size-list"),
    sizeError: $("#d-size-error"),
    enquire: $("#d-enquire"),
    back: $("#d-back"),
  };
  const page = [$("main"), $(".masthead"), $(".footer"), $(".wa-float")].filter(Boolean);
  const memory = new Map(); // product id -> { colorIndex, size }
  let product = null;
  let state = null;
  let lastFocus = null;
  let hideTimer = 0;

  const isWaist = (p) => p.sizes.every((s) => /^\d+$/.test(s));

  function renderFigure() {
    const c = product.colors[state.colorIndex];
    el.figure.innerHTML = media(product, c, { decorative: false, annotate: true });
  }

  function updateLink() {
    const c = product.colors[state.colorIndex];
    el.colorName.textContent = `· ${c.name}`;
    if (state.size) {
      el.enquire.href = waLink(productMessage(product, { color: c.name, size: state.size }));
      el.enquire.classList.remove("is-pending");
    } else {
      el.enquire.href = "#d-sizes";
      el.enquire.classList.add("is-pending");
    }
  }

  function render() {
    const n = numberOf(product);
    el.no.textContent = `No. ${pad(n)}`;
    el.code.textContent = product.code;
    el.name.textContent = product.name;
    el.price.textContent = formatPrice(product.price);
    el.desc.textContent = product.description;
    el.cat.textContent = product.category;
    el.fabric.textContent = product.fabric;
    el.fit.textContent = product.fit;
    el.label.textContent = `${CONFIG.brand} own label`;

    el.swatches.innerHTML = product.colors
      .map(
        (c, i) => `<label class="swatch" style="--c:${esc(c.hex)};--c2:${esc(c.hex2 || c.hex)}" data-pattern="${esc(c.pattern || "")}">
          <input type="radio" name="d-color" value="${i}" ${i === state.colorIndex ? "checked" : ""}>
          <span class="swatch__chip" aria-hidden="true"></span><span class="swatch__name">${esc(c.name)}</span>
        </label>`
      )
      .join("");

    el.sizeKind.textContent = isWaist(product) ? "Waist, inches" : "";
    el.sizeList.innerHTML = [...product.sizes, NOT_SURE]
      .map(
        (s) => `<label class="size ${s === NOT_SURE ? "size--help" : ""}">
          <input type="radio" name="d-size" value="${esc(s)}" ${s === state.size ? "checked" : ""}>
          <span>${s === NOT_SURE ? "Not sure, need help" : esc(s)}</span>
        </label>`
      )
      .join("");
    el.sizeError.textContent = "";
    el.sizesSet.classList.remove("is-shaking");
    el.back.textContent = backLabel();
    renderFigure();
    updateLink();
  }

  el.swatches.addEventListener("change", (e) => {
    if (e.target.name !== "d-color") return;
    state.colorIndex = Number(e.target.value);
    renderFigure();
    updateLink();
    onColor?.(product, product.colors[state.colorIndex]);
  });

  el.sizeList.addEventListener("change", (e) => {
    if (e.target.name !== "d-size") return;
    state.size = e.target.value;
    el.sizeError.textContent = "";
    updateLink();
  });

  el.enquire.addEventListener("click", (e) => {
    if (state?.size) return; // real wa.me link, opens in a new tab
    e.preventDefault();
    el.sizesSet.classList.remove("is-shaking");
    void el.sizesSet.offsetWidth;
    el.sizesSet.classList.add("is-shaking");
    el.sizeError.textContent = "Pick your size first, or choose “Not sure, need help”.";
    el.sizesSet.scrollIntoView({ block: "center", behavior: "smooth" });
    $("input", el.sizeList)?.focus({ preventScroll: true });
  });

  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) close();
  });

  root.addEventListener("keydown", (e) => {
    if ($("dialog[open]")) return; // the size-help dialog handles its own keys
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      const f = $$('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])', panel).filter(
        (n) => n.offsetParent !== null || n === document.activeElement
      );
      const radios = new Set();
      const focusables = f.filter((n) => {
        if (n.type !== "radio") return true;
        if (radios.has(n.name)) return false;
        const checked = $(`input[name="${n.name}"]:checked`, panel);
        if (checked && checked !== n) return false;
        radios.add(n.name);
        return true;
      });
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  /* Bottom-sheet drag to close (phones) */
  const grab = $(".drawer__grab", root);
  let dragY = null;
  grab.addEventListener("pointerdown", (e) => {
    dragY = e.clientY;
    grab.setPointerCapture(e.pointerId);
    panel.style.transition = "none";
  });
  grab.addEventListener("pointermove", (e) => {
    if (dragY === null) return;
    const dy = Math.max(0, e.clientY - dragY);
    panel.style.transform = `translateY(${dy}px)`;
  });
  const endDrag = (e) => {
    if (dragY === null) return;
    const dy = e.clientY - dragY;
    dragY = null;
    panel.style.transition = "";
    panel.style.transform = "";
    if (dy > 90) close();
  };
  grab.addEventListener("pointerup", endDrag);
  grab.addEventListener("pointercancel", endDrag);

  function open(p, { color, trigger } = {}) {
    clearTimeout(hideTimer);
    const wasOpen = !!product && !root.hidden;
    product = p;
    const saved = memory.get(p.id) || { colorIndex: 0, size: "" };
    if (color) {
      const idx = p.colors.findIndex((c) => c.name === color);
      if (idx >= 0) saved.colorIndex = idx;
    }
    state = saved;
    memory.set(p.id, state);
    render();
    scroller.scrollTop = 0;
    if (!wasOpen) lastFocus = trigger || document.activeElement;
    root.hidden = false;
    page.forEach((n) => (n.inert = true));
    document.documentElement.classList.add("is-locked");
    requestAnimationFrame(() => root.classList.add("is-open"));
    panel.focus({ preventScroll: true });
    history.replaceState(null, "", `#product-${p.id}`);
    onColor?.(p, p.colors[state.colorIndex]);
  }

  function close() {
    if (root.hidden || !product) return;
    root.classList.remove("is-open");
    page.forEach((n) => (n.inert = false));
    document.documentElement.classList.remove("is-locked");
    history.replaceState(null, "", location.pathname + location.search);
    const closed = product;
    product = null;
    hideTimer = setTimeout(() => (root.hidden = true), 420);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    onClose?.(closed);
  }

  return {
    open,
    close,
    get isOpen() {
      return !!product;
    },
    get product() {
      return product;
    },
  };
}

export function initSizeHelp() {
  const dlg = $("#sizehelp");
  $("#d-sizehelp").addEventListener("click", () => dlg.showModal());
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) dlg.close(); // click on the backdrop
  });
}

/* ------------------------------------------------------------------ */
/* Loader: a tape that unrolls 0 → 100 cm                              */
/* ------------------------------------------------------------------ */
export function createLoader(reduced) {
  const el = $("#loader");
  const num = $("#loader-num");
  const fill = $(".loader__fill", el);
  const start = performance.now();
  let shown = 0;
  let target = 0;
  let finishing = false;
  let finished = false;
  let last = start;
  let resolveDone;
  const doneP = new Promise((r) => (resolveDone = r));

  function paint() {
    num.textContent = String(Math.round(shown)).padStart(3, "0");
    fill.style.clipPath = `inset(0 ${(100 - shown).toFixed(2)}% 0 0)`;
  }
  // Time-based (not frame-based), so it still finishes if frames are throttled.
  function step() {
    if (finished) return;
    const now = performance.now();
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (shown < target) {
      const rate = finishing ? 9 : 3.5;
      shown = Math.min(target, shown + Math.max(22 * dt, (target - shown) * (1 - Math.exp(-dt * rate))));
    }
    paint();
    if (finishing && shown >= 100 && now - start > 1100) finish();
  }
  function loop() {
    step();
    if (!finished) requestAnimationFrame(loop);
  }
  // fallback ticker for throttled/background tabs
  const bg = setInterval(() => {
    if (finished) clearInterval(bg);
    else if (performance.now() - last > 200) step();
  }, 250);
  function finish() {
    if (finished) return;
    finished = true;
    clearInterval(bg);
    el.classList.add("is-done");
    document.body.classList.remove("is-loading");
    el.setAttribute("aria-busy", "false");
    setTimeout(() => (el.hidden = true), reduced ? 50 : 900);
    resolveDone();
  }

  if (reduced) {
    clearInterval(bg);
    return {
      set() {},
      done() {
        shown = 100;
        paint();
        finish();
        return doneP;
      },
    };
  }
  requestAnimationFrame(loop);
  return {
    set(p) {
      target = Math.max(target, Math.min(99, p));
    },
    done() {
      finishing = true;
      target = 100;
      return doneP;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Measuring tape scroll indicator                                     */
/* ------------------------------------------------------------------ */
export function initTape() {
  const el = $(".tape");
  const nums = $(".tape__nums", el);
  const read = $(".tape__read", el);
  nums.innerHTML = Array.from({ length: 15 }, (_, i) => `<span style="left:${((i + 1) * 100) / 15}%">${(i + 1) * 10}</span>`).join("");
  let queued = false;
  const update = () => {
    queued = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    el.style.setProperty("--p", p.toFixed(4));
    read.textContent = `${Math.round(p * 150)} cm`;
  };
  const queue = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(update);
    }
  };
  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", queue);
  update();
  return { update: queue };
}

/* ------------------------------------------------------------------ */
/* Film grain                                                          */
/* ------------------------------------------------------------------ */
export function initGrain(reduced) {
  if (reduced) return;
  const el = $(".grain");
  const size = 140;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  el.style.backgroundImage = `url(${c.toDataURL("image/png")})`;
  el.classList.add("is-on");
}

/* ------------------------------------------------------------------ */
/* Custom cursor: crosshair → "VIEW" tag                               */
/* ------------------------------------------------------------------ */
export function initCursor(reduced) {
  const noop = { setView() {} };
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return noop;
  const el = $(".cursor");
  document.documentElement.classList.add("has-cursor");
  let x = -100;
  let y = -100;
  let cx = x;
  let cy = y;
  let raf = 0;
  let overTarget = false;
  let forced = false;
  const k = reduced ? 1 : 0.32;
  const tick = () => {
    cx += (x - cx) * k;
    cy += (y - cy) * k;
    el.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
    raf = Math.abs(x - cx) + Math.abs(y - cy) > 0.2 ? requestAnimationFrame(tick) : 0;
  };
  addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return;
      x = e.clientX;
      y = e.clientY;
      el.classList.add("is-active");
      if (!raf) raf = requestAnimationFrame(tick);
    },
    { passive: true }
  );
  document.addEventListener("pointerover", (e) => {
    overTarget = !!e.target.closest?.("[data-cursor]");
    el.classList.toggle("is-view", overTarget || forced);
  });
  document.documentElement.addEventListener("pointerleave", () => el.classList.remove("is-active"));
  return {
    setView(v) {
      forced = v;
      el.classList.toggle("is-view", overTarget || forced);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Hover swing ticket + front caption + chalk marks (3D mode)          */
/* ------------------------------------------------------------------ */
export function createRailTag() {
  const el = $("#railtag");
  return {
    show(p, n) {
      el.innerHTML = `<span class="railtag__no">No. ${pad(n)}</span><span class="railtag__name">${esc(p.name)}</span><span class="railtag__price">${formatPrice(p.price)}</span>`;
      el.hidden = false;
    },
    move(x, y) {
      el.style.transform = `translate3d(${x.toFixed(0)}px, ${y.toFixed(0)}px, 0)`;
    },
    hide() {
      el.hidden = true;
    },
  };
}

export function setFront(p, n) {
  const info = $("#front-info");
  info.dataset.id = p.id;
  info.innerHTML = `<span class="front__no">No. ${pad(n)}</span><span class="front__name">${esc(p.name)}</span><span class="front__price">${formatPrice(p.price)}</span><span class="front__cta">View</span>`;
  info.setAttribute("aria-label", `View ${p.name}, ${formatPrice(p.price)}`);
}

/** Tailor's chalk marks drawn around the focused garment (rect in hero px). */
export function drawChalk(p, rect) {
  const svg = $("#chalk-overlay");
  const hero = svg.parentElement.getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${hero.width.toFixed(0)} ${hero.height.toFixed(0)}`);
  const { x, y, w, h } = rect;
  const L = x + w * 0.16;
  const R = x + w * 0.84;
  const top = Math.max(18, y - 16);
  const ticks = [];
  for (let i = 0; i <= 16; i++) {
    const tx = L + ((R - L) * i) / 16;
    const th = i % 4 === 0 ? 8 : 4;
    ticks.push(`M ${tx.toFixed(1)} ${top - th} L ${tx.toFixed(1)} ${top}`);
  }
  const ax = Math.max(16, x - 170);
  const ay = y + h * 0.42;
  const bx = x + w + 24;
  const by = y + h * 0.7;
  svg.innerHTML = `<defs><filter id="chalkf"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="1" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3"/></filter></defs>
    <g filter="url(#chalkf)" fill="none" stroke="#ECE7DF" stroke-width="1.8" stroke-linecap="round" opacity=".8">
      <path pathLength="1" class="c-draw" d="M ${L} ${top} L ${R} ${top}"/>
      <path class="c-fade" stroke-width="1.2" d="${ticks.join(" ")}"/>
      <ellipse class="c-fade" cx="${x + w / 2}" cy="${y + h * 0.1}" rx="${w * 0.2}" ry="${h * 0.075}" stroke-dasharray="6 7"/>
      <path pathLength="1" class="c-draw" d="M ${ax + 10} ${ay + 10} Q ${(ax + x) / 2 + 40} ${ay - 6} ${x + w * 0.14} ${ay + 18}"/>
      <path pathLength="1" class="c-draw" d="M ${bx + 120} ${by + 10} Q ${bx + 50} ${by - 4} ${x + w * 0.86} ${by + 16}"/>
      <path class="c-fade" d="M ${x + w * 0.72} ${y + h * 0.93} l 14 14 m 0 -14 l -14 14"/>
      <text class="c-fade" x="${ax}" y="${ay}" fill="#ECE7DF" stroke="none" font-family="'JetBrains Mono', monospace" font-size="12" letter-spacing="1.6">${esc(p.fabric.toUpperCase())}</text>
      <text class="c-fade" x="${bx + 122}" y="${by + 2}" fill="#ECE7DF" stroke="none" text-anchor="end" font-family="'JetBrains Mono', monospace" font-size="12" letter-spacing="1.6">${esc(`${p.fit} fit`.toUpperCase())}</text>
    </g>`;
  svg.classList.remove("is-on");
  void svg.getBoundingClientRect();
  svg.classList.add("is-on");
}

export function clearChalk() {
  const svg = $("#chalk-overlay");
  svg.classList.remove("is-on");
  svg.innerHTML = "";
}
