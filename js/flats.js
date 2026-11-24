/**
 * Garment "flats": technical fashion drawings generated from product data.
 *
 * - garmentSpec(product) describes each garment's outline in a 400 x 480 box.
 *   The 3D meshes (garments.js) are built from the same outlines, so the
 *   2D drawing and the 3D garment always match.
 * - flatSVG(product, color, opts) renders that outline as an SVG string, used
 *   in the Index, the drawer, Shop the Look and as the 3D fabric texture.
 *
 * Paths use only absolute M / L / Q / Z commands (garments.js parses them).
 */
import { CONFIG } from "./products.js";

export const W = 400;
export const H = 480;
const CHALK = "#ECE7DF";
const TAN = "#C9A063";

let uid = 0;

/* ---------------- colour helpers ---------------- */
function rgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function luminance(hex) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** amt > 0 lightens towards white, amt < 0 darkens towards black. */
export function shade(hex, amt) {
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const [r, g, b] = rgb(hex).map((v) => Math.round((t - v) * p + v));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
const isLight = (hex) => luminance(hex) > 0.36;

/* ---------------- garment outlines ---------------- */
const FIT_SCALE = { Slim: 0.94, Regular: 1, Straight: 1, Relaxed: 1.06, Loose: 1.08 };

function shirtBody(hem = "curved") {
  const bottom =
    hem === "curved"
      ? "L 120 412 Q 132 450 200 452 Q 268 450 280 412"
      : "L 120 430 L 280 430";
  return `M 162 42 L 124 58 L 100 72 L 52 326 L 88 340 L 130 156 ${bottom} L 270 156 L 312 340 L 348 326 L 300 72 L 276 58 L 238 42 Q 200 58 162 42 Z`;
}

function shirtCommon(hem) {
  const hemStitch =
    hem === "curved"
      ? "M 125 404 Q 137 441 200 443 Q 263 441 275 404"
      : "M 124 421 L 276 421";
  const hemY = hem === "curved" ? 450 : 429;
  return {
    lines: [
      { d: `M 193 66 L 193 ${hemY}`, style: "seam" },
      { d: `M 207 66 L 207 ${hemY}`, style: "seam" },
      { d: hemStitch, style: "stitch" },
      { d: "M 58 296 L 94 310", style: "seam" },
      { d: "M 342 296 L 306 310", style: "seam" },
      { d: "M 160 190 Q 168 300 152 420", style: "drape" },
      { d: "M 242 200 Q 236 300 250 420", style: "drape" },
      { d: "M 80 160 Q 82 230 70 300", style: "drape" },
      { d: "M 320 160 Q 318 230 330 300", style: "drape" },
    ],
  };
}

function specShirt(variant) {
  const hem = variant === "overshirt" ? "straight" : "curved";
  const base = shirtCommon(hem);
  const collar =
    variant === "formal"
      ? [
          "M 162 40 Q 178 52 199 62 L 174 94 Q 160 70 148 50 Z",
          "M 238 40 Q 222 52 201 62 L 226 94 Q 240 70 252 50 Z",
        ]
      : [
          "M 162 40 Q 176 52 199 64 L 182 100 Q 166 76 150 52 Z",
          "M 238 40 Q 224 52 201 64 L 218 100 Q 234 76 250 52 Z",
        ];
  const spec = {
    kind: "top",
    body: shirtBody(hem),
    parts: [
      { d: "M 162 42 Q 200 26 238 42 L 232 49 Q 200 37 168 49 Z", fill: "inside" },
      { d: collar[0], fill: "self", raise: true },
      { d: collar[1], fill: "self", raise: true },
    ],
    lines: [...base.lines],
    dots: [],
    shoulder: [124, 276],
  };
  const buttonYs = variant === "overshirt" ? [112, 168, 224, 280, 336, 392] : [112, 160, 208, 256, 304, 352, 400];
  const r = variant === "overshirt" ? 5.2 : 4.2;
  for (const y of buttonYs) spec.dots.push({ cx: 200, cy: y, r, fill: "button" });
  spec.dots.push({ cx: 72, cy: 318, r: 2.6, fill: "button" }, { cx: 328, cy: 318, r: 2.6, fill: "button" });

  if (variant === "oxford") {
    spec.dots.push({ cx: 184, cy: 93, r: 2.6, fill: "button" }, { cx: 216, cy: 93, r: 2.6, fill: "button" });
    spec.lines.push(
      { d: "M 222 132 L 258 132 L 258 172 L 240 180 L 222 172 Z", style: "stitch" },
      { d: "M 222 140 L 258 140", style: "seam" }
    );
  }
  if (variant === "overshirt") {
    for (const x of [160, 240]) {
      spec.lines.push({
        d: `M ${x - 20} 140 L ${x + 20} 140 L ${x + 20} 194 L ${x} 200 L ${x - 20} 194 Z`,
        style: "stitch",
      });
      spec.parts.push({
        d: `M ${x - 22} 128 L ${x + 22} 128 L ${x + 22} 146 L ${x} 153 L ${x - 22} 146 Z`,
        fill: "self",
        raise: true,
      });
      spec.dots.push({ cx: x, cy: 145, r: 3.4, fill: "button" });
    }
  }
  return spec;
}

function specCampShirt() {
  return {
    kind: "top",
    body: "M 162 42 L 124 58 L 100 72 L 66 178 L 112 194 L 130 152 L 122 424 L 278 424 L 270 152 L 288 194 L 334 178 L 300 72 L 276 58 L 238 42 Q 200 58 162 42 Z",
    parts: [
      { d: "M 170 46 L 200 150 L 230 46 Q 200 60 170 46 Z", fill: "inside" },
      { d: "M 162 42 L 140 92 L 176 104 L 200 150 L 174 50 Z", fill: "self", raise: true },
      { d: "M 238 42 L 260 92 L 224 104 L 200 150 L 226 50 Z", fill: "self", raise: true },
    ],
    lines: [
      { d: "M 194 150 L 194 423", style: "seam" },
      { d: "M 206 150 L 206 423", style: "seam" },
      { d: "M 125 414 L 275 414", style: "stitch" },
      { d: "M 71 168 L 113 183", style: "stitch" },
      { d: "M 329 168 L 287 183", style: "stitch" },
      { d: "M 160 200 Q 168 300 154 418", style: "drape" },
      { d: "M 242 210 Q 236 300 248 418", style: "drape" },
    ],
    dots: [172, 222, 272, 322, 372].map((cy) => ({ cx: 200, cy, r: 4.6, fill: "button" })),
    shoulder: [124, 276],
  };
}

function specTee(variant) {
  const boxy = variant === "boxy";
  const body = boxy
    ? "M 164 40 Q 200 66 236 40 L 290 56 L 344 140 L 306 166 L 290 146 L 292 430 L 108 430 L 110 146 L 94 166 L 56 140 L 110 56 Z"
    : "M 166 40 Q 200 64 234 40 L 280 54 L 334 132 L 300 156 L 282 140 L 282 430 L 118 430 L 118 140 L 100 156 L 66 132 L 120 54 Z";
  const neckBack = boxy ? "M 164 40 Q 200 30 236 40 Q 200 66 164 40 Z" : "M 166 40 Q 200 30 234 40 Q 200 64 166 40 Z";
  const rib = boxy ? "M 170 42 Q 200 60 230 42" : "M 172 42 Q 200 58 228 42";
  const spec = {
    kind: "top",
    body,
    parts: [
      { d: neckBack, fill: "inside" },
      { d: "M 190 36 L 210 36 L 210 45 L 190 45 Z", fill: "label" },
    ],
    lines: [
      { d: rib, style: "seam" },
      { d: boxy ? "M 112 420 L 288 420" : "M 120 420 L 280 420", style: "stitch" },
      { d: boxy ? "M 63 135 L 99 160" : "M 72 128 L 104 150", style: "stitch" },
      { d: boxy ? "M 337 135 L 301 160" : "M 328 128 L 296 150", style: "stitch" },
      { d: boxy ? "M 116 60 Q 113 100 111 144" : "M 124 58 Q 121 96 119 138", style: "seam" },
      { d: boxy ? "M 284 60 Q 287 100 289 144" : "M 276 58 Q 279 96 281 138", style: "seam" },
      { d: "M 158 200 Q 166 310 150 424", style: "drape" },
      { d: "M 244 210 Q 236 310 252 424", style: "drape" },
    ],
    dots: [],
    shoulder: boxy ? [110, 290] : [120, 280],
    print: variant === "graphic",
  };
  return spec;
}

function specJeans(fit, carpenter) {
  const w = { Slim: 29, Straight: 36, Regular: 36, Relaxed: 42, Loose: 46 }[fit] || 36;
  const taper = fit === "Slim" ? 14 : 0;
  const L = 148;
  const R = 252;
  const body =
    `M 108 40 L 292 40 L 296 120 Q ${304 - taper} 260 ${R + w} 452 L ${R - w} 452 Q 214 300 202 206 ` +
    `L 198 206 Q 186 300 ${L + w} 452 L ${L - w} 452 Q ${96 + taper} 260 104 120 Z`;
  const spec = {
    kind: "jeans",
    body,
    parts: [
      { d: "M 108 40 L 292 40 L 293 64 L 107 64 Z", fill: "self" },
      ...[118, 160, 233, 275].map((x) => ({
        d: `M ${x} 35 L ${x + 8} 35 L ${x + 8} 70 L ${x} 70 Z`,
        fill: "self",
      })),
    ],
    lines: [
      { d: "M 110 59 L 290 59", style: "tan" },
      { d: "M 214 66 L 214 166 Q 214 186 199 193", style: "tan" },
      { d: "M 200 64 L 200 204", style: "seam" },
      { d: "M 144 64 Q 140 104 102 114", style: "seam" },
      { d: "M 151 64 Q 147 111 103 122", style: "tan" },
      { d: "M 256 64 Q 260 104 298 114", style: "seam" },
      { d: "M 249 64 Q 253 111 297 122", style: "tan" },
      { d: "M 262 74 L 286 74 L 288 96 L 264 98 Z", style: "tan" },
      { d: `M ${L - w + 3} 441 L ${L + w - 3} 441`, style: "tan" },
      { d: `M ${R - w + 3} 441 L ${R + w - 3} 441`, style: "tan" },
      { d: "M 176 214 Q 166 222 158 236", style: "drape" },
      { d: "M 180 226 Q 170 236 164 252", style: "drape" },
      { d: "M 224 214 Q 234 222 242 236", style: "drape" },
      { d: "M 220 226 Q 230 236 236 252", style: "drape" },
      { d: `M ${L - 8} 300 Q ${L + 4} 330 ${L - 2} 380`, style: "drape" },
      { d: `M ${R + 8} 300 Q ${R - 4} 330 ${R + 2} 380`, style: "drape" },
    ],
    dots: [
      { cx: 200, cy: 52, r: 6, fill: "metal" },
      { cx: 103, cy: 113, r: 2.8, fill: "copper" },
      { cx: 297, cy: 113, r: 2.8, fill: "copper" },
      { cx: 263, cy: 75, r: 2.2, fill: "copper" },
    ],
    shoulder: [108, 292],
    fades: [
      [L, 190],
      [R, 190],
      [L, 340],
      [R, 340],
    ],
  };
  if (carpenter) {
    spec.parts.push(
      { d: "M 112 232 L 146 228 L 149 322 L 116 326 Z", fill: "self" },
      { d: "M 292 196 L 306 196 L 305 270 L 291 270 Z", fill: "self" }
    );
    spec.lines.push({ d: "M 114 240 L 147 236", style: "tan" });
  }
  return spec;
}

export const GARMENT_TYPES = [
  "shirt",
  "formal-shirt",
  "overshirt",
  "camp-shirt",
  "jeans",
  "carpenter-jeans",
  "tee",
  "graphic-tee",
];

export function garmentSpec(product) {
  let spec;
  switch (product.garmentType) {
    case "formal-shirt":
      spec = specShirt("formal");
      break;
    case "overshirt":
      spec = specShirt("overshirt");
      break;
    case "camp-shirt":
      spec = specCampShirt();
      break;
    case "jeans":
      spec = specJeans(product.fit, false);
      break;
    case "carpenter-jeans":
      spec = specJeans(product.fit, true);
      break;
    case "tee":
      spec = specTee("boxy");
      break;
    case "graphic-tee":
      spec = specTee("graphic");
      break;
    case "shirt":
    default:
      spec = specShirt("oxford");
  }
  // The outlines above were drawn long; shorten tops to real garment proportions
  // (a hanging shirt is roughly as wide as it is long). Anchored at the neckline.
  const ky = spec.kind === "jeans" ? 1 : spec.print !== undefined ? 0.7 : 0.74;
  squash(spec, ky);
  spec.fitScale = spec.kind === "jeans" ? 1 : FIT_SCALE[product.fit] || 1;
  spec.bbox = bboxOf([spec.body, ...spec.parts.map((p) => p.d)]);
  return spec;
}

/* ---------------- path utilities (shared with garments.js) ---------------- */
const TOP = 40; // neckline y: the point garments hang from

/** Map the coordinates of an absolute M/L/Q/Z path; numbers come in x,y pairs. */
function mapPath(d, fx, fy) {
  let isX = true;
  return d.replace(/[MLQZ]|-?\d*\.?\d+/gi, (tok) => {
    if (/^[MLQZ]$/i.test(tok)) return tok;
    const v = parseFloat(tok);
    const out = isX ? fx(v) : fy(v);
    isX = !isX;
    return String(Math.round(out * 10) / 10);
  });
}

function squash(spec, ky) {
  if (ky === 1) return spec;
  const fy = (y) => TOP + (y - TOP) * ky;
  const id = (x) => x;
  spec.body = mapPath(spec.body, id, fy);
  spec.parts.forEach((p) => (p.d = mapPath(p.d, id, fy)));
  spec.lines.forEach((l) => (l.d = mapPath(l.d, id, fy)));
  spec.dots.forEach((d) => (d.cy = fy(d.cy)));
  (spec.fades || []).forEach((f) => (f[1] = fy(f[1])));
  spec.ky = ky;
  return spec;
}

/** Sample an absolute M/L/Q/Z SVG path into polygons of [x, y]. */
export function samplePath(d, qSteps = 8) {
  const t = d.match(/[MLQZ]|-?\d*\.?\d+/gi) || [];
  const polys = [];
  let cur = null;
  let cmd = "";
  let px = 0;
  let py = 0;
  let i = 0;
  const n = () => parseFloat(t[i++]);
  const close = () => {
    if (cur && cur.length > 2) {
      const a = cur[0];
      const b = cur[cur.length - 1];
      if (Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) cur.pop();
      polys.push(cur);
    }
    cur = null;
  };
  while (i < t.length) {
    const tok = t[i];
    if (/^[MLQZ]$/i.test(tok)) {
      cmd = tok.toUpperCase();
      i++;
      if (cmd === "Z") close();
      continue;
    }
    if (cmd === "M") {
      close();
      px = n();
      py = n();
      cur = [[px, py]];
      cmd = "L";
    } else if (cmd === "L" && cur) {
      px = n();
      py = n();
      cur.push([px, py]);
    } else if (cmd === "Q" && cur) {
      const cx = n();
      const cy = n();
      const x = n();
      const y = n();
      for (let s = 1; s <= qSteps; s++) {
        const k = s / qSteps;
        const a = (1 - k) * (1 - k);
        const b = 2 * (1 - k) * k;
        const c = k * k;
        cur.push([a * px + b * cx + c * x, a * py + b * cy + c * y]);
      }
      px = x;
      py = y;
    } else i++;
  }
  close();
  return polys;
}

function bboxOf(paths) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  paths.flatMap((d) => samplePath(d)).flat().forEach(([x, y]) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  });
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY };
}

