/**
 * Procedural 3D menswear on wooden hangers.
 *
 * Tops (shirts, tees) are built from the same outline as their 2D drawing
 * (flats.js): a curved front and back surface cut out with an alpha map, side
 * walls for thickness, and raised collars / pocket flaps. Jeans are a strip of
 * denim folded over the hanger bar. A vertex shader adds a gentle cloth sway.
 * If a product has a photo, it is shown on a cloth-curved panel instead.
 */
import * as THREE from "three";
import { garmentSpec, flatSVG, samplePath, W, H, shade } from "./flats.js";
import { CONFIG } from "./products.js";

export const S = 1 / 400; // drawing units → metres (a shirt is ~0.78 m long)
const TOP_Y = 40; // drawing y where the garment meets the hanger

/** Uniforms shared by every garment (time and sway amount). */
export const shared = { uTime: { value: 0 }, uSway: { value: 1 } };

/* ------------------------------------------------------------------ */
/* Path helpers                                                        */
/* ------------------------------------------------------------------ */
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* ------------------------------------------------------------------ */
/* Materials                                                           */
/* ------------------------------------------------------------------ */
function clothMaterial({ map, alphaMap = null, roughness = 0.86, top = 0, len = 0.8, side = THREE.FrontSide, msaa = false }) {
  const m = new THREE.MeshStandardMaterial({
    map,
    alphaMap,
    roughness,
    metalness: 0,
    side,
    alphaTest: alphaMap ? 0.5 : 0,
  });
  m.alphaToCoverage = !!(alphaMap && msaa);
  const u = {
    uLight: { value: 1 },
    uRim: { value: 1 },
    uTop: { value: top },
    uLen: { value: len },
    uPhase: { value: Math.random() * Math.PI * 2 },
  };
  m.userData.u = u;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u, { uTime: shared.uTime, uSway: shared.uSway });
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uTime;\nuniform float uSway;\nuniform float uTop;\nuniform float uLen;\nuniform float uPhase;"
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float hang = clamp((uTop - position.y) / uLen, 0.0, 1.0);
        float sw = hang * hang * uSway;
        float tt = uTime * 1.1 + uPhase;
        transformed.z += (sin(tt + position.y * 2.6) * 0.014 + sin(tt * 0.63 + position.x * 5.0) * 0.005) * sw;
        transformed.x += sin(tt * 0.8) * 0.008 * sw;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uLight;\nuniform float uRim;")
      .replace(
        "#include <opaque_fragment>",
        `outgoingLight *= uLight;
        {
          vec3 vdir = normalize(vViewPosition);
          float fres = pow(1.0 - clamp(abs(dot(normal, vdir)), 0.0, 1.0), 2.5);
          outgoingLight += vec3(1.0, 0.84, 0.66) * fres * uRim * uLight * 0.16;
        }
        #include <opaque_fragment>`
      );
  };
  m.customProgramCacheKey = () => "lowkey-cloth-v1";
  return m;
}

/** Each hanger gets its own materials so it can fade with its garment. */
function hangerMaterials(envMap) {
  return {
    wood: new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.5, metalness: 0 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xc8c3bb, roughness: 0.28, metalness: 1, envMap, envMapIntensity: 0.9 }),
  };
}

/* ------------------------------------------------------------------ */
/* Hanger: origin = apex of the wooden arch; hook centre at HOOK_Y      */
/* ------------------------------------------------------------------ */
export const HOOK_Y = 0.064;
export const BAR_Y = -0.056;

