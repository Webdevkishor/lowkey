/**
 * The 3D workshop: a slowly turning steel rail under warm spotlights, a concrete
 * floor with a measuring-tape ring, fog, and ACES tone mapping.
 * Handles drag / swipe / horizontal-wheel rotation with inertia, hover, the
 * camera dolly on select, category re-spacing, and the light-up reveal.
 */
import * as THREE from "three";
import { gsap } from "gsap";
import { createGarment, shared, HOOK_Y } from "./garments.js";

const TAU = Math.PI * 2;
const R = 2.6; // rail radius (m)
const RAIL_Y = 2.4; // rail height
const TRACK_Y = RAIL_Y + 1.45; // lighting track above the rail
const MIN_SPACING = 0.62; // radians between garments when the rail is not full
const AUTO_SPEED = 0.07; // idle auto-rotate, rad/s
const WARM = new THREE.Color(1.0, 0.8, 0.58);

const wrap = (a) => {
  let x = (a + Math.PI) % TAU;
  if (x < 0) x += TAU;
  return x - Math.PI;
};
const damp = (dt, rate) => 1 - Math.exp(-dt * rate);
/** Yield to the browser between heavy steps (works in background tabs too, unlike rAF). */
const yieldToBrowser = () =>
  new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => resolve();
    ch.port2.postMessage(0);
  });

/* ------------------------------------------------------------------ */
/* Procedural pieces                                                   */
/* ------------------------------------------------------------------ */
function concreteTexture(size) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#77746e";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = (0.04 + Math.random() * 0.18) * size;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = Math.random() > 0.45;
    g.addColorStop(0, dark ? "rgba(30,28,26,0.10)" : "rgba(255,250,240,0.06)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = "rgba(25,24,22,0.35)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 14; k++) {
      x += (Math.random() - 0.5) * size * 0.06;
      y += Math.random() * size * 0.04;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** A tiny "room" rendered into an environment map so steel has something to reflect. */
function buildEnvMap(renderer) {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(12, 8, 12),
    new THREE.MeshBasicMaterial({ color: 0x141312, side: THREE.BackSide })
  );
  env.add(room);
  const panel = (w, h, color, x, y, z, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.lookAt(0, 0, 0);
    env.add(m);
    return m;
  };
  panel(5, 0.6, new THREE.Color(6, 4.6, 3.2), 0, 3.8, 0);
  panel(1.6, 3, new THREE.Color(2.2, 1.8, 1.4), -5.5, 1, 1);
  panel(1.2, 2.4, new THREE.Color(0.9, 1.0, 1.2), 5.5, 0.6, -2);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.04).texture;
  pmrem.dispose();
  env.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
  return tex;
}