/* ---------------- fabric fills ---------------- */
function fabricKind(product) {
  const f = `${product.fabric} ${product.garmentType}`.toLowerCase();
  if (f.includes("denim") || f.includes("jeans")) return "denim";
  if (f.includes("oxford")) return "oxford";
  if (f.includes("linen")) return "linen";
  if (f.includes("tee")) return "jersey";
  return "plain";
}

function patternDefs(id, color, kind) {
  const base = color.hex;
  const hi = isLight(base) ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.07)";
  const lo = "rgba(0,0,0,.12)";
  if (color.pattern === "check") {
    const c2 = color.hex2 || shade(base, -0.6);
    return `<pattern id="${id}-fab" width="44" height="44" patternUnits="userSpaceOnUse">
      <rect width="44" height="44" fill="${base}"/>
      <rect y="15" width="44" height="14" fill="${c2}" opacity=".55"/>
      <rect x="15" width="14" height="44" fill="${c2}" opacity=".55"/>
      <rect y="21" width="44" height="2" fill="${c2}" opacity=".7"/>
      <rect x="21" width="2" height="44" fill="${c2}" opacity=".7"/>
      <rect y="6" width="44" height="1" fill="#fff" opacity=".12"/>
      <rect x="6" width="1" height="44" fill="#fff" opacity=".12"/>
    </pattern>`;
  }
  if (kind === "denim") {
    return `<pattern id="${id}-fab" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
      <rect width="5" height="5" fill="${base}"/>
      <rect width="5" height="1.6" fill="${shade(base, 0.22)}" opacity=".55"/>
      <rect y="3" width="5" height=".8" fill="${lo}"/>
    </pattern>`;
  }
  if (kind === "oxford") {
    return `<pattern id="${id}-fab" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="4" fill="${base}"/>
      <rect width="2" height="2" fill="${hi}"/>
      <rect x="2" y="2" width="2" height="2" fill="${lo}" opacity=".5"/>
    </pattern>`;
  }
  if (kind === "linen") {
    return `<pattern id="${id}-fab" width="64" height="18" patternUnits="userSpaceOnUse">
      <rect width="64" height="18" fill="${base}"/>
      <rect x="4" y="3" width="30" height="1.2" fill="${hi}"/>
      <rect x="22" y="9" width="38" height="1" fill="${lo}"/>
      <rect x="0" y="14" width="18" height="1.3" fill="${hi}"/>
      <rect x="40" y="15" width="20" height=".9" fill="${lo}"/>
    </pattern>`;
  }
  if (kind === "jersey") {
    return `<pattern id="${id}-fab" width="3" height="6" patternUnits="userSpaceOnUse">
      <rect width="3" height="6" fill="${base}"/>
      <rect width="1" height="6" fill="${lo}" opacity=".45"/>
    </pattern>`;
  }
  return `<pattern id="${id}-fab" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="${base}"/></pattern>`;
}