export function createHanger(halfWidth, envMap) {
  const { wood, metal } = hangerMaterials(envMap);
  const g = new THREE.Group();
  const hw = halfWidth;
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-hw, -0.04, 0),
    new THREE.Vector3(0, 0.03, 0),
    new THREE.Vector3(hw, -0.04, 0)
  );
  const parts = [];
  parts.push(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.0115, 8, false), wood));
  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.0115, 10, 8), wood);
    cap.position.set(s * hw, -0.04, 0);
    parts.push(cap);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.02, 6), wood);
    strut.position.set(s * (hw - 0.006), -0.048, 0);
    parts.push(strut);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, hw * 2 - 0.01, 8), wood);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = BAR_Y;
  parts.push(bar);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0032, 0.04, 6), metal);
  neck.position.y = 0.018;
  parts.push(neck);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0032, 6, 22, Math.PI * 1.3), metal);
  hook.rotation.set(0, Math.PI / 2, -Math.PI * 0.12);
  hook.position.y = HOOK_Y;
  parts.push(hook);
  parts.forEach((p) => {
    p.castShadow = true;
    g.add(p);
  });
  g.userData.materials = [wood, metal];
  g.userData.dispose = () => {
    parts.forEach((p) => p.geometry.dispose());
    wood.dispose();
    metal.dispose();
  };
  return g;
}

/* ------------------------------------------------------------------ */
/* Textures                                                            */
/* ------------------------------------------------------------------ */
function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function loadSVGImage(svg) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not draw garment texture"));
    };
    img.src = url;
  });
}

function canvasTexture(canvas, renderer, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return t;
}

async function topMap(product, color, texW, renderer, back = false) {
  const texH = Math.round((texW * H) / W);
  const svg = flatSVG(product, color, { texture: true, fillAll: true, width: texW, height: texH, decorative: true, back });
  const img = await loadSVGImage(svg);
  const c = makeCanvas(texW, texH);
  c.getContext("2d").drawImage(img, 0, 0, texW, texH);
  return canvasTexture(c, renderer);
}

function topAlpha(spec, texW, renderer) {
  const w = Math.round(texW / 2);
  const h = Math.round((w * H) / W);
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.setTransform(w / W, 0, 0, h / H, 0, 0);
  ctx.fillStyle = "#fff";
  ctx.fill(new Path2D(spec.body));
  spec.parts.forEach((p) => ctx.fill(new Path2D(p.d)));
  return canvasTexture(c, renderer, false);
}

