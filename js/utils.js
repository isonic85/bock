(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const byId = (id) => document.getElementById(id);
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
  const show = (el, visible) => el && el.classList.toggle("hidden", !visible);
  const readNumber = (el) => el ? parseFloat(String(el.value).replace(",", ".").trim()) : NaN;
  const readExpressionNumber = (el) => {
  if (!el) return NaN;

  const raw = String(el.value ?? "").trim();
  if (!raw) return NaN;

  const normalized = raw
    .replace(/\s+/g, "")
    .replace(/,/g, ".")
    .replace(/mm|cm/gi, "");

  if (!/^[0-9+\-*/().]+$/.test(normalized)) return NaN;

  try {
    const result = Function(`"use strict"; return (${normalized});`)();
    return Number.isFinite(result) ? result : NaN;
  } catch {
    return NaN;
  }
};
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const degToRad = (deg) => deg * Math.PI / 180;
  const radToDeg = (rad) => rad * 180 / Math.PI;
  const fmt = (v, unit = "", d = 1) => Number.isFinite(v) ? `${v.toFixed(d)}${unit}` : "–";
  const fmtMm = (v, d = 1) => {
  const unit = window.appState?.unit || "mm";
  if (!Number.isFinite(v)) return "–";

  if (unit === "cm") {
    return `${(v / 10).toFixed(d)} cm`;
  }

  return `${v.toFixed(d)} mm`;
};
  const fmtDeg = (v, d = 1) => fmt(v, "°", d);

  const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
  const add3 = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
  const sub3 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const scale3 = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
  const dot3 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const cross3 = (a, b) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  });
  const len3 = (v) => Math.hypot(v.x, v.y, v.z);
  const dist3 = (a, b) => len3(sub3(b, a));

  function norm3(v) {
    const L = len3(v);
    return L < 1e-9 ? { x: 0, y: 0, z: 0, L: 0 } : { x: v.x / L, y: v.y / L, z: v.z / L, L };
  }

  function angleBetween3(a, b) {
    const na = norm3(a);
    const nb = norm3(b);
    if (na.L < 1e-9 || nb.L < 1e-9) return 0;
    const c = clamp(dot3(na, nb), -1, 1);
    return Math.atan2(len3(cross3(na, nb)), c);
  }

  function rotateAroundAxis(vec, axis, angle) {
    const k = norm3(axis);
    if (k.L < 1e-9) return { ...vec };
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return add3(
      add3(scale3(vec, cos), scale3(cross3(k, vec), sin)),
      scale3(k, dot3(k, vec) * (1 - cos))
    );
  }

  function outwardSign(a, b, centroid) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = Math.hypot(dx, dy);
    if (L < 1e-9) return 1;

    const nx = -dy / L;
    const ny = dx / L;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const off = 10;

    const pPlus = { x: mx + nx * off, y: my + ny * off };
    const pMinus = { x: mx - nx * off, y: my - ny * off };

    return Math.hypot(pPlus.x - centroid.x, pPlus.y - centroid.y) >=
      Math.hypot(pMinus.x - centroid.x, pMinus.y - centroid.y)
      ? 1
      : -1;
  }

  function getModelPivot(points) {
    if (!points?.length) return { x: 0, y: 0, z: 0 };

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      minZ = Math.min(minZ, p.z);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
      maxZ = Math.max(maxZ, p.z);
    }

    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      z: (minZ + maxZ) / 2
    };
  }

  window.AppUtils = {
    $,
    $$,
    byId,
    on,
    show,
    readNumber,
    clamp,
    degToRad,
    radToDeg,
    fmt,
    fmtMm,
    fmtDeg,
    v3,
    add3,
    sub3,
    scale3,
    dot3,
    cross3,
    len3,
    dist3,
    norm3,
    angleBetween3,
    rotateAroundAxis,
    outwardSign,
    getModelPivot,
    readExpressionNumber
  };
})();