/* ---------------- graphic print ---------------- */
function printSVG(color) {
  const ink = isLight(color.hex) ? "#1A1A1A" : CHALK;
  const brand = escapeXML(CONFIG.brand || "LOWKEY");
  // longer names are squeezed to the width of the tape strip so they stay on the chest
  const fit = brand.length > 4 ? ` textLength="128" lengthAdjust="spacingAndGlyphs"` : "";
  const size = brand.length > 4 ? 50 : 58;
  const ticks = Array.from({ length: 21 }, (_, i) => {
    const x = 138 + i * 6.2;
    const h = i % 5 === 0 ? 9 : 5;
    return `<rect x="${x.toFixed(1)}" y="196" width="1.4" height="${h}" fill="${ink}"/>`;
  }).join("");
  return `<g class="print" transform="translate(0 -30)">
    <text x="200" y="182" text-anchor="middle" font-family="Anton, Impact, 'Arial Narrow', sans-serif" font-size="${size}" letter-spacing="2"${fit} fill="${ink}">${brand}</text>
    <rect x="136" y="192" width="128" height="1.6" fill="${ink}"/>
    ${ticks}
    <text x="200" y="226" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="9.5" letter-spacing="2.4" fill="${ink}">CUT FOR THE EVERYDAY</text>
  </g>`;
}