/** Denim strip texture. Canvas top = waistband end, bottom = hem end. */
function jeansMap(product, color, spec, texW, renderer, layout) {
  const w = texW;
  const h = texW * 3;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  const base = color.hex;
  const light = shade(base, 0.28);
  const tan = "#C9A063";
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // twill
  ctx.strokeStyle = light;
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 1;
  for (let x = -h; x < w; x += 4) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + h * 0.55, h);
    ctx.stroke();
  }
  // speckle
  ctx.globalAlpha = 0.1;
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#ffffff" : "#000000";
    ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, Math.random() * 6 + 1);
  }
  // wash fade down the middle of the leg
  const fade = ctx.createLinearGradient(0, 0, w, 0);
  fade.addColorStop(0, "rgba(255,255,255,0)");
  fade.addColorStop(0.5, "rgba(255,255,255,0.22)");
  fade.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = fade;
  ctx.fillRect(0, h * 0.1, w, h * 0.9);
  ctx.globalAlpha = 1;

  const stitch = (pts, col = tan, width = 2, dash = [7, 5]) => {
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.restore();
  };

  // waistband
  const wb = h * 0.05;
  ctx.fillStyle = shade(base, -0.12);
  ctx.fillRect(0, 0, w, wb);
  stitch([[0, wb * 0.25], [w, wb * 0.25]]);
  stitch([[0, wb * 0.85], [w, wb * 0.85]]);
  // belt loops
  ctx.fillStyle = shade(base, 0.06);
  [0.16, 0.6].forEach((fx) => {
    ctx.fillRect(w * fx, -2, w * 0.06, wb * 1.4);
    stitch([[w * fx + 3, wb * 1.3], [w * fx + w * 0.06 - 3, wb * 1.3]], tan, 1.5, [4, 3]);
  });
  // leather patch with the brand
  ctx.fillStyle = "#9C6A3C";
  ctx.fillRect(w * 0.7, wb * 0.12, w * 0.24, wb * 0.95);
  ctx.fillStyle = "#3a2414";
  ctx.font = `${Math.round(wb * 0.55)}px Anton, Impact, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // the waistband side hangs upside down, so flip the text vertically to read
  // upright from the front
  ctx.save();
  ctx.translate(w * 0.82, wb * 0.62);
  ctx.scale(1, -1);
  ctx.fillText(CONFIG.brand || "LOWKEY", 0, 0, w * 0.2); // maxWidth keeps longer names on the patch
  ctx.restore();
  // yoke
  stitch([[0, h * 0.11], [w, h * 0.075]]);
  // back pocket with arcuate
  const pl = w * 0.27;
  const pr = w * 0.77;
  const pt = h * 0.1;
  const pb = h * 0.215;
  const pm = h * 0.245;
  ctx.strokeStyle = shade(base, -0.3);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pl, pt);
  ctx.lineTo(pr, pt);
  ctx.lineTo(pr, pb);
  ctx.lineTo((pl + pr) / 2, pm);
  ctx.lineTo(pl, pb);
  ctx.closePath();
  ctx.stroke();
  stitch([[pl + 5, pt + 4], [pl + 5, pb - 2], [(pl + pr) / 2, pm - 6], [pr - 5, pb - 2], [pr - 5, pt + 4]]);
  ctx.save();
  ctx.strokeStyle = tan;
  ctx.lineWidth = 1.6;
  ctx.setLineDash([5, 4]);
  for (const off of [0, 8]) {
    ctx.beginPath();
    ctx.moveTo(pl + 8, pt + h * 0.05 + off);
    ctx.quadraticCurveTo((pl * 3 + pr) / 4, pt + h * 0.025 + off, (pl + pr) / 2, pt + h * 0.06 + off);
    ctx.quadraticCurveTo((pl + pr * 3) / 4, pt + h * 0.025 + off, pr - 8, pt + h * 0.05 + off);
    ctx.stroke();
  }
  ctx.restore();
  // seams along the edges
  stitch([[w * 0.035, 0], [w * 0.035, h]]);
  stitch([[w * 0.065, 0], [w * 0.065, h]]);
  ctx.strokeStyle = shade(base, -0.35);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.965, wb);
  ctx.lineTo(w * 0.965, h);
  ctx.stroke();
  // fold crease where it goes over the bar
  const fy = h * layout.foldStart;
  const fh = h * (layout.foldEnd - layout.foldStart);
  const crease = ctx.createLinearGradient(0, fy - fh, 0, fy + fh * 2);
  crease.addColorStop(0, "rgba(0,0,0,0)");
  crease.addColorStop(0.5, "rgba(0,0,0,0.28)");
  crease.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = crease;
  ctx.fillRect(0, fy - fh, w, fh * 3);
  // knee whiskers on the hem side
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    const y = h * (0.66 + i * 0.022);
    ctx.beginPath();
    ctx.moveTo(w * 0.25, y);
    ctx.quadraticCurveTo(w * 0.5, y - 10, w * 0.78, y + 4);
    ctx.stroke();
  }
  ctx.restore();
  // hem
  ctx.fillStyle = shade(base, -0.1);
  ctx.fillRect(0, h - h * 0.028, w, h * 0.028);
  stitch([[0, h - h * 0.022], [w, h - h * 0.022]]);
  stitch([[0, h - h * 0.007], [w, h - h * 0.007]]);
  // carpenter details on the hem side
  if (product.garmentType === "carpenter-jeans") {
    ctx.fillStyle = shade(base, 0.05);
    ctx.fillRect(w * 0.42, h * 0.64, w * 0.42, h * 0.11);
    stitch([[w * 0.42, h * 0.645], [w * 0.84, h * 0.645], [w * 0.84, h * 0.75], [w * 0.42, h * 0.75], [w * 0.42, h * 0.645]]);
    ctx.fillRect(0, h * 0.6, w * 0.09, h * 0.08);
    stitch([[w * 0.02, h * 0.605], [w * 0.02, h * 0.675]], tan, 1.5, [4, 3]);
  }
  return canvasTexture(c, renderer);
}

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */
function frontZ(sx, sy) {
  const dx = Math.min(1, Math.abs((sx - 200) / 150));
  const chest = 0.75 + 0.25 * Math.max(0, 1 - (sy - TOP_Y) / 300);
  return 0.006 + 0.022 * Math.cos(dx * Math.PI * 0.5) * chest;
}
const backZ = (sx, sy) => -(0.004 + 0.6 * (frontZ(sx, sy) - 0.006));

function buildTopGeometry(spec, nx, ny) {
  const fit = spec.fitScale;
  const outline = samplePath(spec.body)[0];
  const polys = [outline, ...spec.parts.flatMap((p) => samplePath(p.d))];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  polys.flat().forEach(([x, y]) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  });
  minX -= 3;
  minY -= 3;
  maxX += 3;
  maxY += 3;
  const inside = (x, y) => polys.some((p) => pointInPoly(x, y, p));
  const lx = (sx) => (sx - 200) * S * fit;
  const ly = (sy) => -(sy - TOP_Y) * S;

  const pos = [];
  const uv = [];
  const idx = []; // front surface + side walls (material 0)
  const idxBack = []; // back surface (material 1)
  const cols = nx + 1;
  const rows = ny + 1;
  const gx = (i) => minX + ((maxX - minX) * i) / nx;
  const gy = (j) => minY + ((maxY - minY) * j) / ny;
  const isIn = new Uint8Array(cols * rows);
  for (const side of [0, 1]) {
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const sx = gx(i);
        const sy = gy(j);
        pos.push(lx(sx), ly(sy), side === 0 ? frontZ(sx, sy) : backZ(sx, sy));
        uv.push(sx / W, 1 - sy / H);
        if (side === 0) isIn[j * cols + i] = inside(sx, sy) ? 1 : 0;
      }
    }
  }
  const back = cols * rows;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      const keep =
        isIn[a] || isIn[b] || isIn[c] || isIn[d] || inside((gx(i) + gx(i + 1)) / 2, (gy(j) + gy(j + 1)) / 2);
      if (!keep) continue;
      idx.push(a, c, b, b, c, d); // front, facing +z
      idxBack.push(back + a, back + b, back + c, back + b, back + d, back + c); // back, facing -z
    }
  }
  // side walls around the body outline
  let area = 0;
  for (let k = 0; k < outline.length; k++) {
    const [x0, y0] = outline[k];
    const [x1, y1] = outline[(k + 1) % outline.length];
    area += lx(x0) * ly(y1) - lx(x1) * ly(y0);
  }
  const ccw = area > 0;
  for (let k = 0; k < outline.length; k++) {
    const p0 = outline[k];
    const p1 = outline[(k + 1) % outline.length];
    const base = pos.length / 3;
    // Sample the wall's texture a few units inside the outline, so the cut-out
    // mask reads fully opaque there (otherwise the walls look dashed).
    const ex = p1[0] - p0[0];
    const ey = p1[1] - p0[1];
    const len = Math.hypot(ex, ey) || 1;
    let nx = ey / len;
    let ny = -ex / len;
    if (!pointInPoly((p0[0] + p1[0]) / 2 + nx * 2, (p0[1] + p1[1]) / 2 + ny * 2, outline)) {
      nx = -nx;
      ny = -ny;
    }
    for (const [sx, sy] of [p0, p1]) {
      const ux = (sx + nx * 4) / W;
      const vy = 1 - (sy + ny * 4) / H;
      pos.push(lx(sx), ly(sy), frontZ(sx, sy));
      uv.push(ux, vy);
      pos.push(lx(sx), ly(sy), backZ(sx, sy));
      uv.push(ux, vy);
    }
    const f0 = base;
    const b0 = base + 1;
    const f1 = base + 2;
    const b1 = base + 3;
    if (ccw) idx.push(f0, b0, f1, f1, b0, b1);
    else idx.push(f0, f1, b0, f1, b1, b0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex([...idx, ...idxBack]);
  geo.addGroup(0, idx.length, 0);
  geo.addGroup(idx.length, idxBack.length, 1);
  geo.computeVertexNormals();
  return geo;
}

/** Raised collars and pocket flaps, merged into one geometry. */
function buildRaisedParts(spec) {
  const fit = spec.fitScale;
  const pos = [];
  const uv = [];
  for (const part of spec.parts.filter((p) => p.raise)) {
    const poly = samplePath(part.d)[0];
    if (!poly) continue;
    const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2((x - 200) * S * fit, -(y - TOP_Y) * S)));
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.004,
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.0015,
      bevelSegments: 1,
      curveSegments: 4,
    });
    const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
    const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    const z = frontZ(cx, cy) + 0.002;
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const sx = p.getX(i) / (S * fit) + 200;
      const sy = -p.getY(i) / S + TOP_Y;
      pos.push(p.getX(i), p.getY(i), p.getZ(i) + z);
      uv.push(sx / W, 1 - sy / H);
    }
    g.dispose();
  }
  if (!pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

const JEANS_WIDTH = { Slim: 0.85, Straight: 1, Regular: 1, Relaxed: 1.12, Loose: 1.2 };

/** Denim folded over the hanger bar: hem side hangs in front, waistband side behind. */
function buildJeansGeometry(product, segU, segV) {
  const r = 0.013;
  const Lf = 0.44; // hem side (front)
  const Lb = 0.52; // waistband side (back)
  const arc = Math.PI * r;
  const L = Lf + arc + Lb;
  const k = JEANS_WIDTH[product.fit] || 1;
  const wHem = 0.2 * k;
  const wKnee = 0.25 * k;
  const wWaist = 0.34 * Math.min(k, 1.06);
  const pos = [];
  const uv = [];
  const idx = [];
  for (let j = 0; j <= segV; j++) {
    const s = (L * j) / segV; // 0 = hem end, L = waist end
    let y;
    let z;
    let width;
    if (s < Lf) {
      const f = s / Lf;
      y = -(Lf - s);
      z = r + 0.012 * Math.sin(Math.PI * f) * (1 - f);
      width = wHem + (wKnee - wHem) * f;
    } else if (s <= Lf + arc) {
      const th = (s - Lf) / r;
      y = r * Math.sin(th);
      z = r * Math.cos(th);
      width = wKnee;
    } else {
      const d = s - Lf - arc;
      const f = d / Lb;
      y = -d;
      z = -r - 0.01 * Math.sin(Math.PI * f);
      width = wKnee + (wWaist - wKnee) * f;
    }
    for (let i = 0; i <= segU; i++) {
      const u = i / segU;
      pos.push((u - 0.5) * width, y + BAR_Y, z);
      uv.push(u, s / L);
    }
  }
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * (segU + 1) + i;
      const b = a + 1;
      const c = a + segU + 1;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // texture v runs hem (0) → waist (1); canvas top is the waist, so flipY keeps it aligned
  return { geo, layout: { foldStart: 1 - (Lf + arc) / L, foldEnd: 1 - Lf / L } };
}

/* ------------------------------------------------------------------ */
/* Product photos (JPG, or cut-out PNG / WebP with a see-through background) */
/* ------------------------------------------------------------------ */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load photo ${url}`));
    img.src = url;
  });
}