const beamVert = /* glsl */ `
  varying float vH;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vH = uv.y;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const beamFrag = /* glsl */ `
  uniform float uI;
  uniform vec3 uColor;
  varying float vH;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float edge = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);
    float along = 0.08 + 0.92 * pow(vH, 1.7);
    gl_FragColor = vec4(uColor * (uI * edge * along * 0.075), 1.0);
  }`;
const poolFrag = /* glsl */ `
  uniform float uI;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float a = pow(clamp(1.0 - r, 0.0, 1.0), 2.2);
    gl_FragColor = vec4(uColor * (uI * a * 0.32), 1.0);
  }`;
const poolVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/* ------------------------------------------------------------------ */
/* Public                                                              */
/* ------------------------------------------------------------------ */
export async function createRail(opts) {
  const { container, products, reduced, onProgress, onHover, onHoverMove, onSelect, onFront, onFocused, onInteract } = opts;

  const mobileMQ = matchMedia("(max-width: 720px)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const isMobile = () => mobileMQ.matches;
  const lowSpec = isMobile() || !finePointer;
  const dprCap = lowSpec ? 1.5 : 2;
  let dpr = Math.min(window.devicePixelRatio || 1, dprCap);

  /* ---------- renderer ---------- */
  const renderer = new THREE.WebGLRenderer({
    antialias: !lowSpec || dpr < 1.5,
    powerPreference: "high-performance",
  });
  const quality = {
    mobile: lowSpec,
    texW: lowSpec ? 384 : 512,
    grid: lowSpec ? [24, 30] : [34, 42],
    msaa: !!renderer.getContext().getContextAttributes()?.antialias,
  };
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x121110);
  scene.fog = new THREE.FogExp2(0x121110, 0.072);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  performance.mark("lowkey:renderer");
  const envMap = buildEnvMap(renderer);
  performance.mark("lowkey:env");
  shared.uSway.value = reduced ? 0 : 1;

  /* ---------- floor ---------- */
  const floorTex = concreteTexture(lowSpec ? 512 : 1024);
  floorTex.repeat.set(7, 7);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(18, 64),
    new THREE.MeshStandardMaterial({ map: floorTex, color: 0x77736d, roughness: 0.95, metalness: 0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  performance.mark("lowkey:floor");

  /* ---------- the rig (rotates as one) ---------- */
  const rig = new THREE.Group();
  scene.add(rig);
  const steel = new THREE.MeshStandardMaterial({ color: 0xd9d5ce, metalness: 1, roughness: 0.22, envMap, envMapIntensity: 1.1 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x2a2826, metalness: 0.8, roughness: 0.45, envMap, envMapIntensity: 0.5 });
  const railMesh = new THREE.Mesh(new THREE.TorusGeometry(R, 0.017, 10, 200), steel);
  railMesh.rotation.x = Math.PI / 2;
  railMesh.position.y = RAIL_Y;
  railMesh.castShadow = true;
  rig.add(railMesh);
  const track = new THREE.Mesh(new THREE.TorusGeometry(R, 0.028, 8, 160), darkSteel);
  track.rotation.x = Math.PI / 2;
  track.position.y = TRACK_Y;
  rig.add(track);
  const rodGeo = new THREE.CylinderGeometry(0.007, 0.007, TRACK_Y - RAIL_Y, 6);
  const ceilGeo = new THREE.CylinderGeometry(0.009, 0.009, 6, 6);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + TAU / 12;
    const rod = new THREE.Mesh(rodGeo, steel);
    rod.position.set(Math.sin(a) * R, (RAIL_Y + TRACK_Y) / 2, Math.cos(a) * R);
    rig.add(rod);
    if (k % 2 === 0) {
      const up = new THREE.Mesh(ceilGeo, darkSteel);
      up.position.set(Math.sin(a) * R, TRACK_Y + 3, Math.cos(a) * R);
      rig.add(up);
    }
  }

  // measuring-tape ring on the floor
  {
    const r0 = R + 0.62;
    const pts = [];
    for (let k = 0; k < 360; k++) {
      const a = (k / 360) * TAU;
      const len = k % 10 === 0 ? 0.13 : k % 5 === 0 ? 0.085 : 0.045;
      const s = Math.sin(a);
      const c = Math.cos(a);
      pts.push(s * r0, 0.004, c * r0, s * (r0 + len), 0.004, c * (r0 + len));
      const a2 = ((k + 1) / 360) * TAU;
      pts.push(s * (r0 + 0.17), 0.004, c * (r0 + 0.17), Math.sin(a2) * (r0 + 0.17), 0.004, Math.cos(a2) * (r0 + 0.17));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const ring = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xb07a4a, transparent: true, opacity: 0.5 }));
    rig.add(ring);
    const band = new THREE.Mesh(
      new THREE.RingGeometry(r0, r0 + 0.17, 180),
      new THREE.MeshBasicMaterial({ color: 0xb07a4a, transparent: true, opacity: 0.07, depthWrite: false })
    );
    band.rotation.x = -Math.PI / 2;
    band.position.y = 0.003;
    rig.add(band);
  }

  /* ---------- lights ---------- */
  const hemi = new THREE.HemisphereLight(0x6a625a, 0x0c0b0b, 0);
  scene.add(hemi);
  // near-neutral key light so product colours stay true; warmth comes from the beams
  const key = new THREE.SpotLight(0xfff0e2, 0, 0, 0.36, 0.8, 2);
  key.position.set(0.6, TRACK_Y + 1.7, R + 1.9);
  key.target.position.set(0, 1.95, R);
  key.castShadow = true;
  key.shadow.mapSize.set(lowSpec ? 512 : 1024, lowSpec ? 512 : 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 14;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key, key.target);
  const fills = [-1, 1].map((s) => {
    const f = new THREE.SpotLight(0xffe9d6, 0, 0, 0.42, 0.9, 2);
    f.position.set(s * 2.9, TRACK_Y + 1.1, R + 0.9);
    f.target.position.set(s * 1.55, 1.95, R * 0.82);
    scene.add(f, f.target);
    return f;
  });
  const rim = new THREE.DirectionalLight(0xb7c6da, 0);
  rim.position.set(0, 4.5, -6);
  scene.add(rim);
  const LIGHT_TARGET = { hemi: 1.0, key: 105, fill: 34, rim: 1.3 };

  /* ---------- garments ---------- */
  const beamGeo = new THREE.ConeGeometry(0.8, TRACK_Y - 0.12, 32, 1, true);
  const poolGeo = new THREE.CircleGeometry(1.0, 48);
  const fixtureGeo = new THREE.CylinderGeometry(0.045, 0.065, 0.13, 14);
  const lensGeo = new THREE.CircleGeometry(0.05, 18);
  const items = [];
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const g = await createGarment(p, p.colors[0], { renderer, envMap, quality });
    const arm = new THREE.Group(); // rotates around the centre to place the garment on the rail
    const swing = new THREE.Group(); // pivot at the hook; tilts on hover, turns on focus
    swing.position.set(0, RAIL_Y, R);
    g.root.position.y = -HOOK_Y;
    swing.add(g.root);
    arm.add(swing);

    const beamMat = new THREE.ShaderMaterial({
      uniforms: { uI: { value: 0 }, uColor: { value: WARM } },
      vertexShader: beamVert,
      fragmentShader: beamFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(0, (TRACK_Y - 0.12) / 2, R);
    beam.renderOrder = 2;
    arm.add(beam);
    const poolMat = new THREE.ShaderMaterial({
      uniforms: { uI: { value: 0 }, uColor: { value: WARM } },
      vertexShader: poolVert,
      fragmentShader: poolFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, 0.006, R);
    pool.renderOrder = 1;
    arm.add(pool);
    const fixture = new THREE.Mesh(fixtureGeo, darkSteel);
    fixture.position.set(0, TRACK_Y - 0.08, R);
    arm.add(fixture);
    const lensMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, TRACK_Y - 0.146, R);
    arm.add(lens);

    rig.add(arm);
    items.push({
      p,
      g,
      arm,
      swing,
      beamMat,
      poolMat,
      lensMat,
      angle: (i / products.length) * TAU,
      slot: (i / products.length) * TAU,
      fade: 1,
      on: 0, // reveal: 0 = dark, 1 = lit
      hover: 0,
      light: 0.1,
      shown: true,
    });
    onProgress?.((i + 1) / products.length);
    performance.mark(`lowkey:garment-${i + 1}`);
    await yieldToBrowser();
  }
  const byId = new Map(items.map((it) => [it.p.id, it]));
  const hitTargets = () => items.filter((it) => it.shown && it.fade > 0.5).map((it) => it.g.mesh);

  /* ---------- state ---------- */
  const state = {
    rot: 0,
    vel: 0,
    target: null,
    dragging: false,
    lastInteract: performance.now(),
    focusId: null,
    hoverId: null,
    full: true,
    spacing: TAU / items.length,
    range: [0, TAU],
    layoutBusyUntil: 0,
    frontId: null,
  };
  const pointer = { x: 0, y: 0, inside: false };
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let size = { w: 1, h: 1 };

  /* ---------- camera ---------- */
  const cam = { x: 0, y: 2, z: R + 4.4, tx: 0, ty: 1.8, tz: R, fov: 30, sx: 0, sy: 0 };
  function baseView() {
    if (isMobile()) return { x: 0, y: 2.05, z: R + 3.05, tx: 0, ty: 1.97, tz: R, fov: 40, sx: 0, sy: -0.05 };
    const narrow = size.w < 1100;
    return { x: 0, y: 2.2, z: R + 4.6, tx: 0, ty: 1.95, tz: R - 0.3, fov: 30, sx: narrow ? -0.08 : -0.13, sy: 0 };
  }
  function focusView() {
    if (isMobile()) return { x: 0, y: 2.1, z: R + 3.1, tx: 0, ty: 2.0, tz: R, fov: 40, sx: 0, sy: 0.18 };
    const drawerW = Math.min(460, size.w);
    return { x: 0.12, y: 2.1, z: R + 2.7, tx: 0, ty: 2.0, tz: R, fov: 30, sx: drawerW / 2 / size.w, sy: 0 };
  }
  Object.assign(cam, baseView());
  let camTween = null;
  function moveCamera(view, onComplete) {
    camTween?.kill();
    if (reduced) {
      Object.assign(cam, view);
      onComplete?.();
      return;
    }
    camTween = gsap.to(cam, { ...view, duration: 1.25, ease: "power3.inOut", onComplete });
  }
  function applyCamera() {
    camera.fov = cam.fov;
    camera.aspect = size.w / size.h;
    camera.position.set(cam.x, cam.y, cam.z);
    camera.lookAt(cam.tx, cam.ty, cam.tz);
    if (Math.abs(cam.sx) > 1e-4 || Math.abs(cam.sy) > 1e-4) {
      camera.setViewOffset(size.w, size.h, cam.sx * size.w, cam.sy * size.h, size.w, size.h);
    } else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  function resize() {
    const r = container.getBoundingClientRect();
    size = { w: Math.max(1, r.width), h: Math.max(1, r.height) };
    renderer.setSize(size.w, size.h, false);
    if (!camTween?.isActive()) Object.assign(cam, state.focusId ? focusView() : baseView());
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  /* ---------- layout & filtering ---------- */
  const visibleItems = () => items.filter((it) => it.shown);
  const frontAngleRange = () => state.range;

  function layout(cat, animate = true) {
    const show = items.filter((it) => cat === "All" || it.p.category === cat);
    if (!show.length) return;
    const n = show.length;
    // nearly a full circle at the minimum spacing → spread evenly all the way round
    state.full = n * MIN_SPACING > TAU * 0.85;
    state.spacing = state.full ? TAU / n : MIN_SPACING;
    const base = -state.rot; // the angle currently facing the camera
    const dur = reduced || !animate ? 0 : 0.95;
    state.range = [base, base + (n - 1) * state.spacing];
    state.layoutBusyUntil = performance.now() + (dur + n * 0.03) * 1000 + 80;
    items.forEach((it) => gsap.killTweensOf(it, "angle,fade"));
    show.forEach((it, i) => {
      const target = base + i * state.spacing;
      it.slot = target; // where it will end up: navigation uses this, even mid-slide
      if (!it.shown) {
        it.shown = true;
        it.arm.visible = true;
        it.angle = target - 0.7;
        it.fade = 0;
      }
      // travel the short way round, then settle on the exact slot angle
      const to = it.angle + wrap(target - it.angle);
      gsap.to(it, {
        angle: to,
        fade: 1,
        duration: dur,
        ease: "power3.inOut",
        delay: dur ? i * 0.03 : 0,
        onComplete: () => (it.angle = target),
      });
    });
    items
      .filter((it) => !show.includes(it))
      .forEach((it) => {
        if (!it.shown) return;
        it.shown = false;
        gsap.to(it, {
          angle: it.angle + 0.7,
          fade: 0,
          duration: dur * 0.8,
          ease: "power2.in",
          onComplete: () => {
            if (!it.shown) it.arm.visible = false;
          },
        });
      });
    state.vel = 0;
    state.target = state.rot;
    if (state.hoverId && !show.some((it) => it.p.id === state.hoverId)) setHover(null);
  }

  /* ---------- navigation ---------- */
  function frontItem(rot = state.rot, key = "angle") {
    let best = null;
    let bd = Infinity;
    for (const it of items) {
      if (!it.shown) continue;
      const d = Math.abs(wrap(it[key] + rot));
      if (d < bd) {
        bd = d;
        best = it;
      }
    }
    return best;
  }
  const rotFor = (it) => state.rot + wrap(-it.slot - state.rot);
  function snapNearest() {
    const f = frontItem(state.rot, "slot");
    if (f) state.target = rotFor(f);
    state.vel = 0;
  }
  function step(dir) {
    const v = visibleItems().sort((a, b) => a.slot - b.slot);
    if (!v.length) return null;
    // measure from where the rail is heading, so quick repeated clicks add up
    const f = frontItem(state.target ?? state.rot, "slot");
    let i = v.indexOf(f) + dir;
    if (i >= v.length) i = 0;
    if (i < 0) i = v.length - 1;
    interact();
    state.vel = 0;
    state.target = rotFor(v[i]);
    return v[i].p;
  }
  function interact() {
    state.lastInteract = performance.now();
    onInteract?.();
  }
  function clampRot(r, soft) {
    if (state.full) return r;
    const [lo, hi] = frontAngleRange();
    const f = -r;
    if (f < lo) return soft ? -(lo - (lo - f) * 0.35) : -lo;
    if (f > hi) return soft ? -(hi + (f - hi) * 0.35) : -hi;
    return r;
  }

  /* ---------- hover & select ---------- */
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(hitTargets(), true)[0];
    if (!hit) return null;
    let o = hit.object;
    while (o && !o.userData.productId) o = o.parent;
    return o ? byId.get(o.userData.productId) : null;
  }
  const tagPoint = new THREE.Vector3();
  function screenOf(it, local) {
    tagPoint.copy(local);
    it.swing.localToWorld(tagPoint);
    tagPoint.project(camera);
    return { x: (tagPoint.x * 0.5 + 0.5) * size.w, y: (-tagPoint.y * 0.5 + 0.5) * size.h };
  }
  const TAG_LOCAL = new THREE.Vector3(0.05, 0.12, 0.02);
  function setHover(it) {
    const id = it ? it.p.id : null;
    if (id === state.hoverId) return;
    state.hoverId = id;
    onHover?.(it ? it.p : null, it ? screenOf(it, TAG_LOCAL) : null);
  }

  /* ---------- input ---------- */
  let down = null;
  let lastX = 0;
  let lastT = 0;
  const dragK = () => (isMobile() ? (state.spacing * 1.15) / size.w : (TAU / size.w) * 0.55);

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    down = { x: e.clientX, y: e.clientY, rot: state.rot, id: e.pointerId, moved: false };
    lastX = e.clientX;
    lastT = performance.now();
    state.vel = 0;
  });
  canvas.addEventListener("pointermove", (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.inside = true;
    if (!down || e.pointerId !== down.id) return;
    const dx = e.clientX - down.x;
    if (!down.moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(e.clientY - down.y)) {
      down.moved = true;
      state.dragging = true;
      state.target = null;
      canvas.setPointerCapture(e.pointerId);
      setHover(null);
      interact();
    }
    if (down.moved) {
      state.rot = clampRot(down.rot + dx * dragK(), true);
      const now = performance.now();
      const dt = (now - lastT) / 1000;
      if (dt > 0) state.vel = state.vel * 0.4 + (((e.clientX - lastX) * dragK()) / dt) * 0.6;
      lastX = e.clientX;
      lastT = now;
    }
  });
  const endPointer = (e, cancelled) => {
    if (!down || e.pointerId !== down.id) return;
    const wasDrag = down.moved;
    down = null;
    state.dragging = false;
    if (wasDrag) {
      if (performance.now() - lastT > 90) state.vel = 0;
      if (isMobile() || !state.full) {
        const flick = Math.abs(state.vel) > 0.6 ? Math.sign(state.vel) : 0;
        if (flick) {
          state.vel = 0;
          step(-flick);
        } else snapNearest();
      }
      interact();
    } else if (!cancelled) {
      const it = pick(e.clientX, e.clientY);
      if (it) {
        interact();
        onSelect?.(it.p);
      }
    }
  };
  canvas.addEventListener("pointerup", (e) => endPointer(e, false));
  canvas.addEventListener("pointercancel", (e) => endPointer(e, true));
  canvas.addEventListener("pointerleave", () => {
    pointer.inside = false;
    if (!down) setHover(null);
  });
  let wheelTimer = 0;
  canvas.addEventListener(
    "wheel",
    (e) => {
      // Horizontal wheel / trackpad swipe (or Shift + wheel) turns the rail;
      // plain vertical wheel keeps scrolling the page.
      const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
      if (!dx || state.focusId) return;
      e.preventDefault();
      state.target = null;
      state.vel = 0;
      state.rot = clampRot(state.rot - dx * 0.0022, true);
      interact();
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(snapNearest, 160);
    },
    { passive: false }
  );

  /* ---------- render loop ---------- */
  let raf = 0;
  let running = false;
  let inView = true;
  let last = performance.now();
  let slowFrames = 0;
  let settleUntil = performance.now() + 4000;
  let downgrades = 0;
  const bbox = new THREE.Box3();
  const corner = new THREE.Vector3();

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!reduced) shared.uTime.value += dt;

    // adaptive resolution for slower phones (ignore the busy seconds right after loading)
    if (now < settleUntil) slowFrames = 0;
    else if (dt > 1 / 38) slowFrames++;
    else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 50 && dpr > 1 && downgrades < 3) {
      dpr = Math.max(1, dpr - 0.25);
      downgrades++;
      slowFrames = 0;
      renderer.setPixelRatio(dpr);
      renderer.setSize(size.w, size.h, false);
    }

    // rail rotation
    if (state.target !== null && !state.dragging) {
      state.rot += (state.target - state.rot) * damp(dt, 7);
      if (Math.abs(state.target - state.rot) < 1e-4) {
        state.rot = state.target;
        state.target = null;
      }
    } else if (!state.dragging && !state.focusId) {
      if (Math.abs(state.vel) > 0.03) {
        state.rot = clampRot(state.rot + state.vel * dt, true);
        state.vel *= Math.exp(-dt * 2.6);
        if (Math.abs(state.vel) <= 0.03) snapNearest();
      } else if (!reduced && state.full && !isMobile() && now - state.lastInteract > 6000 && !state.hoverId) {
        state.rot -= AUTO_SPEED * dt;
      } else if (!state.full && now > state.layoutBusyUntil) {
        const c = clampRot(state.rot, false);
        if (c !== state.rot) state.target = c;
      }
    }
    rig.rotation.y = state.rot;

    // hover (mouse only)
    if (finePointer && pointer.inside && !down && !state.focusId) {
      const it = pick(pointer.x, pointer.y);
      setHover(it);
      if (it) onHoverMove?.(screenOf(it, TAG_LOCAL));
    }

    // per-garment light, hover swing, focus turn
    const t = shared.uTime.value;
    for (const it of items) {
      it.arm.rotation.y = it.angle;
      const focused = state.focusId === it.p.id;
      const hovered = state.hoverId === it.p.id;
      it.hover += ((hovered && !state.focusId ? 1 : 0) - it.hover) * damp(dt, 9);
      it.swing.rotation.x = -0.17 * it.hover;
      it.swing.position.z = R + 0.06 * it.hover;
      const spin = focused && !reduced ? Math.sin(t * 0.55) * 0.55 : 0;
      it.swing.rotation.y += (spin - it.swing.rotation.y) * damp(dt, 2.5);
      let lt = 1;
      if (state.focusId) lt = focused ? 1.25 : 0.28;
      else if (state.hoverId) lt = hovered ? 1.3 : 0.5;
      lt = (0.08 + 0.92 * it.on) * lt * it.fade;
      it.light += (lt - it.light) * damp(dt, 6);
      for (const m of it.g.materials) m.userData.u.uLight.value = it.light;
      for (const m of it.g.hangerMaterials) {
        m.transparent = it.fade < 0.999;
        m.opacity = it.fade;
      }
      const beam = it.on * it.fade * (state.focusId ? (focused ? 1.3 : 0.35) : state.hoverId ? (hovered ? 1.5 : 0.65) : 1);
      it.beamMat.uniforms.uI.value += (beam - it.beamMat.uniforms.uI.value) * damp(dt, 6);
      it.poolMat.uniforms.uI.value = it.beamMat.uniforms.uI.value;
      it.lensMat.color.copy(WARM).multiplyScalar(it.beamMat.uniforms.uI.value * 1.6);
    }

    // front piece
    const f = frontItem();
    if (f && f.p.id !== state.frontId) {
      state.frontId = f.p.id;
      onFront?.(f.p);
    }

    applyCamera();
    renderer.render(scene, camera);
  }
  function start() {
    if (running || !inView || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }
  const io = new IntersectionObserver(([en]) => {
    inView = en.isIntersecting;
    inView ? start() : stop();
  });
  io.observe(container);
  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener("visibilitychange", onVis);
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    stop();
    console.warn("[LOWKEY] WebGL context lost.");
  });

  // compile shaders off the main thread where supported, then draw the first (dark) frame
  applyCamera();
  try {
    await renderer.compileAsync(scene, camera);
  } catch {
    /* older drivers: the first render compiles instead */
  }
  renderer.render(scene, camera);
  performance.mark("lowkey:first-render");
  start();

  /* ---------- controller ---------- */
  return {
    reveal() {
      settleUntil = performance.now() + 3500;
      performance.mark("lowkey:reveal");
      const order = items
        .filter((it) => it.shown)
        .sort((a, b) => Math.abs(wrap(a.angle + state.rot)) - Math.abs(wrap(b.angle + state.rot)));
      if (reduced) {
        hemi.intensity = LIGHT_TARGET.hemi;
        key.intensity = LIGHT_TARGET.key;
        fills.forEach((f) => (f.intensity = LIGHT_TARGET.fill));
        rim.intensity = LIGHT_TARGET.rim;
        items.forEach((it) => (it.on = 1));
        return;
      }
      const tl = gsap.timeline();
      tl.to(hemi, { intensity: LIGHT_TARGET.hemi, duration: 1.6, ease: "power2.out" }, 0);
      tl.to(rim, { intensity: LIGHT_TARGET.rim, duration: 1.6 }, 0.2);
      // spotlights click on one by one, with a little flicker
      order.forEach((it, i) => {
        const at = 0.15 + i * 0.16;
        tl.to(it, { on: 0.6, duration: 0.05 }, at)
          .to(it, { on: 0.15, duration: 0.06 }, at + 0.06)
          .to(it, { on: 1, duration: 0.35, ease: "power2.out" }, at + 0.13);
      });
      tl.to(key, { intensity: LIGHT_TARGET.key, duration: 0.5, ease: "power2.out" }, 0.25);
      fills.forEach((f, i) => tl.to(f, { intensity: LIGHT_TARGET.fill, duration: 0.6 }, 0.5 + i * 0.2));
    },
    focus(id) {
      const it = byId.get(id);
      if (!it || !it.shown) return false;
      state.focusId = id;
      setHover(null);
      state.vel = 0;
      state.target = rotFor(it);
      interact();
      moveCamera(focusView(), () => {
        if (state.focusId !== id) return;
        bbox.setFromObject(it.swing);
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (let k = 0; k < 8; k++) {
          corner.set(k & 1 ? bbox.max.x : bbox.min.x, k & 2 ? bbox.max.y : bbox.min.y, k & 4 ? bbox.max.z : bbox.min.z);
          corner.project(camera);
          const x = (corner.x * 0.5 + 0.5) * size.w;
          const y = (-corner.y * 0.5 + 0.5) * size.h;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
        onFocused?.(it.p, { x: minX, y: minY, w: maxX - minX, h: maxY - minY });
      });
      return true;
    },
    release() {
      if (!state.focusId) return;
      state.focusId = null;
      interact();
      moveCamera(baseView());
    },
    setColor(id, color) {
      byId.get(id)?.g.setColor(color).catch((err) => console.warn("[LOWKEY] colour change failed", err));
    },
    setFilter(cat) {
      layout(cat, true);
    },
    next: () => step(1),
    prev: () => step(-1),
    front: () => frontItem()?.p || null,
    dispose() {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      gsap.killTweensOf(items);
      camTween?.kill();
      items.forEach((it) => {
        it.g.dispose();
        it.beamMat.dispose();
        it.poolMat.dispose();
        it.lensMat.dispose();
      });
      scene.traverse((o) => {
        if (o.isMesh || o.isLineSegments) {
          o.geometry?.dispose();
          if (o.material && !Array.isArray(o.material)) o.material.dispose();
        }
      });
      floorTex.dispose();
      envMap.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