/* ---------------- chalk annotations (drawer) ---------------- */
function annotations(id, product, spec) {
  const [l, r] = spec.shoulder;
  const b = spec.bbox;
  const fabric = escapeXML(product.fabric.toUpperCase());
  const fit = escapeXML(`${product.fit} fit`.toUpperCase());
  const top = Math.round(b.minY - 12);
  const tickMarks = [];
  for (let x = l; x <= r; x += 8) {
    const h = (x - l) % 40 === 0 ? 6 : 3;
    tickMarks.push(`M ${x} ${top - h} L ${x} ${top}`);
  }
  const ring =
    spec.kind === "jeans"
      ? `<ellipse cx="200" cy="56" rx="40" ry="24" stroke-dasharray="5 6"/>`
      : `<ellipse cx="200" cy="${(b.minY + 0.13 * b.h).toFixed(1)}" rx="48" ry="${(0.1 * b.h).toFixed(1)}" stroke-dasharray="5 6"/>`;
  const ay = Math.round(b.minY + 0.46 * b.h);
  const ax = Math.round(b.minX + 0.14 * b.w);
  const by = Math.round(b.minY + 0.72 * b.h);
  const bx = Math.round(b.maxX - 0.16 * b.w);
  const xx = Math.round(b.maxX - 0.2 * b.w);
  const xy = Math.round(b.maxY - 6);
  return `<g class="chalk" filter="url(#${id}-chalk)" fill="none" stroke="${CHALK}" stroke-width="1.6" stroke-linecap="round" opacity=".85">
    <path d="M ${l} ${top} L ${r} ${top}"/>
    <path d="${tickMarks.join(" ")}" stroke-width="1.1"/>
    ${ring}
    <path d="M -36 ${ay - 10} Q 10 ${ay - 14} ${ax} ${ay} M ${ax - 8} ${ay - 7} L ${ax} ${ay} L ${ax - 10} ${ay + 6}"/>
    <path d="M 436 ${by - 12} Q 390 ${by - 14} ${bx} ${by} M ${bx + 10} ${by - 7} L ${bx} ${by} L ${bx + 11} ${by + 6}"/>
    <path d="M ${xx} ${xy} l 14 14 M ${xx + 14} ${xy} l -14 14"/>
    <text x="-48" y="${ay - 24}" fill="${CHALK}" stroke="none" font-family="'JetBrains Mono', monospace" font-size="13" letter-spacing="1.5">${fabric}</text>
    <text x="448" y="${by - 26}" text-anchor="end" fill="${CHALK}" stroke="none" font-family="'JetBrains Mono', monospace" font-size="13" letter-spacing="1.5">${fit}</text>
  </g>`;
}