/**
 * Prepare a product photo for the rail. Trims see-through margins (so a cut-out
 * hangs right under the hanger), caps its size for phones, and returns a mask
 * (white = garment) plus the garment's average colour for its plain back.
 */
async function loadPhoto(url, renderer, maxPx) {
  const img = await loadImage(url);
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) throw new Error(`Empty photo ${url}`);

  // 1. find the garment's bounds and average colour on a small copy
  const sw = Math.min(256, iw);
  const sh = Math.max(1, Math.round((sw * ih) / iw));
  const small = makeCanvas(sw, sh);
  const sctx = small.getContext("2d", { willReadFrequently: true });
  sctx.drawImage(img, 0, 0, sw, sh);
  const px = sctx.getImageData(0, 0, sw, sh).data;
  let minX = sw;
  let minY = sh;
  let maxX = -1;
  let maxY = -1;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4;
      if (px[i + 3] < 128) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      r += px[i];
      g += px[i + 1];
      b += px[i + 2];
      n++;
    }
  }
  if (!n) throw new Error(`Photo is completely see-through: ${url}`);

  // 2. crop to the garment (small margin) at full resolution, capped at maxPx
  const pad = 2;
  const cx = Math.max(0, ((minX - pad) / sw) * iw);
  const cy = Math.max(0, ((minY - pad) / sh) * ih);
  const cw = Math.min(iw, ((maxX + 1 + pad) / sw) * iw) - cx;
  const ch = Math.min(ih, ((maxY + 1 + pad) / sh) * ih) - cy;
  const k = Math.min(1, maxPx / Math.max(cw, ch));
  const c = makeCanvas(Math.max(1, Math.round(cw * k)), Math.max(1, Math.round(ch * k)));
  c.getContext("2d").drawImage(img, cx, cy, cw, ch, 0, 0, c.width, c.height);

  // 3. mask from the photo's transparency (an ordinary JPG gives an all-white mask)
  const m = makeCanvas(c.width, c.height);
  const mctx = m.getContext("2d");
  mctx.drawImage(c, 0, 0);
  mctx.globalCompositeOperation = "source-in";
  mctx.fillStyle = "#fff";
  mctx.fillRect(0, 0, m.width, m.height);
  mctx.globalCompositeOperation = "destination-over";
  mctx.fillStyle = "#000";
  mctx.fillRect(0, 0, m.width, m.height);

  const avg = new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
  return { map: canvasTexture(c, renderer), mask: canvasTexture(m, renderer, false), aspect: c.height / c.width, avg };
}