function escapeXML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
}

/**
 * Render a garment flat as an SVG string.
 * @param product  product object from products.js
 * @param color    one of product.colors (defaults to the first)
 * @param opts     { annotate: chalk marks, texture: plain version for 3D (no outline, no transform), label: aria-label }
 */
export function flatSVG(product, color = product.colors[0], opts = {}) {
  const spec = garmentSpec(product);
  const id = `g${++uid}`;
  const kind = fabricKind(product);
  const light = isLight(color.hex);
  const outline = light ? "rgba(26,26,26,.72)" : "rgba(236,231,223,.72)";
  const seam = light ? "rgba(26,26,26,.35)" : "rgba(236,231,223,.3)";
  const drape = light ? "rgba(0,0,0,.10)" : "rgba(0,0,0,.28)";
  const tex = !!opts.texture;
  const fab = `url(#${id}-fab)`;

  const fills = {
    self: fab,
    inside: shade(color.hex, light ? -0.25 : -0.35),
    label: "#B07A4A",
  };
  const dotFill = {
    button: light ? shade(color.hex, -0.12) : shade(color.hex, 0.25),
    metal: "#B9B3A7",
    copper: "#B7773F",
  };

  // opts.back: plain fabric for the back of a 3D garment (no buttons, pockets or print)
  const back = !!opts.back;
  const lineSVG = spec.lines
    .filter((ln) => !back || ln.style === "drape")
    .map((ln) => {
      if (ln.style === "drape") return `<path d="${ln.d}" stroke="${drape}" stroke-width="10" stroke-linecap="round" fill="none" opacity=".55"/>`;
      if (ln.style === "stitch") return `<path d="${ln.d}" stroke="${seam}" stroke-width="1.3" stroke-dasharray="4 3" fill="none"/>`;
      if (ln.style === "tan") return `<path d="${ln.d}" stroke="${TAN}" stroke-width="1.4" stroke-dasharray="4 2.5" fill="none" opacity=".9"/>`;
      return `<path d="${ln.d}" stroke="${seam}" stroke-width="1.3" fill="none"/>`;
    })
    .join("");

  const partSVG = spec.parts
    .filter(() => !back)
    .map(
      (p) =>
        `<path d="${p.d}" fill="${fills[p.fill] || fab}" stroke="${tex ? "rgba(0,0,0,.25)" : outline}" stroke-width="${tex ? 1.4 : 1.6}" stroke-linejoin="round"/>`
    )
    .join("");

  const dotSVG = spec.dots
    .filter(() => !back)
    .map(
      (d) =>
        `<circle cx="${d.cx}" cy="${d.cy}" r="${d.r}" fill="${dotFill[d.fill]}" stroke="${tex ? "rgba(0,0,0,.35)" : outline}" stroke-width="1"/>`
    )
    .join("");

  const fadeSVG = (spec.fades || [])
    .map((f, i) => `<ellipse cx="${f[0]}" cy="${f[1]}" rx="34" ry="${i < 2 ? 60 : 44}" fill="url(#${id}-fade)"/>`)
    .join("");

  const defs = `<defs>
    ${patternDefs(id, color, kind)}
    <clipPath id="${id}-clip"><path d="${spec.body}"/></clipPath>
    <linearGradient id="${id}-shade" x1="0" y1="0" x2=".35" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="${light ? 0.12 : 0.1}"/>
      <stop offset=".45" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="${light ? 0.16 : 0.3}"/>
    </linearGradient>
    <radialGradient id="${id}-fade"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    ${opts.annotate ? `<filter id="${id}-chalk"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="1" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.4"/></filter>` : ""}
  </defs>`;

  const garment = `
    ${opts.fillAll ? `<rect width="${W}" height="${H}" fill="${fab}"/>` : ""}
    <path d="${spec.body}" fill="${fab}" ${tex ? `stroke="${fab}" stroke-width="8"` : `stroke="${outline}" stroke-width="1.8"`} stroke-linejoin="round"/>
    <g clip-path="url(#${id}-clip)">
      ${fadeSVG}
      ${lineSVG}
      ${tex ? "" : `<rect width="${W}" height="${H}" fill="url(#${id}-shade)"/>`}
      ${spec.print && !back ? printSVG(color) : ""}
    </g>
    ${partSVG}
    ${dotSVG}`;

  const s = spec.fitScale;
  const body = tex || s === 1 ? garment : `<g transform="translate(200 0) scale(${s} 1) translate(-200 0)">${garment}</g>`;
  // Same scale for every garment, centred vertically on its own outline.
  const cy = spec.bbox.cy;
  // align: "top" pins the neckline near the top (used under the 2D hangers).
  const vy = opts.align === "top" ? Math.round(spec.bbox.minY - 6) : Math.round(cy - 240);
  const viewBox = tex ? `0 0 ${W} ${H}` : opts.annotate ? `-60 ${Math.round(cy - 250)} 520 500` : `0 ${vy} ${W} ${H}`;
  const label = escapeXML(opts.label || `${product.name} in ${color.name}`);
  const size = tex ? ` width="${opts.width || W}" height="${opts.height || H}"` : "";
  const a11y = opts.decorative ? `aria-hidden="true" focusable="false"` : `role="img" aria-label="${label}"`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${size} ${a11y} class="flat">
    ${defs}
    ${body}
    ${opts.annotate ? annotations(id, product, spec) : ""}
  </svg>`;
}

/** A small wooden hanger drawn above a flat (2D rail fallback). */
export function hangerSVG() {
  return `<svg class="hanger" viewBox="0 0 400 110" aria-hidden="true" focusable="false">
    <path d="M 200 72 L 200 46 Q 200 16 222 16 Q 242 16 242 36" fill="none" stroke="#A8A49C" stroke-width="5" stroke-linecap="round"/>
    <path d="M 96 104 Q 200 52 304 104" fill="none" stroke="#8A5A33" stroke-width="12" stroke-linecap="round"/>
    <path d="M 100 100 L 300 100" fill="none" stroke="#7A4E2B" stroke-width="5" stroke-linecap="round"/>
  </svg>`;
}