/** Real-world size for a photo: about 0.7 m wide for tops (like the drawn shirts), capped in height. */
function photoSize(product, aspect) {
  const jeans = /jeans/.test(product.garmentType || "");
  const maxH = jeans ? 1.0 : 0.85;
  let w = jeans ? 0.42 : 0.7;
  let h = w * aspect;
  if (h > maxH) {
    h = maxH;
    w = h / aspect;
  }
  return { w, h };
}

function buildPhotoGeometry(w, h, segs) {
  const geo = new THREE.PlaneGeometry(w, h, segs, Math.max(2, Math.round((segs * h) / w)));
  geo.translate(0, -h / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (w / 2);
    p.setZ(i, 0.02 * Math.cos(Math.min(1, Math.abs(x)) * Math.PI * 0.5));
  }
  geo.computeVertexNormals();
  return geo;
}

/* ------------------------------------------------------------------ */
/* Public: one garment on its hanger                                   */
/* ------------------------------------------------------------------ */
/**
 * @returns {Promise<{ root, materials, height, setColor(color), dispose() }>}
 * root origin = apex of the hanger arch (garment hangs below it).
 */
export async function createGarment(product, color, { renderer, envMap, quality }) {
  const root = new THREE.Group();
  const spec = garmentSpec(product);
  const materials = [];
  const disposables = [];
  let mesh;
  let height;
  let setColor = async () => {};

  // 1. A real photo, if the owner added one
  if (product.image) {
    try {
      const photo = await loadPhoto(product.image, renderer, quality.mobile ? 768 : 1024);
      const { w, h } = photoSize(product, photo.aspect);
      const geo = buildPhotoGeometry(w, h, quality.mobile ? 16 : 24);
      // front: the photo, with see-through parts cut away
      const mat = clothMaterial({ map: photo.map, alphaMap: photo.mask, roughness: 0.8, top: 0, len: h, msaa: quality.msaa });
      mat.shadowSide = THREE.DoubleSide;
      // back: same outline in the garment's own colour (not the photo mirrored)
      const backMat = clothMaterial({ map: null, alphaMap: photo.mask, roughness: 0.9, top: 0, len: h, side: THREE.BackSide, msaa: quality.msaa });
      backMat.color.copy(photo.avg).multiplyScalar(0.85);
      backMat.userData.u.uPhase = mat.userData.u.uPhase;
      const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: photo.mask, alphaTest: 0.5 });
      mesh = new THREE.Mesh(geo, mat);
      mesh.customDepthMaterial = depthMat;
      mesh.position.y = -0.01;
      mesh.add(new THREE.Mesh(geo, backMat));
      materials.push(mat, backMat);
      disposables.push(geo, mat, backMat, depthMat, photo.map, photo.mask);
      height = h;
      const jeans = /jeans/.test(product.garmentType || "");
      root.add(createHanger(jeans ? 0.2 : Math.min(0.2, w * 0.3), envMap));
    } catch (err) {
      console.warn(`[LOWKEY] Photo for "${product.name}" could not be used, showing the drawing instead.`, err?.message || err);
      mesh = null; // fall through to the procedural garment
    }
  }

  // 2. Procedural jeans
  if (!mesh && spec.kind === "jeans") {
    const { geo, layout } = buildJeansGeometry(product, quality.mobile ? 8 : 12, quality.mobile ? 48 : 72);
    let map = jeansMap(product, color, spec, quality.texW, renderer, layout);
    const mat = clothMaterial({ map, roughness: 0.92, top: BAR_Y, len: 0.5, side: THREE.DoubleSide });
    mesh = new THREE.Mesh(geo, mat);
    materials.push(mat);
    disposables.push(geo, mat);
    height = 0.6;
    root.add(createHanger(0.2, envMap));
    setColor = async (c) => {
      const next = jeansMap(product, c, spec, quality.texW, renderer, layout);
      mat.map = next;
      map.dispose();
      map = next;
    };
    disposables.push({ dispose: () => map.dispose() });
  }

  // 3. Procedural tops (shirts, tees)
  if (!mesh) {
    const [nx, ny] = quality.grid;
    const geo = buildTopGeometry(spec, nx, ny);
    let map = await topMap(product, color, quality.texW, renderer);
    let backMap = await topMap(product, color, quality.texW / 2, renderer, true);
    const alphaMap = topAlpha(spec, quality.texW, renderer);
    const roughness = /linen|flannel|brushed/i.test(product.fabric) ? 0.95 : 0.84;
    const mat = clothMaterial({ map, alphaMap, roughness, top: 0, len: 0.8, msaa: quality.msaa });
    const backMat = clothMaterial({ map: backMap, alphaMap, roughness, top: 0, len: 0.8, msaa: quality.msaa });
    backMat.userData.u.uPhase = mat.userData.u.uPhase; // sway front and back together
    const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap, alphaTest: 0.5 });
    mesh = new THREE.Mesh(geo, [mat, backMat]);
    mesh.customDepthMaterial = depthMat;
    const raised = buildRaisedParts(spec);
    if (raised) {
      const pm = new THREE.Mesh(raised, mat);
      pm.castShadow = true;
      mesh.add(pm);
      disposables.push(raised);
    }
    materials.push(mat, backMat);
    disposables.push(geo, mat, backMat, alphaMap, depthMat, { dispose: () => (map.dispose(), backMap.dispose()) });
    height = (spec.bbox.maxY - TOP_Y) * S;
    const [l, r] = spec.shoulder;
    root.add(createHanger(((r - l) / 2) * S * spec.fitScale + 0.012, envMap));
    setColor = async (c) => {
      const [next, nextBack] = await Promise.all([
        topMap(product, c, quality.texW, renderer),
        topMap(product, c, quality.texW / 2, renderer, true),
      ]);
      mat.map = next;
      backMat.map = nextBack;
      map.dispose();
      backMap.dispose();
      map = next;
      backMap = nextBack;
    };
  }

  mesh.castShadow = true;
  mesh.userData.productId = product.id;
  mesh.children.forEach((c) => (c.userData.productId = product.id));
  root.add(mesh);
  const hanger = root.children.find((c) => c.userData.materials);

  return {
    root,
    mesh,
    materials,
    hangerMaterials: hanger ? hanger.userData.materials : [],
    height,
    setColor: (c) => setColor(c),
    dispose() {
      disposables.forEach((d) => d.dispose());
      hanger?.userData.dispose();
    },
  };
}
