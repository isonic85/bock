(() => {
  const {
    $,
    $$,
    byId,
    on,
    show,
    readNumber,
    clamp,
    degToRad,
    radToDeg,
    fmtMm,
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
    getModelPivot
  } = window.AppUtils;

  const dom = {

    offsetDetails: byId("offsetDetails"),
    radiusDetails: byId("radiusDetails"),
    manualStepsDetails: byId("manualStepsDetails"),
    stepsListDetails: byId("stepsListDetails"),

    newDrawingBtn: byId("newDrawingBtn"),
    saveDrawingBtn: byId("saveDrawingBtn"),
    archiveBtn: byId("archiveBtn"),
    saveStatusChip: byId("saveStatusChip"),

    saveModal: byId("saveModal"),
    saveNameInput: byId("saveNameInput"),
    saveConfirmBtn: byId("saveConfirmBtn"),
    saveCancelBtn: byId("saveCancelBtn"),

    archiveModal: byId("archiveModal"),
    archiveList: byId("archiveList"),
    archiveCount: byId("archiveCount"),
    archiveCloseBtn: byId("archiveCloseBtn"),

    confirmModal: byId("confirmModal"),
    confirmModalText: byId("confirmModalText"),
    confirmOkBtn: byId("confirmOkBtn"),
    confirmCancelBtn: byId("confirmCancelBtn"),

    offsetCcMmInput: byId("offsetCcMm"),
    layoutRoot: byId("layoutRoot"),
    illustrationPanel: byId("illustrationPanel"),
    kickSvg: byId("kickSvg"),
    leftAxis: byId("leftAxis"),
    modeHeightAngle: byId("mode-heightAngle"),
    modeHowto: byId("mode-howto"),
    modeIso3d: byId("mode-iso3d"),
    modeButtons: $$(".tab-btn"),

    height2Input: byId("height2"),
    angle2Input: byId("angle2"),
    calcHeightAngleBtn: byId("calcHeightAngle"),
    errorHeightAngle: byId("errorHeightAngle"),
    lenOut2: byId("lenOut2"),
    fxOut2: byId("fxOut2"),

    baseLeg: byId("baseLeg"),
    riseLeg: byId("riseLeg"),
    hypLeg: byId("hypLeg"),
    endPoint: byId("endPoint"),
    projLine: byId("projLine"),
    zeroPoint: byId("zeroPoint"),
    labelZero: byId("labelZero"),
    labelFx: byId("labelFx"),
    labelHeight: byId("labelHeight"),
    labelHyp: byId("labelHyp"),
    labelAngle: byId("labelAngle"),

    stepMmInput: byId("stepMm"),
    stepButtons: $$(".iso-btn"),
    undoStepBtn: byId("undoStepBtn"),
    clearStepsBtn: byId("clearStepsBtn"),
    stepsListEl: byId("stepsList"),
    stepCountChip: byId("stepCountChip"),
    points3dInput: byId("points3d"),
    errorIso: byId("errorIso"),
isoLenOut: byId("isoLen"),

    isoCanvas: byId("isoCanvas"),
    resetViewBtn: byId("resetViewBtn"),
    exportPdfBtn: byId("exportPdfBtn"),

    offsetEnabled: byId("offsetEnabled"),
    offsetPanel: byId("offsetPanel"),
    offsetAngleInput: byId("offsetAngle"),
    offsetMmInput: byId("offsetMm"),
    errorOffset: byId("errorOffset"),

    dimsEnabled: byId("dimsEnabled"),

    radiusEnabled: byId("radiusEnabled"),
    radiusPanel: byId("radiusPanel"),
    bendRadiusMmInput: byId("bendRadiusMm"),
    errorRadius: byId("errorRadius"),

    zeroBendEnabled: byId("zeroBendEnabled"),
    zeroBendPanel: byId("zeroBendPanel"),
    zeroBendChip: byId("zeroBendChip"),
    zeroBendBody: byId("zeroBendBody"),
    zeroBendEmpty: byId("zeroBendEmpty"),
    zeroBendTableWrap: byId("zeroBendTableWrap"),
    zeroBendError: byId("zeroBendError"),
    zeroBendWarn: byId("zeroBendWarn")
  };

  const ctxIso = dom.isoCanvas?.getContext("2d");

  const dirMap = {
    E: { dx: 1, dy: 0, dz: 0 },
    W: { dx: -1, dy: 0, dz: 0 },
    N: { dx: 0, dy: 1, dz: 0 },
    S: { dx: 0, dy: -1, dz: 0 },
    UP: { dx: 0, dy: 0, dz: 1 },
    DOWN: { dx: 0, dy: 0, dz: -1 }
  };

const DEFAULT_VIEW = Object.freeze({
  pitch: 0.6154797086703873,
  yaw: -0.7853981633974483
});

  const state = {
        drawingId: null,
    drawingName: "",
    isDirty: false,
    isoSteps: [],
    showDims: !!dom.dimsEnabled?.checked,
    showRadius: !!dom.radiusEnabled?.checked,
    showZeroBend: !!dom.zeroBendEnabled?.checked,
    radiusMm: readNumber(dom.bendRadiusMmInput),
    view: {
      baseScale: 1,
      baseCx: 0,
      baseCy: 0,
      zoom: 1,
      panX: 0,
      panY: 0,
      pitch: DEFAULT_VIEW.pitch,
      yaw: DEFAULT_VIEW.yaw,
      pivot: { x: 0, y: 0, z: 0 }
    },
    pointers: new Map(),
    dragStart: null,
    pinchStart: null
  };

  ["gesturestart", "gesturechange", "gestureend"].forEach((ev) =>
    on(dom.isoCanvas, ev, (e) => e.preventDefault(), { passive: false })
  );

  let lastCanvasTouchEnd = 0;
  on(dom.isoCanvas, "touchend", (e) => {
    const now = Date.now();
    if (now - lastCanvasTouchEnd <= 300) e.preventDefault();
    lastCanvasTouchEnd = now;
  }, { passive: false });

  function showMode(mode) {
    show(dom.modeHeightAngle, mode === "heightAngle");
    show(dom.modeHowto, mode === "howto");
    show(dom.modeIso3d, mode === "iso3d");

    const isoActive = mode === "iso3d";
    show(dom.illustrationPanel, !isoActive);
    dom.layoutRoot.classList.toggle("iso-only", isoActive);

    if (mode === "heightAngle") calculateHeightAngle();
    if (mode === "iso3d") {
      syncStepsFromTextarea();
      fitView(false);
      drawIso();
      syncIsoMobileSections();
    }
  }

  function openConfirmModal(message) {
    return new Promise((resolve) => {
      if (!dom.confirmModal || !dom.confirmOkBtn || !dom.confirmCancelBtn || !dom.confirmModalText) {
        resolve(window.confirm(message));
        return;
      }

      dom.confirmModalText.textContent = message;
      dom.confirmModal.classList.remove("hidden");
      dom.confirmModal.setAttribute("aria-hidden", "false");

      const previousActive = document.activeElement;

      const cleanup = () => {
        dom.confirmModal.classList.add("hidden");
        dom.confirmModal.setAttribute("aria-hidden", "true");

        dom.confirmOkBtn.removeEventListener("click", handleOk);
        dom.confirmCancelBtn.removeEventListener("click", handleCancel);
        dom.confirmModal.removeEventListener("click", handleBackdrop);
        document.removeEventListener("keydown", handleKey);

        if (previousActive && typeof previousActive.focus === "function") {
          previousActive.focus();
        }
      };

      const handleOk = () => {
        cleanup();
        resolve(true);
      };

      const handleCancel = () => {
        cleanup();
        resolve(false);
      };

      const handleBackdrop = (e) => {
        if (e.target === dom.confirmModal) {
          cleanup();
          resolve(false);
        }
      };

      const handleKey = (e) => {
        if (e.key === "Escape") {
          cleanup();
          resolve(false);
        }
      };

      dom.confirmOkBtn.addEventListener("click", handleOk, { once: true });
      dom.confirmCancelBtn.addEventListener("click", handleCancel, { once: true });
      dom.confirmModal.addEventListener("click", handleBackdrop);
      document.addEventListener("keydown", handleKey);

      dom.confirmCancelBtn.focus();
    });
  }

  function initTabs() {
    dom.modeButtons.forEach((btn) => on(btn, "click", () => {
      dom.modeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      showMode(btn.dataset.mode);
    }));
  }

  function updateDiagram(x, y, length, angleDeg) {
    const size = 220;
    const padding = 24;

    const width = size - padding * 2;
    const height = size - padding * 2;

    const safeX = Math.max(x, 1e-6);
    const safeY = Math.max(y, 1e-6);
    const reservedRightPx = 30;

    const scale = Math.min((width - reservedRightPx) / safeX, height / safeY);

    const originX = padding;
    const originY = size - padding;

    const xFoot = originX + safeX * scale;
    const yFoot = originY;

    const xTop = xFoot;
    const yTop = originY - safeY * scale;

    const baseEndX = Math.min(xFoot + reservedRightPx, size - padding);

    dom.baseLeg.setAttribute("x1", originX);
    dom.baseLeg.setAttribute("y1", originY);
    dom.baseLeg.setAttribute("x2", baseEndX);
    dom.baseLeg.setAttribute("y2", originY);

    dom.riseLeg.setAttribute("x1", originX);
    dom.riseLeg.setAttribute("y1", originY);
    dom.riseLeg.setAttribute("x2", originX);
    dom.riseLeg.setAttribute("y2", yTop);

    dom.hypLeg.setAttribute("x1", originX);
    dom.hypLeg.setAttribute("y1", originY);
    dom.hypLeg.setAttribute("x2", xTop);
    dom.hypLeg.setAttribute("y2", yTop);

    dom.endPoint.setAttribute("cx", xTop);
    dom.endPoint.setAttribute("cy", yTop);

    dom.projLine.setAttribute("x1", xTop);
    dom.projLine.setAttribute("y1", originY);
    dom.projLine.setAttribute("x2", xTop);
    dom.projLine.setAttribute("y2", yTop);

    dom.leftAxis.setAttribute("x1", originX);
    dom.leftAxis.setAttribute("y1", originY);
    dom.leftAxis.setAttribute("x2", originX);
    dom.leftAxis.setAttribute("y2", yTop);

    dom.zeroPoint.setAttribute("cx", xFoot);
    dom.zeroPoint.setAttribute("cy", yFoot);

    dom.labelZero.setAttribute("x", xFoot + 4);
    dom.labelZero.setAttribute("y", originY - 5);
    dom.labelZero.textContent = "0";

    dom.labelFx.setAttribute("x", (originX + xFoot) / 2);
    dom.labelFx.setAttribute("y", originY + 12);
    dom.labelFx.textContent = `fx ≈ ${x.toFixed(1)} mm`;

    dom.labelHeight.setAttribute("x", originX - 4);
    dom.labelHeight.setAttribute("y", (originY + yTop) / 2);
    dom.labelHeight.textContent = `h ≈ ${y.toFixed(1)} mm`;

    dom.labelHyp.setAttribute("x", (originX + xTop) / 2);
    dom.labelHyp.setAttribute("y", (originY + yTop) / 2 - 4);
    dom.labelHyp.textContent = length ? `L ≈ ${length.toFixed(1)} mm` : "L";

    dom.labelAngle.setAttribute("x", originX + 20);
    dom.labelAngle.setAttribute("y", originY - 8);
    dom.labelAngle.textContent = Number.isFinite(angleDeg) ? `v ≈ ${angleDeg.toFixed(1)}°` : "v";

    const bounds = {
      minX: Math.min(originX - 18, xTop - 10),
      maxX: Math.max(baseEndX + 8, xTop + 30, xFoot + 18),
      minY: Math.min(yTop - 18, originY - 22),
      maxY: Math.max(originY + 18, originY + 20)
    };

    const vbPadX = 16;
    const vbPadY = 16;

    const vbX = bounds.minX - vbPadX;
    const vbY = bounds.minY - vbPadY;
    const vbW = (bounds.maxX - bounds.minX) + vbPadX * 2;
    const vbH = (bounds.maxY - bounds.minY) + vbPadY * 2;

    dom.kickSvg.setAttribute(
      "viewBox",
      `${vbX.toFixed(1)} ${vbY.toFixed(1)} ${vbW.toFixed(1)} ${vbH.toFixed(1)}`
    );
  }

  function calculateHeightAngle() {
    const height = readNumber(dom.height2Input);
    const angleDeg = readNumber(dom.angle2Input);

    if (!Number.isFinite(height) || !Number.isFinite(angleDeg) || height <= 0 || angleDeg <= 0 || angleDeg >= 90) {
      show(dom.errorHeightAngle, true);
      dom.lenOut2.textContent = "–";
      dom.fxOut2.textContent = "–";
      updateDiagram(1, 1, Math.SQRT2, 45);
      return;
    }

    show(dom.errorHeightAngle, false);
    const angleRad = degToRad(angleDeg);
    const length = height / Math.sin(angleRad);
    const fx = length * Math.cos(angleRad);

    dom.lenOut2.textContent = fmtMm(length, 3);
    dom.fxOut2.textContent = fmtMm(fx, 3);
    updateDiagram(fx, height, length, angleDeg);
  }

  function initHeightAngle() {
    on(dom.calcHeightAngleBtn, "click", (e) => {
      e.preventDefault();
      calculateHeightAngle();
    });
    on(dom.height2Input, "input", calculateHeightAngle);
    on(dom.angle2Input, "input", calculateHeightAngle);
  }

 function buildOffsetStep(baseDir, offsetDir, angleDeg, offsetMm) {
  const absAngle = Math.abs(angleDeg);
  if (!(absAngle > 0 && absAngle < 90)) return null;

  const forward = dirMap[baseDir];
  const side = dirMap[offsetDir];

  if (!forward || !side) return null;

  // Offset får inte ligga i samma eller motsatt riktning som framåtriktningen
  const parallel =
    forward.dx * side.dx +
    forward.dy * side.dy +
    forward.dz * side.dz;

  if (Math.abs(parallel) > 1e-9) return null;

  const angleRad = degToRad(absAngle);
  const sinA = Math.sin(angleRad);
  const tanA = Math.tan(angleRad);

  if (Math.abs(sinA) < 1e-9 || Math.abs(tanA) < 1e-9) return null;

  const mm = offsetMm / sinA;
  const P = offsetMm / tanA;

  const proj = {
    dx: forward.dx * P,
    dy: forward.dy * P,
    dz: forward.dz * P
  };

  const offv = {
    dx: side.dx * offsetMm,
    dy: side.dy * offsetMm,
    dz: side.dz * offsetMm
  };

  return {
    type: "OFF",
    dir: offsetDir,     // knappen användaren tryckte på
    baseDir,            // riktningen röret gick innan offseten
    ang: absAngle,
    off: offsetMm,
    mm,
    P,
    proj,
    offv,
    dx: proj.dx + offv.dx,
    dy: proj.dy + offv.dy,
    dz: proj.dz + offv.dz
  };
}

 function parseSteps(text) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const steps = [];

  function getLastCardinalDirFromSteps(localSteps) {
    for (let i = localSteps.length - 1; i >= 0; i--) {
      const step = localSteps[i];
      if (step?.type === "CARD" && dirMap[step.dir]) {
        return step.dir;
      }
    }
    return null;
  }

  for (const line of lines) {
    const cleaned = line.replace(/\s+/g, " ").toUpperCase();

    let m = cleaned.match(/^O\s+([A-Z]+)\s+([+-]?\d+(?:[.,]\d+)?)\s+([+-]?\d+(?:[.,]\d+)?)$/);
    if (m) {
      const offsetDir = m[1];
      const angle = parseFloat(m[2].replace(",", "."));
      const offset = parseFloat(m[3].replace(",", "."));

      if (!dirMap[offsetDir] || !Number.isFinite(angle) || !Number.isFinite(offset) || offset <= 0) {
        return null;
      }

      if (!(Math.abs(angle) > 0 && Math.abs(angle) < 90)) {
        return null;
      }

      const baseDir = getLastCardinalDirFromSteps(steps);
      if (!baseDir) return null;

      const step = buildOffsetStep(baseDir, offsetDir, angle, offset);
      if (!step) return null;

      steps.push(step);
      continue;
    }

    m = cleaned.match(/^([A-Z]+)\s*([+-]?\d+(?:[.,]\d+)?)$/);
    if (!m) return null;

    const dir = m[1];
    const mm = parseFloat(m[2].replace(",", "."));

    if (!dirMap[dir] || !Number.isFinite(mm) || mm <= 0) return null;

    steps.push({ type: "CARD", dir, mm });
  }

  return steps;
}

  function stepsToPoints(steps) {
    let x = 0;
    let y = 0;
    let z = 0;
    const points = [{ x, y, z }];

    for (const step of steps) {
      if (step.type === "CARD") {
        const v = dirMap[step.dir];
        x += v.dx * step.mm;
        y += v.dy * step.mm;
        z += v.dz * step.mm;
      } else {
        x += step.dx;
        y += step.dy;
        z += step.dz;
      }
      points.push({ x, y, z });
    }

    return points;
  }

  function syncTextareaFromSteps() {
    dom.points3dInput.value = state.isoSteps.map((step) =>
      step.type === "CARD"
        ? `${step.dir} ${step.mm}`
        : `O ${step.dir} ${step.ang} ${step.off}`
    ).join("\n");
  }

  function syncStepsFromTextarea() {
    const parsed = parseSteps(dom.points3dInput.value);
    if (!parsed) return false;
    state.isoSteps = parsed;
    renderStepsList();
    return true;
  }

  function renderStepsList() {
    dom.stepsListEl.innerHTML = "";
    dom.stepCountChip.textContent = `${state.isoSteps.length} steg`;

    state.isoSteps.forEach((step, index) => {
      const li = document.createElement("li");
     li.textContent = step.type === "CARD"
  ? `${index + 1}. ${step.dir} ${step.mm} mm`
  : `${index + 1}. OFFSET ${step.dir} från ${step.baseDir} v:${step.ang}° off:${step.off}mm → L:${step.mm.toFixed(1)}mm${step.ccWanted ? ` • CC:${step.ccWanted}mm` : ""}${step.ccAfterWanted ? ` • CC efter:${step.ccAfterWanted}mm` : ""}${step.ccAfterBase ? ` • ref:${step.ccAfterBase}mm` : ""}`;
      dom.stepsListEl.appendChild(li);
    });
        syncIsoMobileSections();
  }

  function validateOffsetInputs() {
    const ang = readNumber(dom.offsetAngleInput);
    const off = readNumber(dom.offsetMmInput);
    return Number.isFinite(ang) && Number.isFinite(off) && off > 0 && Math.abs(ang) > 0 && Math.abs(ang) < 90
      ? { ang, off }
      : null;
  }

  function validateRadiusInput() {
    if (!dom.radiusEnabled.checked) return { enabled: false, radius: 0 };
    const radius = readNumber(dom.bendRadiusMmInput);
    return Number.isFinite(radius) && radius > 0 ? { enabled: true, radius } : null;
  }

  function rotateOrbit(point, view, pivot = view.pivot || { x: 0, y: 0, z: 0 }) {
    let x = point.x - pivot.x;
    let y = point.y - pivot.y;
    let z = point.z - pivot.z;

    const cosYaw = Math.cos(view.yaw);
    const sinYaw = Math.sin(view.yaw);

    const x1 = x * cosYaw - y * sinYaw;
    const y1 = x * sinYaw + y * cosYaw;
    const z1 = z;

    const cosPitch = Math.cos(view.pitch);
    const sinPitch = Math.sin(view.pitch);

    const x2 = x1;
    const y2 = y1 * cosPitch - z1 * sinPitch;
    const z2 = y1 * sinPitch + z1 * cosPitch;

    return { x: x2, y: y2, z: z2 };
  }

  const projectIsoRaw = (point) => ({
    x: point.x,
    y: -point.z
  });

  const projectIso = (point3d) => projectIsoRaw(rotateOrbit(point3d, state.view));

  function ensureCanvasDpr() {
    if (!dom.isoCanvas || !ctxIso) return { w: 0, h: 0, dpr: 1 };

    const rect = dom.isoCanvas.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(rect.width));
    const cssH = Math.max(1, Math.round(rect.height));
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const targetW = Math.round(cssW * dpr);
    const targetH = Math.round(cssH * dpr);

    if (dom.isoCanvas.width !== targetW || dom.isoCanvas.height !== targetH) {
      dom.isoCanvas.width = targetW;
      dom.isoCanvas.height = targetH;
    }

    ctxIso.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: cssW, h: cssH, dpr };
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      return;
    }

    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawCanvasDimCAD(ctx, a, b, text, outward, opts = {}) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segL = Math.hypot(dx, dy);
    if (segL < 1e-6) return;

    const ux = dx / segL;
    const uy = dy / segL;
    const nx = -uy;
    const ny = ux;
    const off = opts.offPx ?? 10;
    const ex = nx * off * outward;
    const ey = ny * off * outward;
    const need = Math.max(0, (opts.minLenPx ?? 26) - segL);

    const aDim = { x: a.x + ex - ux * (need / 2), y: a.y + ey - uy * (need / 2) };
    const bDim = { x: b.x + ex + ux * (need / 2), y: b.y + ey + uy * (need / 2) };
    const ang = Math.atan2(bDim.y - aDim.y, bDim.x - aDim.x);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.font = opts.font ?? "12px system-ui";

    const tw = ctx.measureText(text).width;
    const gap = tw / 2 + (opts.gapPad ?? 5);
    const mx = (aDim.x + bDim.x) / 2;
    const my = (aDim.y + bDim.y) / 2;

    const gx1 = { x: mx - Math.cos(ang) * gap, y: my - Math.sin(ang) * gap };
    const gx2 = { x: mx + Math.cos(ang) * gap, y: my + Math.sin(ang) * gap };

    ctx.strokeStyle = opts.extColor ?? "rgba(248,250,252,.65)";
    ctx.lineWidth = opts.extW ?? 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(aDim.x, aDim.y);
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(bDim.x, bDim.y);
    ctx.stroke();

    ctx.strokeStyle = opts.color ?? "#e5e7eb";
    ctx.lineWidth = opts.lineW ?? 1.4;
    ctx.beginPath();
    ctx.moveTo(aDim.x, aDim.y);
    ctx.lineTo(gx1.x, gx1.y);
    ctx.moveTo(gx2.x, gx2.y);
    ctx.lineTo(bDim.x, bDim.y);
    ctx.stroke();

    const r = opts.dotR ?? 2.2;
    ctx.fillStyle = opts.dotFill ?? "#e5e7eb";
    ctx.beginPath();
    ctx.arc(aDim.x, aDim.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bDim.x, bDim.y, r, 0, Math.PI * 2);
    ctx.fill();

    let rot = ang;
    if (rot > Math.PI / 2 || rot < -Math.PI / 2) rot += Math.PI;

    ctx.translate(mx, my);
    ctx.rotate(rot);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = opts.textColor ?? "#e5e7eb";
    ctx.fillText(text, 0, opts.textNudge ?? 0);
    ctx.restore();
  }

  function drawMiniAxes() {
    if (!ctxIso) return;

    const { w, h } = ensureCanvasDpr();
    const s = Math.min(1, Math.max(0.72, Math.min(w / 420, h / 280)));
    const x = 10;
    const y = 10;
    const boxW = 92 * s;
    const boxH = 66 * s;
    const pad = 10 * s;
    const axisLen = 80;

    const O = projectIso({ x: 0, y: 0, z: 0 });
    const E = projectIso({ x: axisLen, y: 0, z: 0 });
    const N = projectIso({ x: 0, y: axisLen, z: 0 });
    const U = projectIso({ x: 0, y: 0, z: axisLen });
    const points = [O, E, N, U];

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }

    const spanX = Math.max(maxX - minX, 1e-6);
    const spanY = Math.max(maxY - minY, 1e-6);
    const k = Math.min((boxW - 2 * pad) / spanX, (boxH - 2 * pad) / spanY);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const cx = x + boxW / 2;
    const cy = y + boxH / 2;
    const toHud = (p) => ({ x: cx + (p.x - midX) * k, y: cy + (p.y - midY) * k });

    const cO = toHud(O);
    const cE = toHud(E);
    const cN = toHud(N);
    const cU = toHud(U);

    ctxIso.save();
    ctxIso.fillStyle = "rgba(2,6,23,.88)";
    ctxIso.strokeStyle = "rgba(148,163,184,.18)";
    ctxIso.lineWidth = 1;
    roundRectPath(ctxIso, x, y, boxW, boxH, 10 * s);
    ctxIso.fill();
    ctxIso.stroke();

    ctxIso.lineCap = "round";
    ctxIso.lineJoin = "round";
    ctxIso.lineWidth = 2.2 * s;

    [["#38bdf8", cE], ["#22c55e", cN], ["#f97316", cU]].forEach(([color, p]) => {
      ctxIso.strokeStyle = color;
      ctxIso.beginPath();
      ctxIso.moveTo(cO.x, cO.y);
      ctxIso.lineTo(p.x, p.y);
      ctxIso.stroke();
    });

    ctxIso.font = `${10 * s}px system-ui`;
    ctxIso.textBaseline = "middle";
    ctxIso.textAlign = "left";

    function label(text, tx, ty) {
      const padX = 4 * s;
      const tw = ctxIso.measureText(text).width;
      const bw = tw + padX * 2;
      const bh = 14 * s;
      ctxIso.fillStyle = "rgba(2,6,23,.90)";
      ctxIso.strokeStyle = "rgba(148,163,184,.16)";
      ctxIso.lineWidth = 1;
      roundRectPath(ctxIso, tx - padX, ty - bh / 2, bw, bh, 6 * s);
      ctxIso.fill();
      ctxIso.stroke();
      ctxIso.fillStyle = "#e5e7eb";
      ctxIso.fillText(text, tx, ty);
    }

    label("UP", cU.x + 6 * s, cU.y);
    label("E", cE.x + 6 * s, cE.y);
    label("N", cN.x - 16 * s, cN.y);
    ctxIso.restore();
  }

  function boxesOverlap(a, b, pad = 6) {
  return !(
    a.x + a.w + pad < b.x ||
    b.x + b.w + pad < a.x ||
    a.y + a.h + pad < b.y ||
    b.y + b.h + pad < a.y
  );
}

function collidesAny(box, placed, pad = 6) {
  return placed.some((other) => boxesOverlap(box, other, pad));
}

function makeBoxFromCenter(cx, cy, w, h) {
  return {
    x: cx - w / 2,
    y: cy - h / 2,
    w,
    h
  };
}

function measureCanvasDimLayout(ctx, a, b, text, outward, opts = {}) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const segL = Math.hypot(dx, dy);
  if (segL < 1e-6) return null;

  const ux = dx / segL;
  const uy = dy / segL;
  const nx = -uy;
  const ny = ux;

  const off = opts.offPx ?? 10;
  const ex = nx * off * outward;
  const ey = ny * off * outward;
  const need = Math.max(0, (opts.minLenPx ?? 26) - segL);

  const aDim = {
    x: a.x + ex - ux * (need / 2),
    y: a.y + ey - uy * (need / 2)
  };
  const bDim = {
    x: b.x + ex + ux * (need / 2),
    y: b.y + ey + uy * (need / 2)
  };

  const mx = (aDim.x + bDim.x) / 2;
  const my = (aDim.y + bDim.y) / 2;

  ctx.save();
  ctx.font = opts.font ?? "12px system-ui";
  const tw = ctx.measureText(text).width;
  ctx.restore();

  const th = opts.textH ?? 14;

  return {
    center: { x: mx, y: my },
    textBox: makeBoxFromCenter(mx, my, tw + 8, th + 6)
  };
}

function placeCanvasDimCAD(ctx, a, b, text, outward, placed, opts = {}) {
  const baseOff = opts.offPx ?? 10;
  const attempts = [1, 1.35, 1.75, 2.2, 2.8];
  const sides = [outward, -outward];

  for (const side of sides) {
    for (const mul of attempts) {
      const testOpts = { ...opts, offPx: baseOff * mul };
      const layout = measureCanvasDimLayout(ctx, a, b, text, side, testOpts);
      if (!layout) continue;

      if (!collidesAny(layout.textBox, placed, 6)) {
        drawCanvasDimCAD(ctx, a, b, text, side, testOpts);
        placed.push(layout.textBox);
        return true;
      }
    }
  }

  const fallback = measureCanvasDimLayout(ctx, a, b, text, outward, opts);
  drawCanvasDimCAD(ctx, a, b, text, outward, opts);
  if (fallback) placed.push(fallback.textBox);
  return false;
}

function drawEmptyIsoGrid(ctx, toCanvas, extent = 2000, step = 50) {
  if (!ctx) return;

  const majorEvery = 5;
  const x0 = -extent;
  const x1 = extent;
  const y0 = -extent;
  const y1 = extent;

  const drawLine = (a3, b3, isMajor, alphaMinor, alphaMajor) => {
    const a = toCanvas(projectIso(a3));
    const b = toCanvas(projectIso(b3));

    ctx.strokeStyle = `rgba(147,197,253,${isMajor ? alphaMajor : alphaMinor})`;
    ctx.lineWidth = isMajor ? 1.4 : 1.0;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };

  // X-linjer
  for (let i = Math.floor(x0 / step); i <= Math.ceil(x1 / step); i++) {
    const x = i * step;
    const isMajor = i % majorEvery === 0;
    drawLine(
      { x, y: y0, z: 0 },
      { x, y: y1, z: 0 },
      isMajor,
      0.08,
      0.16
    );
  }

  // Y-linjer
  for (let i = Math.floor(y0 / step); i <= Math.ceil(y1 / step); i++) {
    const y = i * step;
    const isMajor = i % majorEvery === 0;
    drawLine(
      { x: x0, y, z: 0 },
      { x: x1, y, z: 0 },
      isMajor,
      0.08,
      0.16
    );
  }

  // Diagonala ISO-linjer (x + y = konstant)
  const c0 = x0 + y0;
  const c1 = x1 + y1;

  for (let i = Math.floor(c0 / step); i <= Math.ceil(c1 / step); i++) {
    const c = i * step;
    const isMajor = i % majorEvery === 0;

    let xa = x0;
    let ya = c - xa;
    let xb = x1;
    let yb = c - xb;

    if (ya < y0) { ya = y0; xa = c - ya; }
    if (ya > y1) { ya = y1; xa = c - ya; }
    if (yb < y0) { yb = y0; xb = c - yb; }
    if (yb > y1) { yb = y1; xb = c - yb; }

    if (xa < x0 - 1e-6 || xa > x1 + 1e-6 || xb < x0 - 1e-6 || xb > x1 + 1e-6) {
      continue;
    }

    drawLine(
      { x: xa, y: ya, z: 0 },
      { x: xb, y: yb, z: 0 },
      isMajor,
      0.06,
      0.14
    );
  }
}

  function drawIsoGrid(ctx, pts3d, toCanvas, w, h) {
    if (!ctx || !pts3d?.length) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts3d) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }

    const k = state.view.baseScale * state.view.zoom;
    const spanProjX = w / Math.max(k, 1e-6);
    const spanProjY = h / Math.max(k, 1e-6);
    const extra = Math.max(spanProjX, spanProjY) * 1.4;

    const x0 = minX - extra;
    const x1 = maxX + extra;
    const y0 = minY - extra;
    const y1 = maxY + extra;
    const minor = 50;
    const majorEvery = 5;

    const drawFamily = (drawLineFn, spacing, alphaMinor, alphaMajor) => {
      for (let pass = 0; pass < 2; pass++) {
        const isMajor = pass === 1;
        ctx.strokeStyle = `rgba(147,197,253,${isMajor ? alphaMajor : alphaMinor})`;
        ctx.lineWidth = isMajor ? 1.4 : 1.0;
        drawLineFn(isMajor, spacing);
      }
    };

    drawFamily((isMajor, step) => {
      for (let i = Math.floor(x0 / step); i <= Math.ceil(x1 / step); i++) {
        if (isMajor ? i % majorEvery !== 0 : i % majorEvery === 0) continue;
        const x = i * step;
        const a = toCanvas(projectIso({ x, y: y0, z: 0 }));
        const b = toCanvas(projectIso({ x, y: y1, z: 0 }));
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }, minor, 0.08, 0.16);

    drawFamily((isMajor, step) => {
      for (let i = Math.floor(y0 / step); i <= Math.ceil(y1 / step); i++) {
        if (isMajor ? i % majorEvery !== 0 : i % majorEvery === 0) continue;
        const y = i * step;
        const a = toCanvas(projectIso({ x: x0, y, z: 0 }));
        const b = toCanvas(projectIso({ x: x1, y, z: 0 }));
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }, minor, 0.08, 0.16);

    drawFamily((isMajor, step) => {
      const cMin = x0 + y0;
      const cMax = x1 + y1;
      for (let i = Math.floor(cMin / step); i <= Math.ceil(cMax / step); i++) {
        if (isMajor ? i % majorEvery !== 0 : i % majorEvery === 0) continue;
        const c = i * step;
        let xa = x0;
        let ya = c - xa;
        let xb = x1;
        let yb = c - xb;

        if (ya < y0) { ya = y0; xa = c - ya; }
        if (ya > y1) { ya = y1; xa = c - ya; }
        if (yb < y0) { yb = y0; xb = c - yb; }
        if (yb > y1) { yb = y1; xb = c - yb; }

        if (xa < x0 - 1e-6 || xa > x1 + 1e-6 || xb < x0 - 1e-6 || xb > x1 + 1e-6) continue;

        const a = toCanvas(projectIso({ x: xa, y: ya, z: 0 }));
        const b = toCanvas(projectIso({ x: xb, y: yb, z: 0 }));
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }, minor, 0.06, 0.14);
  }

  function getRadiusSettings() {
    state.showRadius = !!dom.radiusEnabled.checked;
    state.radiusMm = readNumber(dom.bendRadiusMmInput);
    return validateRadiusInput();
  }

  function buildRoundedGeometry(points3d) {
    const radiusConfig = getRadiusSettings();
    const radiusEnabled = !!radiusConfig?.enabled;
    const requestedRadius = radiusConfig?.radius || 0;

    const bends = new Array(points3d.length).fill(null);
    const scaleByVertex = new Array(points3d.length).fill(1);

    if (radiusEnabled && points3d.length >= 3) {
      for (let i = 1; i < points3d.length - 1; i++) {
        const A = points3d[i - 1];
        const B = points3d[i];
        const C = points3d[i + 1];
        const inU = norm3(sub3(B, A));
        const outU = norm3(sub3(C, B));
        if (inU.L < 1e-9 || outU.L < 1e-9) continue;

        const theta = angleBetween3(inU, outU);
        if (theta < 1e-4 || Math.abs(Math.PI - theta) < 1e-4) continue;

        const tanHalf = Math.tan(theta / 2);
        if (Math.abs(tanHalf) < 1e-9) continue;

        bends[i] = { i, theta, tanHalf, inU, outU, desiredT: requestedRadius * tanHalf };
      }

      for (let segIndex = 0; segIndex < points3d.length - 1; segIndex++) {
        const segLen = dist3(points3d[segIndex], points3d[segIndex + 1]);
        const tA = bends[segIndex]?.desiredT || 0;
        const tB = bends[segIndex + 1]?.desiredT || 0;

        if (tA + tB > segLen - 1e-6 && tA + tB > 1e-9) {
          const scale = Math.max(0, (segLen - 1e-6) / (tA + tB));
          if (bends[segIndex]) scaleByVertex[segIndex] = Math.min(scaleByVertex[segIndex], scale);
          if (bends[segIndex + 1]) scaleByVertex[segIndex + 1] = Math.min(scaleByVertex[segIndex + 1], scale);
        }
      }

      for (let i = 1; i < points3d.length - 1; i++) {
        const bend = bends[i];
        if (!bend) continue;

        const t = bend.desiredT * scaleByVertex[i];
        if (!(t > 1e-6)) {
          bends[i] = null;
          continue;
        }

        const radius = t / bend.tanHalf;
        const B = points3d[i];
        const t1 = add3(B, scale3(bend.inU, -t));
        const t2 = add3(B, scale3(bend.outU, t));
        const planeN = norm3(cross3(bend.inU, bend.outU));
        if (planeN.L < 1e-9) {
          bends[i] = null;
          continue;
        }

        const n1 = norm3(cross3(planeN, bend.inU));
        const n2 = norm3(cross3(planeN, bend.outU));
        if (n1.L < 1e-9 || n2.L < 1e-9) {
          bends[i] = null;
          continue;
        }

        const center = scale3(
          add3(add3(t1, scale3(n1, radius)), add3(t2, scale3(n2, radius))),
          0.5
        );
        const r1 = sub3(t1, center);
        const r2 = sub3(t2, center);

        if (len3(r1) < 1e-6 || len3(r2) < 1e-6) {
          bends[i] = null;
          continue;
        }

        const arcAngle = angleBetween3(r1, r2);
        if (!Number.isFinite(arcAngle) || arcAngle <= 1e-6) {
          bends[i] = null;
          continue;
        }

        bends[i] = {
          i,
          radius,
          theta: bend.theta,
          arcAngle: bend.theta,
          arcLen: radius * bend.theta,
          t,
          t1,
          t2,
          center,
          axis: planeN,
          r1,
          r2,
          inU: bend.inU,
          outU: bend.outU
        };
      }
    }

    const segments = [];
    for (let i = 0; i < points3d.length - 1; i++) {
      const start = bends[i]?.t2 || points3d[i];
      const end = bends[i + 1]?.t1 || points3d[i + 1];
      segments.push({
        index: i,
        rawStart: points3d[i],
        rawEnd: points3d[i + 1],
        start,
        end,
        len: dist3(start, end)
      });
    }

    let totalLen = segments.reduce((sum, seg) => sum + seg.len, 0);
    let bendCount = 0;
    for (const bend of bends) {
      if (bend) {
        totalLen += bend.arcLen;
        bendCount++;
      }
    }

    return { points3d, bends, segments, totalLen, bendCount, radiusEnabled, requestedRadius };
  }

  function sampleBendArc3d(bend, sampleCount = null) {
    if (!bend) return [];
    const count = sampleCount ?? Math.max(24, Math.ceil(radToDeg(bend.arcAngle) / 2));
    const axis = bend.axis;
    const startVec = bend.r1;
    const testEnd = rotateAroundAxis(startVec, axis, bend.arcAngle);
    const testEndMinus = rotateAroundAxis(startVec, axis, -bend.arcAngle);
    const signedArc = dist3(add3(bend.center, testEnd), bend.t2) <= dist3(add3(bend.center, testEndMinus), bend.t2)
      ? bend.arcAngle
      : -bend.arcAngle;

    const out = [];
    for (let i = 0; i <= count; i++) {
      out.push(add3(bend.center, rotateAroundAxis(startVec, axis, signedArc * (i / count))));
    }
    return out;
  }

  function getDisplayCloudProjected(projectFn, geometry) {
    const cloud = [];
    for (const seg of geometry.segments) cloud.push(projectFn(seg.start), projectFn(seg.end));
    for (const bend of geometry.bends) {
      if (!bend) continue;
      for (const p of sampleBendArc3d(bend, 20)) cloud.push(projectFn(p));
    }
    if (!cloud.length) {
      for (const p of geometry.points3d) cloud.push(projectFn(p));
    }
    return cloud;
  }

  function fitView(keepUserZoom = false) {
    if (!state.isoSteps.length) return;

    const { w, h } = ensureCanvasDpr();
    const geometry = buildRoundedGeometry(stepsToPoints(state.isoSteps));
    state.view.pivot = getModelPivot(geometry.points3d);
    const projected = getDisplayCloudProjected(projectIso, geometry);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of projected) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }

    const spanX = Math.max(maxX - minX, 1e-6);
    const spanY = Math.max(maxY - minY, 1e-6);
    const pad = 36;
    const scale = Math.min((w - 2 * pad) / spanX, (h - 2 * pad) / spanY);

    state.view.baseScale = scale;
    state.view.baseCx = w / 2 - ((minX + maxX) / 2) * scale;
    state.view.baseCy = h / 2 - ((minY + maxY) / 2) * scale;

    if (!keepUserZoom) {
      state.view.zoom = 1;
      state.view.panX = 0;
      state.view.panY = 0;
    }
  }

function resetView() {
  state.view.pitch = DEFAULT_VIEW.pitch;
  state.view.yaw = DEFAULT_VIEW.yaw;

  if (!state.isoSteps.length) {
    state.view.zoom = 1;
    state.view.panX = 0;
    state.view.panY = 0;
    state.view.pivot = { x: 0, y: 0, z: 0 };
  }

  fitView(false);
  drawIso();
}

  function drawArcLabelOnCanvas(ctx, bend, toCanvas, centroidCanvas, dimSpread, placedLabels = []) {
    if (!bend) return;
    const arcPts = sampleBendArc3d(bend, 28);
    if (arcPts.length < 3) return;

    const mid3 = arcPts[Math.floor(arcPts.length / 2)];
    const prev3 = arcPts[Math.max(0, Math.floor(arcPts.length / 2) - 1)];
    const next3 = arcPts[Math.min(arcPts.length - 1, Math.floor(arcPts.length / 2) + 1)];

    const mid = toCanvas(projectIso(mid3));
    const prev = toCanvas(projectIso(prev3));
    const next = toCanvas(projectIso(next3));

    const tangX = next.x - prev.x;
    const tangY = next.y - prev.y;
    const tangLen = Math.hypot(tangX, tangY) || 1;

    let nx = -tangY / tangLen;
    let ny = tangX / tangLen;
    const sign = (nx * (centroidCanvas.x - mid.x) + ny * (centroidCanvas.y - mid.y)) > 0 ? -1 : 1;
    nx *= sign;
    ny *= sign;

  const text = `R ${bend.radius.toFixed(1)} • B ${bend.arcLen.toFixed(1)} mm`;

let labelX = null;
let labelY = null;
let found = false;

for (const mul of [1, 1.35, 1.75, 2.2, 2.8]) {
  const tx = mid.x + nx * 24 * dimSpread * mul;
  const ty = mid.y + ny * 24 * dimSpread * mul;

  if (placeArcLabelBox(ctx, text, tx, ty, placedLabels)) {
    labelX = tx;
    labelY = ty;
    found = true;
    break;
  }
}

if (!found) {
  labelX = mid.x + nx * 24 * dimSpread;
  labelY = mid.y + ny * 24 * dimSpread;
}
    ctx.save();
    ctx.font = "12px system-ui";

    const tw = ctx.measureText(text).width;
    const boxW = tw + 14;
    const boxH = 20;

    ctx.strokeStyle = "rgba(244,114,182,.75)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mid.x, mid.y);
    ctx.lineTo(labelX, labelY);
    ctx.stroke();

    ctx.fillStyle = "rgba(2,6,23,.92)";
    ctx.strokeStyle = "rgba(244,114,182,.65)";
    roundRectPath(ctx, labelX - boxW / 2, labelY - boxH / 2, boxW, boxH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, labelX, labelY + 0.5);
    ctx.restore();
  }
function shouldDrawOffsetBaseDim(step) {
  return !!step && step.type === "OFF";
}
function drawOffsetBaseTotalDim(ctx, points3d, stepIndex, toCanvas, centroidCanvas, dimSpread, placedLabels = []) {
  if (stepIndex < 0) return;

  const step = state.isoSteps[stepIndex];
  if (!shouldDrawOffsetBaseDim(step)) return;

  const cc = getOffsetCcEndpoints(points3d, stepIndex);
  if (!cc) return;

  const a = toCanvas(projectIso(cc.startPoint));
  const b = toCanvas(projectIso(cc.endPoint));

  if (Math.hypot(b.x - a.x, b.y - a.y) <= 2) return;

placeCanvasDimCAD(
  ctx,
  a,
  b,
  fmtMm(cc.totalLen, 1),
  outwardSign(a, b, centroidCanvas),
  placedLabels,
  {
    color: "#38bdf8",
    extColor: "rgba(56,189,248,.55)",
    textColor: "#38bdf8",
    offPx: 16 * dimSpread,
    minLenPx: 28,
    lineW: 1.35,
    extW: 1,
    dotR: 2.1,
    dotFill: "#38bdf8",
    gapPad: 5
  }
);
}

  function describeBendType(steps, vertexIndex) {
    const prev = steps[vertexIndex - 1];
    const curr = steps[vertexIndex];
    if (!prev || !curr) return `Böj ${vertexIndex}`;

    if (curr.type === "OFF" && prev.type !== "OFF") {
      return `Offset in (${curr.dir})`;
    }

    if (prev.type === "OFF" && curr.type !== "OFF") {
      return `Offset ut (${prev.dir})`;
    }

    if (prev.type === "CARD" && curr.type === "CARD") {
      return `${prev.dir} → ${curr.dir}`;
    }

    if (prev.type === "OFF" && curr.type === "OFF") {
      return `Offset ${prev.dir} → Offset ${curr.dir}`;
    }

    return `Böj ${vertexIndex}`;
  }

  function clearZeroBendList(message = "Aktivera 0-punkt för att visa bocklistan.", error = "", warn = "") {
    dom.zeroBendBody.innerHTML = "";
    dom.zeroBendChip.textContent = "0 bockar";
    dom.zeroBendEmpty.textContent = message;
    show(dom.zeroBendEmpty, true);
    show(dom.zeroBendTableWrap, false);

    dom.zeroBendError.textContent = error;
    dom.zeroBendError.style.display = error ? "block" : "none";

    dom.zeroBendWarn.textContent = warn;
    dom.zeroBendWarn.style.display = warn ? "block" : "none";
  }

  function computeZeroPointBendRows(geometry, steps) {
    const bendList = geometry.bends.filter(Boolean).sort((a, b) => a.i - b.i);
    if (!bendList.length) return { rows: [], error: "Inga böjar hittades för aktuell geometri." };

    const rows = [];
    let cumulative = 0;
    let prevBend = null;

    for (const bend of bendList) {
      let delta = NaN;
      let comment = "";

      if (!prevBend) {
        const firstSeg = geometry.segments[bend.i - 1];
        if (!firstSeg) {
          return { rows: [], error: "Kunde inte räkna första tangentstarten." };
        }
        delta = firstSeg.len;
        comment = "start till första tangent";
      } else {
        const bridgeSeg = geometry.segments[prevBend.i];
        if (!bridgeSeg) {
          return { rows: [], error: "Kunde inte räkna avståndet mellan två tangentstarter." };
        }
        delta = prevBend.arcLen + bridgeSeg.len;
        comment = "från föregående tangent";
      }

      cumulative += delta;

      rows.push({
        no: rows.length + 1,
        type: describeBendType(steps, bend.i),
        angleDeg: radToDeg(bend.theta),
        delta,
        cumulative,
        comment,
        bend
      });

      prevBend = bend;
    }

    let warn = "";
    const requested = geometry.requestedRadius || 0;
    if (requested > 0) {
      const reduced = bendList.filter((b) => Math.abs(b.radius - requested) > 0.05);
      if (reduced.length) {
        warn =
          "Vald radie fick inte plats fullt ut på alla sträckor. Appen har därför minskat faktisk radie på minst en böj för att geometrin ska gå ihop.";
      }
    }

    return { rows, warn };
  }

  function renderZeroBendList(geometry = null) {
    state.showZeroBend = !!dom.zeroBendEnabled.checked;
    show(dom.zeroBendPanel, state.showZeroBend);

    if (!state.showZeroBend) {
      clearZeroBendList("Aktivera 0-punkt för att visa bocklistan.");
      return;
    }

    if (!state.isoSteps.length) {
      clearZeroBendList("Lägg till steg för att få en bocklista.");
      return;
    }

    if (!dom.radiusEnabled.checked) {
      clearZeroBendList("Aktivera Radie för att få 0-punkt bockning.");
      return;
    }

    const radiusConfig = validateRadiusInput();
    if (!radiusConfig) {
      clearZeroBendList("Ange giltig radie för att få bocklista.", "Radien måste vara större än 0 mm.");
      return;
    }

    const localGeometry = geometry || buildRoundedGeometry(stepsToPoints(state.isoSteps));
    const { rows, error, warn } = computeZeroPointBendRows(localGeometry, state.isoSteps);

    if (error) {
      clearZeroBendList("Ingen bocklista kunde räknas fram.", error, warn || "");
      return;
    }

    if (!rows.length) {
      clearZeroBendList("Inga böjar att visa i bocklistan.", "", warn || "");
      return;
    }

    dom.zeroBendBody.innerHTML = "";
    dom.zeroBendChip.textContent = `${rows.length} bockar`;

    for (const row of rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="num">${row.no}</td>
        <td>${row.type}</td>
        <td class="num">${row.angleDeg.toFixed(1)}°</td>
        <td class="num">${row.delta.toFixed(1)} mm</td>
        <td class="num">${row.cumulative.toFixed(1)} mm</td>
      `;
      dom.zeroBendBody.appendChild(tr);
    }

    show(dom.zeroBendEmpty, false);
    show(dom.zeroBendTableWrap, true);
    dom.zeroBendError.textContent = "";
    dom.zeroBendError.style.display = "none";
    dom.zeroBendWarn.textContent = warn || "";
    dom.zeroBendWarn.style.display = warn ? "block" : "none";
  }

function placeArcLabelBox(ctx, text, x, y, placed) {
  ctx.save();
  ctx.font = "12px system-ui";
  const tw = ctx.measureText(text).width;
  ctx.restore();

  const box = makeBoxFromCenter(x, y, tw + 14, 20);
  if (collidesAny(box, placed, 6)) return null;

  placed.push(box);
  return box;
}

  function drawIso() {
    if (!ctxIso) return;

if (!state.isoSteps.length) {
  state.view.zoom = 1;
  state.view.panX = 0;
  state.view.panY = 0;
  state.view.pivot = { x: 0, y: 0, z: 0 };

  show(dom.errorIso, false);

  if (dom.isoLenOut) dom.isoLenOut.textContent = "–";

  const { w, h } = ensureCanvasDpr();
  ctxIso.clearRect(0, 0, w, h);

  state.view.baseScale = Math.min(w, h) / 900;
  state.view.baseCx = w / 2;
  state.view.baseCy = h / 2;

  const toCanvas = (p) => {
    const k = state.view.baseScale * state.view.zoom;
    return {
      x: state.view.baseCx + p.x * k + state.view.panX,
      y: state.view.baseCy + p.y * k + state.view.panY
    };
  };

  drawEmptyIsoGrid(ctxIso, toCanvas, 2000, 50);
  drawMiniAxes();
  renderZeroBendList(null);
  return;
}

    const radiusConfig = validateRadiusInput();
if (dom.radiusEnabled.checked && !radiusConfig) {
  show(dom.errorRadius, true);

if (dom.isoLenOut) dom.isoLenOut.textContent = "–";

  const { w, h } = ensureCanvasDpr();
  ctxIso.clearRect(0, 0, w, h);
  drawMiniAxes();
  renderZeroBendList(null);
  return;
}

    show(dom.errorRadius, false);
    show(dom.errorIso, false);

    const points3d = stepsToPoints(state.isoSteps);
    const geometry = buildRoundedGeometry(points3d);
    state.view.pivot = getModelPivot(geometry.points3d);

if (dom.isoLenOut) dom.isoLenOut.textContent = fmtMm(geometry.totalLen, 1);
    renderZeroBendList(geometry);

    const { w, h } = ensureCanvasDpr();
    if (!Number.isFinite(state.view.baseScale) || state.view.baseScale <= 0) fitView(false);

    const toCanvas = (p) => {
      const k = state.view.baseScale * state.view.zoom;
      return {
        x: state.view.baseCx + p.x * k + state.view.panX,
        y: state.view.baseCy + p.y * k + state.view.panY
      };
    };

    const cloud = getDisplayCloudProjected(projectIso, geometry);
    const centroid = cloud.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    centroid.x /= Math.max(cloud.length, 1);
    centroid.y /= Math.max(cloud.length, 1);

    const centroidCanvas = toCanvas(centroid);
    const dimSpread = clamp(1 / Math.sqrt(Math.max(state.view.zoom, 1e-6)), 0.75, 2.2);
const placedLabels = [];
    ctxIso.clearRect(0, 0, w, h);
    drawIsoGrid(ctxIso, points3d, toCanvas, w, h);
    drawMiniAxes();

    if (geometry.radiusEnabled) {
      ctxIso.save();
      ctxIso.setLineDash([5, 5]);
      ctxIso.strokeStyle = "rgba(56,189,248,.30)";
      ctxIso.lineWidth = 1.5;

      const rawProjected = points3d.map((p) => toCanvas(projectIso(p)));
      ctxIso.beginPath();
      ctxIso.moveTo(rawProjected[0].x, rawProjected[0].y);
      for (let i = 1; i < rawProjected.length; i++) ctxIso.lineTo(rawProjected[i].x, rawProjected[i].y);
      ctxIso.stroke();
      ctxIso.restore();
    }

    ctxIso.lineCap = "round";
    ctxIso.lineJoin = "round";

    ctxIso.strokeStyle = "#22c55e";
    ctxIso.lineWidth = 4;
    for (const seg of geometry.segments) {
      const a = toCanvas(projectIso(seg.start));
      const b = toCanvas(projectIso(seg.end));
      if (Math.hypot(b.x - a.x, b.y - a.y) < 0.5) continue;
      ctxIso.beginPath();
      ctxIso.moveTo(a.x, a.y);
      ctxIso.lineTo(b.x, b.y);
      ctxIso.stroke();
    }

    ctxIso.strokeStyle = "#facc15";
    ctxIso.lineWidth = 4;
    for (const bend of geometry.bends) {
      if (!bend) continue;
      const pts = sampleBendArc3d(bend, Math.max(32, Math.ceil(radToDeg(bend.arcAngle) / 2)));
      if (pts.length < 2) continue;
      ctxIso.beginPath();
      const p0 = toCanvas(projectIso(pts[0]));
      ctxIso.moveTo(p0.x, p0.y);
      for (let i = 1; i < pts.length; i++) {
        const p = toCanvas(projectIso(pts[i]));
        ctxIso.lineTo(p.x, p.y);
      }
      ctxIso.stroke();
    }

    points3d.forEach((p3, i) => {
      const c = toCanvas(projectIso(p3));
      ctxIso.beginPath();
      if (i === 0) {
        ctxIso.fillStyle = "#e5e7eb";
        ctxIso.arc(c.x, c.y, 5, 0, Math.PI * 2);
        ctxIso.fill();
        ctxIso.strokeStyle = "rgba(248,250,252,.7)";
        ctxIso.lineWidth = 2;
        ctxIso.stroke();
      } else if (i === points3d.length - 1) {
        ctxIso.fillStyle = "#f97316";
        ctxIso.arc(c.x, c.y, 5, 0, Math.PI * 2);
        ctxIso.fill();
        ctxIso.strokeStyle = "rgba(2,6,23,.8)";
        ctxIso.lineWidth = 2;
        ctxIso.stroke();
      } else {
        ctxIso.fillStyle = "rgba(229,231,235,.8)";
        ctxIso.arc(c.x, c.y, 2.6, 0, Math.PI * 2);
        ctxIso.fill();
      }
    });

    if (!state.showDims) return;

    for (const seg of geometry.segments) {
      const a = toCanvas(projectIso(seg.start));
      const b = toCanvas(projectIso(seg.end));
      if (seg.len <= 1e-4 || Math.hypot(b.x - a.x, b.y - a.y) <= 2) continue;

placeCanvasDimCAD(
  ctxIso,
  a,
  b,
  fmtMm(seg.len, 1),
  outwardSign(a, b, centroidCanvas),
  placedLabels,
  {
    color: "#e5e7eb",
    extColor: "rgba(248,250,252,.65)",
    offPx: 14 * dimSpread,
    minLenPx: 26,
    font: "12px system-ui",
    lineW: 1.3,
    extW: 1.0,
    dotR: 2.2,
    dotFill: "#e5e7eb",
    textColor: "#e5e7eb",
    gapPad: 5
  }
);
    }

  for (let i = 0; i < state.isoSteps.length; i++) {
  if (state.isoSteps[i]?.type === "OFF") {
    drawOffsetBaseTotalDim(
      ctxIso,
      points3d,
      i,
      toCanvas,
      centroidCanvas,
      dimSpread,
      placedLabels
    );
  }
}

for (const bend of geometry.bends) {
  if (bend) {
    drawArcLabelOnCanvas(
      ctxIso,
      bend,
      toCanvas,
      centroidCanvas,
      dimSpread,
      placedLabels
    );
  }
}
  }

  function getLastCardinalDir() {
  for (let i = state.isoSteps.length - 1; i >= 0; i--) {
    const step = state.isoSteps[i];
    if (step?.type === "CARD" && dirMap[step.dir]) {
      return step.dir;
    }
  }
  return null;
}

function getStepDirectionVector(step) {
  if (!step) return null;

  if (step.type === "CARD") {
    return dirMap[step.dir] || null;
  }

  if (step.type === "OFF") {
    const v = { x: step.dx || 0, y: step.dy || 0, z: step.dz || 0 };
    const n = norm3(v);
    return n.L > 1e-9 ? { dx: n.x, dy: n.y, dz: n.z } : null;
  }

  return null;
}

function isNinetyBetweenSteps(prevStep, nextStep) {
  const a = getStepDirectionVector(prevStep);
  const b = getStepDirectionVector(nextStep);
  if (!a || !b) return false;

  const dot = a.dx * b.dx + a.dy * b.dy + a.dz * b.dz;
  return Math.abs(dot) < 1e-6;
}

function getOffsetCcEndpoints(points3d, offsetStepIndex) {
  const offsetStep = state.isoSteps[offsetStepIndex];
  if (!offsetStep || offsetStep.type !== "OFF") return null;

 const beforeOffset = state.isoSteps[offsetStepIndex - 1];
const afterOffset = state.isoSteps[offsetStepIndex + 1];

if (!beforeOffset || beforeOffset.type !== "CARD") return null;

const startIndex = findCcReferenceStartIndex(offsetStepIndex);
const startPoint = points3d[startIndex];
const offsetStartPoint = points3d[offsetStepIndex];

if (!startPoint || !offsetStartPoint) return null;

const dir = dirMap[beforeOffset.dir];
if (!dir) return null;

const baseRunBeforeOffset =
  dist3(startPoint, offsetStartPoint) + offsetStep.P;

let totalLen = baseRunBeforeOffset;

// Fortsätter man i samma riktning efter offseten
if (afterOffset && afterOffset.type === "CARD" && afterOffset.dir === beforeOffset.dir) {
  totalLen += afterOffset.mm;
}

const endPoint = {
  x: startPoint.x + dir.dx * totalLen,
  y: startPoint.y + dir.dy * totalLen,
  z: startPoint.z + dir.dz * totalLen
};

return {
  startIndex,
  startPoint,
  endPoint,
  totalLen
};
}

function findCcReferenceStartIndex(offsetStepIndex) {
  // Vi letar bakåt efter senaste 90° före offseten.
  // Hittar vi ingen, används startpunkten = punktindex 0.
  for (let i = offsetStepIndex - 1; i >= 1; i--) {
    const prev = state.isoSteps[i - 1];
    const curr = state.isoSteps[i];

    if (isNinetyBetweenSteps(prev, curr)) {
      return i; // punkt efter den 90°-böjen
    }
  }

  return 0;
}

function getCcAfterOffsetCandidate(nextDir) {
  const offsetStepIndex = state.isoSteps.length - 1;
  const last = state.isoSteps[offsetStepIndex];
  const beforeLast = state.isoSteps[offsetStepIndex - 1];

  if (!last || !beforeLast) return null;
  if (last.type !== "OFF") return null;
  if (beforeLast.type !== "CARD") return null;

  // Bara om man fortsätter i samma riktning som raka steget före offseten
  if (beforeLast.dir !== nextDir) return null;

  const points = stepsToPoints(state.isoSteps);
  const offsetStartPoint = points[offsetStepIndex];
  if (!offsetStartPoint) return null;

  const referencePointIndex = findCcReferenceStartIndex(offsetStepIndex);
  const referencePoint = points[referencePointIndex];
  if (!referencePoint) return null;

  const baseRunBeforeOffset =
    dist3(referencePoint, offsetStartPoint) + last.P;

  return {
    offsetStep: last,
    previousCardinal: beforeLast,
    offsetStepIndex,
    referencePointIndex,
    baseRunBeforeOffset
  };
}
async function addCardinalStep(dir) {
  let mm = readNumber(dom.stepMmInput);
  if (!Number.isFinite(mm) || mm <= 0) return;

  const ccCandidate = getCcAfterOffsetCandidate(dir);

  if (ccCandidate) {
    const wantsCc = await openConfirmModal("Vill du ange C.C mått för sträckan efter offseten?");

    if (wantsCc) {
      const rawCc = window.prompt("Ange önskat C.C mått (mm):", "");
      const ccWanted = rawCc ? parseFloat(String(rawCc).replace(",", ".")) : NaN;

      if (!Number.isFinite(ccWanted) || ccWanted <= 0) {
        dom.errorOffset.textContent = "C.C mått måste vara större än 0.";
        show(dom.errorOffset, true);
        return;
      }

      const newLen = ccWanted - ccCandidate.baseRunBeforeOffset;

      if (!Number.isFinite(newLen) || newLen <= 0) {
        dom.errorOffset.textContent =
          "C.C mått är för litet i förhållande till sträckan fram till offseten.";
        show(dom.errorOffset, true);
        return;
      }

      mm = parseFloat(newLen.toFixed(3));
      ccCandidate.offsetStep.ccAfterWanted = ccWanted;
      ccCandidate.offsetStep.ccAfterBase = parseFloat(ccCandidate.baseRunBeforeOffset.toFixed(3));
    }
  }

  show(dom.errorOffset, false);

  state.isoSteps.push({ type: "CARD", dir, mm });
  renderStepsList();
  syncTextareaFromSteps();
  fitView(false);
  markDirty(true);
  drawIso();
}

  function addOffsetStep(offsetDir) {
  const values = validateOffsetInputs();

  if (!values) {
    dom.errorOffset.textContent = "Vinkel får inte vara 0° eller ±90°. Offset måste vara > 0.";
    return show(dom.errorOffset, true);
  }

  const baseDir = getLastCardinalDir();

  if (!baseDir) {
    dom.errorOffset.textContent = "Lägg först ett rakt steg innan du gör offset.";
    return show(dom.errorOffset, true);
  }

  const step = buildOffsetStep(baseDir, offsetDir, values.ang, values.off);
  if (!step) {
    dom.errorOffset.textContent =
      "Ogiltig offset-riktning för nuvarande rördragning. Välj ett sidled/upp/ner-håll.";
    return show(dom.errorOffset, true);
  }

  show(dom.errorOffset, false);

  const rawCc = dom.offsetCcMmInput?.value?.trim() ?? "";
  const hasCc = rawCc !== "";

  if (hasCc) {
    const ccWanted = parseFloat(rawCc.replace(",", "."));

    if (!Number.isFinite(ccWanted) || ccWanted <= 0) {
      dom.errorOffset.textContent = "C.C mått måste vara större än 0.";
      return show(dom.errorOffset, true);
    }

    const prev = state.isoSteps[state.isoSteps.length - 1];

    if (!prev || prev.type !== "CARD") {
      dom.errorOffset.textContent = "C.C mått kräver ett rakt steg direkt före offseten.";
      return show(dom.errorOffset, true);
    }

    const newPrevLen = ccWanted - step.P;

    if (!Number.isFinite(newPrevLen) || newPrevLen <= 0) {
      dom.errorOffset.textContent = "C.C mått är för litet i förhållande till offsetens projektion.";
      return show(dom.errorOffset, true);
    }

    prev.mm = parseFloat(newPrevLen.toFixed(3));
    step.ccWanted = ccWanted;
  }

  state.isoSteps.push(step);
  renderStepsList();
  syncTextareaFromSteps();
  fitView(false);
  markDirty(true);
  drawIso();
}

  function initIsoControls() {
    on(dom.offsetEnabled, "change", () => {
      show(dom.offsetPanel, dom.offsetEnabled.checked);
      show(dom.errorOffset, false);
      syncIsoMobileSections();
    });

    on(dom.dimsEnabled, "change", () => {
      state.showDims = !!dom.dimsEnabled.checked;
      drawIso();
    });

     on(dom.radiusEnabled, "change", () => {
      state.showRadius = !!dom.radiusEnabled.checked;
      show(dom.radiusPanel, dom.radiusEnabled.checked);
      show(dom.errorRadius, false);
      fitView(false);
      drawIso();
      syncIsoMobileSections();
    });

      on(dom.zeroBendEnabled, "change", () => {
      state.showZeroBend = !!dom.zeroBendEnabled.checked;
      renderZeroBendList();
      drawIso();
      syncIsoMobileSections();
    });

    on(dom.bendRadiusMmInput, "input", () => {
      state.radiusMm = readNumber(dom.bendRadiusMmInput);
      fitView(false);
      drawIso();
    });

  dom.stepButtons.forEach((btn) => on(btn, "click", async () => {
  const dir = btn.dataset.dir;
  if (dom.offsetEnabled.checked) {
    addOffsetStep(dir);
  } else {
    await addCardinalStep(dir);
  }
}));

    on(dom.undoStepBtn, "click", () => {
      state.isoSteps.pop();
      renderStepsList();
      syncTextareaFromSteps();
      fitView(false);
          markDirty(true);
      drawIso();
    });

    on(dom.clearStepsBtn, "click", async () => {
      const confirmed = await openConfirmModal("Är du säker på att du vill rensa alla steg?");

      if (!confirmed) return;

      state.isoSteps = [];
      renderStepsList();
      syncTextareaFromSteps();
if (dom.isoLenOut) dom.isoLenOut.textContent = "–";
      show(dom.errorIso, false);
      show(dom.errorOffset, false);
      show(dom.errorRadius, false);
      renderZeroBendList(null);
            markDirty(true);
      resetView();
    });

    on(dom.points3dInput, "input", () => {
      const parsed = parseSteps(dom.points3dInput.value);

      if (!parsed) {
        show(dom.errorIso, true);
        state.isoSteps = [];
        renderStepsList();
if (dom.isoLenOut) dom.isoLenOut.textContent = "–";
        renderZeroBendList(null);
        drawIso();
        return;
      }

      show(dom.errorIso, false);
      state.isoSteps = parsed;
      renderStepsList();
      fitView(false);
      drawIso();
    });


    on(dom.resetViewBtn, "click", resetView);
  }

  function getCanvasPointFromEvent(e) {
    const rect = dom.isoCanvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function getPointerCenterAndDistance() {
    const pts = [...state.pointers.values()];
    if (pts.length < 2) return null;
    const [a, b] = pts;
    return {
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
      dist: Math.hypot(b.x - a.x, b.y - a.y)
    };
  }

  function initCanvasInteractions() {
    on(dom.isoCanvas, "wheel", (e) => {
      e.preventDefault();
      ensureCanvasDpr();

      const p = getCanvasPointFromEvent(e);
      const oldZoom = state.view.zoom;
      const newZoom = clamp(oldZoom * Math.exp((-e.deltaY) * 0.0015), 0.2, 8);

      const kOld = state.view.baseScale * oldZoom;
      const kNew = state.view.baseScale * newZoom;

      const wx = (p.x - state.view.baseCx - state.view.panX) / kOld;
      const wy = (p.y - state.view.baseCy - state.view.panY) / kOld;

      state.view.zoom = newZoom;
      state.view.panX = p.x - state.view.baseCx - wx * kNew;
      state.view.panY = p.y - state.view.baseCy - wy * kNew;

      drawIso();
    }, { passive: false });

    on(dom.isoCanvas, "pointerdown", (e) => {
      dom.isoCanvas.setPointerCapture(e.pointerId);

      const p = getCanvasPointFromEvent(e);
      state.pointers.set(e.pointerId, p);

      if (state.pointers.size === 1) {
        state.dragStart = {
          x: p.x,
          y: p.y,
          panX: state.view.panX,
          panY: state.view.panY,
          pitch: state.view.pitch,
          yaw: state.view.yaw
        };
        state.pinchStart = null;
        return;
      }

      if (state.pointers.size === 2) {
        const cd = getPointerCenterAndDistance();
        if (!cd) return;

        state.pinchStart = {
          dist: cd.dist,
          cx: cd.cx,
          cy: cd.cy,
          zoom: state.view.zoom,
          panX: state.view.panX,
          panY: state.view.panY
        };

        state.dragStart = null;
      }
    });

    on(dom.isoCanvas, "pointermove", (e) => {
      if (!state.pointers.has(e.pointerId)) return;

      const p = getCanvasPointFromEvent(e);
      state.pointers.set(e.pointerId, p);

      if (state.pointers.size === 1 && state.dragStart) {
        const dx = p.x - state.dragStart.x;
        const dy = p.y - state.dragStart.y;

        const shouldPan = e.shiftKey || state.panMode;

        if (shouldPan) {
          state.view.panX = state.dragStart.panX + dx;
          state.view.panY = state.dragStart.panY + dy;
        } else {
          state.view.yaw = state.dragStart.yaw + dx * 0.01;

          const pitchFactor = state.invertPitch ? -1 : 1;
          state.view.pitch = state.dragStart.pitch + dy * 0.008 * pitchFactor;
          state.view.pitch = clamp(state.view.pitch, -1.35, 1.35);
        }

        drawIso();
        return;
      }

      if (state.pointers.size === 2 && state.pinchStart) {
        const cd = getPointerCenterAndDistance();
        if (!cd) return;

        const startDist = Math.max(state.pinchStart.dist, 1e-6);
        const newZoom = clamp(
          state.pinchStart.zoom * (cd.dist / startDist),
          0.2,
          8
        );

        const dxCenter = cd.cx - state.pinchStart.cx;
        const dyCenter = cd.cy - state.pinchStart.cy;

        const kOld = state.view.baseScale * state.pinchStart.zoom;
        const kNew = state.view.baseScale * newZoom;

        const wx = (state.pinchStart.cx - state.view.baseCx - state.pinchStart.panX) / kOld;
        const wy = (state.pinchStart.cy - state.view.baseCy - state.pinchStart.panY) / kOld;

        state.view.zoom = newZoom;
        state.view.panX = state.pinchStart.cx - state.view.baseCx - wx * kNew + dxCenter;
        state.view.panY = state.pinchStart.cy - state.view.baseCy - wy * kNew + dyCenter;

        drawIso();
      }
    });

    const endPointer = (e) => {
      if (!state.pointers.has(e.pointerId)) return;
      state.pointers.delete(e.pointerId);

      if (state.pointers.size === 0) {
        state.dragStart = null;
        state.pinchStart = null;
        return;
      }

      if (state.pointers.size === 1) {
        const remaining = [...state.pointers.values()][0];

        state.dragStart = {
          x: remaining.x,
          y: remaining.y,
          panX: state.view.panX,
          panY: state.view.panY,
          pitch: state.view.pitch,
          yaw: state.view.yaw
        };

        state.pinchStart = null;
      }
    };

    ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => {
      on(dom.isoCanvas, ev, endPointer);
    });

    on(window, "resize", () => {
      if (!dom.modeIso3d.classList.contains("hidden")) {
        fitView(true);
        drawIso();
      }
    });
  }
  function markDirty(isDirty = true) {
    state.isDirty = !!isDirty;
    updateSaveStatusChip();
  }

  function updateSaveStatusChip() {
    if (!dom.saveStatusChip) return;

    dom.saveStatusChip.classList.remove("dirty", "saved");

    if (!state.drawingId) {
      dom.saveStatusChip.textContent = "Ej sparad";
      if (state.isDirty) dom.saveStatusChip.classList.add("dirty");
      return;
    }

    dom.saveStatusChip.textContent = state.isDirty
      ? `Osparade ändringar • ${state.drawingName || "Namnlös ritning"}`
      : `Sparad • ${state.drawingName || "Namnlös ritning"}`;

    dom.saveStatusChip.classList.add(state.isDirty ? "dirty" : "saved");
  }

  function getAppSnapshot() {
    return {
      mode: dom.modeButtons.find((btn) => btn.classList.contains("active"))?.dataset.mode || "heightAngle",

      heightAngle: {
        height: dom.height2Input?.value ?? "",
        angle: dom.angle2Input?.value ?? ""
      },

      iso: {
        stepMm: dom.stepMmInput?.value ?? "",
        points3d: dom.points3dInput?.value ?? "",
        offsetEnabled: !!dom.offsetEnabled?.checked,
        offsetAngle: dom.offsetAngleInput?.value ?? "",
        offsetMm: dom.offsetMmInput?.value ?? "",
        offsetCcMm: dom.offsetCcMmInput?.value ?? "",
        dimsEnabled: !!dom.dimsEnabled?.checked,
        radiusEnabled: !!dom.radiusEnabled?.checked,
        bendRadiusMm: dom.bendRadiusMmInput?.value ?? "",
        zeroBendEnabled: !!dom.zeroBendEnabled?.checked
      },

      view: {
        pitch: state.view.pitch,
        yaw: state.view.yaw,
        zoom: state.view.zoom,
        panX: state.view.panX,
        panY: state.view.panY
      }
    };
  }

  function applyAppSnapshot(snapshot) {
    if (!snapshot) return;

    if (snapshot.heightAngle) {
      dom.height2Input.value = snapshot.heightAngle.height ?? dom.height2Input.value;
      dom.angle2Input.value = snapshot.heightAngle.angle ?? dom.angle2Input.value;
    }

    if (snapshot.iso) {
      dom.stepMmInput.value = snapshot.iso.stepMm ?? dom.stepMmInput.value;
      dom.points3dInput.value = snapshot.iso.points3d ?? dom.points3dInput.value;

      dom.offsetEnabled.checked = !!snapshot.iso.offsetEnabled;
      dom.offsetAngleInput.value = snapshot.iso.offsetAngle ?? dom.offsetAngleInput.value;
      dom.offsetMmInput.value = snapshot.iso.offsetMm ?? dom.offsetMmInput.value;
      dom.offsetCcMmInput.value = snapshot.iso.offsetCcMm ?? dom.offsetCcMmInput.value;

      dom.dimsEnabled.checked = snapshot.iso.dimsEnabled !== false;
      dom.radiusEnabled.checked = !!snapshot.iso.radiusEnabled;
      dom.bendRadiusMmInput.value = snapshot.iso.bendRadiusMm ?? dom.bendRadiusMmInput.value;
      dom.zeroBendEnabled.checked = !!snapshot.iso.zeroBendEnabled;
    }

    if (snapshot.view) {
      state.view.pitch = Number.isFinite(snapshot.view.pitch) ? snapshot.view.pitch : DEFAULT_VIEW.pitch;
      state.view.yaw = Number.isFinite(snapshot.view.yaw) ? snapshot.view.yaw : DEFAULT_VIEW.yaw;
      state.view.zoom = Number.isFinite(snapshot.view.zoom) ? snapshot.view.zoom : 1;
      state.view.panX = Number.isFinite(snapshot.view.panX) ? snapshot.view.panX : 0;
      state.view.panY = Number.isFinite(snapshot.view.panY) ? snapshot.view.panY : 0;
    }

    state.showDims = !!dom.dimsEnabled.checked;
    state.showRadius = !!dom.radiusEnabled.checked;
    state.showZeroBend = !!dom.zeroBendEnabled.checked;

    show(dom.offsetPanel, dom.offsetEnabled.checked);
    show(dom.radiusPanel, dom.radiusEnabled.checked);
    show(dom.zeroBendPanel, dom.zeroBendEnabled.checked);

    calculateHeightAngle();

    state.isoSteps = parseSteps(dom.points3dInput.value) || [];
    renderStepsList();

    fitView(false);
    drawIso();

    const mode = snapshot.mode || "heightAngle";
    const targetBtn = dom.modeButtons.find((btn) => btn.dataset.mode === mode);
    if (targetBtn) {
      dom.modeButtons.forEach((b) => b.classList.remove("active"));
      targetBtn.classList.add("active");
      showMode(mode);
    }
  }

function resetAppToNewDrawing() {
  const activeMode =
    dom.modeButtons.find((btn) => btn.classList.contains("active"))?.dataset.mode || "heightAngle";

  state.drawingId = null;
  state.drawingName = "";
  state.isDirty = false;

  dom.height2Input.value = "75";
  dom.angle2Input.value = "45";

  dom.stepMmInput.value = "100";
  dom.points3dInput.value = "";

  dom.offsetEnabled.checked = false;
  dom.offsetAngleInput.value = "45";
  dom.offsetMmInput.value = "100";
  dom.offsetCcMmInput.value = "";

  dom.dimsEnabled.checked = true;
  dom.radiusEnabled.checked = false;
  dom.bendRadiusMmInput.value = "56";
  dom.zeroBendEnabled.checked = false;

  state.view.pivot = { x: 0, y: 0, z: 0 };
  state.view.pitch = DEFAULT_VIEW.pitch;
  state.view.yaw = DEFAULT_VIEW.yaw;
  state.view.zoom = 1;
  state.view.panX = 0;
  state.view.panY = 0;

  state.showDims = true;
  state.showRadius = false;
  state.showZeroBend = false;

  show(dom.offsetPanel, false);
  show(dom.radiusPanel, false);
  show(dom.zeroBendPanel, false);
  show(dom.errorIso, false);
  show(dom.errorOffset, false);
  show(dom.errorRadius, false);

  calculateHeightAngle();

  state.isoSteps = [];
  renderStepsList();

if (dom.isoLenOut) dom.isoLenOut.textContent = "–";

  renderZeroBendList(null);
  fitView(false);
  drawIso();
  updateSaveStatusChip();

  const targetBtn = dom.modeButtons.find((btn) => btn.dataset.mode === activeMode);
  if (targetBtn) {
    dom.modeButtons.forEach((b) => b.classList.remove("active"));
    targetBtn.classList.add("active");
    showMode(activeMode);
  }
}

  function openSimpleModal(modalEl, focusEl = null) {
    if (!modalEl) return;
    modalEl.classList.remove("hidden");
    modalEl.setAttribute("aria-hidden", "false");
    if (focusEl && typeof focusEl.focus === "function") {
      setTimeout(() => focusEl.focus(), 0);
    }
  }

  function closeSimpleModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add("hidden");
    modalEl.setAttribute("aria-hidden", "true");
  }

  function askDrawingName(defaultValue = "") {
    return new Promise((resolve) => {
      if (!dom.saveModal || !dom.saveNameInput || !dom.saveConfirmBtn || !dom.saveCancelBtn) {
        const value = window.prompt("Ange namn på ritningen:", defaultValue || "");
        resolve(value ? value.trim() : "");
        return;
      }

      dom.saveNameInput.value = defaultValue || "";
      openSimpleModal(dom.saveModal, dom.saveNameInput);

      const cleanup = () => {
        dom.saveConfirmBtn.removeEventListener("click", onOk);
        dom.saveCancelBtn.removeEventListener("click", onCancel);
        dom.saveModal.removeEventListener("click", onBackdrop);
        document.removeEventListener("keydown", onKey);
        closeSimpleModal(dom.saveModal);
      };

      const onOk = () => {
        const value = (dom.saveNameInput.value || "").trim();
        cleanup();
        resolve(value);
      };

      const onCancel = () => {
        cleanup();
        resolve("");
      };

      const onBackdrop = (e) => {
        if (e.target === dom.saveModal) {
          cleanup();
          resolve("");
        }
      };

      const onKey = (e) => {
        if (e.key === "Escape") {
          cleanup();
          resolve("");
        }
        if (e.key === "Enter") {
          e.preventDefault();
          onOk();
        }
      };

      dom.saveConfirmBtn.addEventListener("click", onOk);
      dom.saveCancelBtn.addEventListener("click", onCancel);
      dom.saveModal.addEventListener("click", onBackdrop);
      document.addEventListener("keydown", onKey);
    });
  }

async function saveCurrentDrawing(forceNew = false) {
  const payload = getAppSnapshot();

  try {
    // Snabb-spara: finns redan en ritning och användaren tryckte bara "Spara"
    if (!forceNew && state.drawingId) {
      const saved = await window.ArchiveStore.updateDrawing(state.drawingId, {
        data: payload
      });

      state.drawingName = saved.name || state.drawingName || "Namnlös ritning";
      markDirty(false);
      return;
    }

    // Första sparningen eller "Spara som"
    const nameDefault = state.drawingName || "Namnlös ritning";
    const chosenName = await askDrawingName(nameDefault);
    if (!chosenName) return;

    if (forceNew || !state.drawingId) {
      const saved = await window.ArchiveStore.createDrawing({
        name: chosenName,
        data: payload
      });
      state.drawingId = saved.id;
      state.drawingName = saved.name;
    } else {
      const saved = await window.ArchiveStore.updateDrawing(state.drawingId, {
        name: chosenName,
        data: payload
      });
      state.drawingName = saved.name;
    }

    markDirty(false);
  } catch (err) {
    alert("Kunde inte spara ritningen: " + (err?.message || err));
  }
}

  async function loadDrawingRecord(record) {
    if (!record?.data) return;

    state.drawingId = record.id;
    state.drawingName = record.name || "Namnlös ritning";
    applyAppSnapshot(record.data);
    markDirty(false);
  }

  function formatDateTime(iso) {
    if (!iso) return "–";
    const d = new Date(iso);
    return d.toLocaleString("sv-SE");
  }

  async function renderArchiveList() {
    if (!dom.archiveList || !dom.archiveCount) return;

    try {
      const items = await window.ArchiveStore.listDrawings();
      dom.archiveCount.textContent = `${items.length} ritningar`;
      dom.archiveList.innerHTML = "";

      if (!items.length) {
        dom.archiveList.innerHTML = `<div class="archive-empty">Inga sparade ritningar ännu.</div>`;
        return;
      }

      for (const item of items) {
        const card = document.createElement("div");
        card.className = "archive-item" + (item.id === state.drawingId ? " current" : "");

        card.innerHTML = `
          <div class="archive-item-top">
            <div>
              <div class="archive-item-name">${item.name || "Namnlös ritning"}</div>
              <div class="archive-item-meta">
                Skapad: ${formatDateTime(item.createdAt)}<br>
                Ändrad: ${formatDateTime(item.updatedAt)}
              </div>
            </div>
            <div class="archive-item-badges">
              ${item.id === state.drawingId ? `<span class="archive-badge">Aktiv</span>` : ``}
            </div>
          </div>

          <div class="archive-item-actions">
            <button class="mini-btn" data-action="open">Öppna</button>
            <button class="mini-btn" data-action="rename">Byt namn</button>
            <button class="mini-btn" data-action="duplicate">Duplicera</button>
            <button class="mini-btn" data-action="delete">Radera</button>
          </div>
        `;

        const openBtn = card.querySelector('[data-action="open"]');
        const renameBtn = card.querySelector('[data-action="rename"]');
        const duplicateBtn = card.querySelector('[data-action="duplicate"]');
        const deleteBtn = card.querySelector('[data-action="delete"]');

        openBtn.onclick = async () => {
          const full = await window.ArchiveStore.getDrawing(item.id);
          if (!full) return alert("Ritningen hittades inte.");
          await loadDrawingRecord(full);
          closeSimpleModal(dom.archiveModal);
        };

        renameBtn.onclick = async () => {
          const newName = window.prompt("Nytt namn:", item.name || "");
          if (!newName || !newName.trim()) return;
          await window.ArchiveStore.renameDrawing(item.id, newName.trim());
          if (item.id === state.drawingId) {
            state.drawingName = newName.trim();
            updateSaveStatusChip();
          }
          renderArchiveList();
        };

        duplicateBtn.onclick = async () => {
          await window.ArchiveStore.duplicateDrawing(item.id, `${item.name || "Namnlös ritning"} (kopia)`);
          renderArchiveList();
        };

        deleteBtn.onclick = async () => {
          const ok = await openConfirmModal(`Radera ritningen "${item.name}"?`);
          if (!ok) return;

          await window.ArchiveStore.deleteDrawing(item.id);

          if (item.id === state.drawingId) {
            resetAppToNewDrawing();
          }

          renderArchiveList();
        };

        dom.archiveList.appendChild(card);
      }
    } catch (err) {
      dom.archiveList.innerHTML = `<div class="archive-empty">Kunde inte läsa arkivet.</div>`;
    }
  }

  async function openArchiveModal() {
    await renderArchiveList();
    openSimpleModal(dom.archiveModal, dom.archiveCloseBtn);
  }

  function setupDirtyTracking() {
    const mark = () => markDirty(true);

    [
      dom.height2Input,
      dom.angle2Input,
      dom.stepMmInput,
      dom.points3dInput,
      dom.offsetEnabled,
      dom.offsetAngleInput,
      dom.offsetMmInput,
      dom.offsetCcMmInput,
      dom.dimsEnabled,
      dom.radiusEnabled,
      dom.bendRadiusMmInput,
      dom.zeroBendEnabled
    ].forEach((el) => {
      if (!el) return;
      on(el, "input", mark);
      on(el, "change", mark);
    });
  }

  function initArchiveUi() {
   on(dom.saveDrawingBtn, "click", () => saveCurrentDrawing(false));

    on(dom.newDrawingBtn, "click", async () => {
      if (state.isDirty) {
        const ok = await openConfirmModal("Du har osparade ändringar. Vill du skapa en ny ritning ändå?");
        if (!ok) return;
      }
      resetAppToNewDrawing();
    });

    on(dom.archiveBtn, "click", openArchiveModal);
    on(dom.archiveCloseBtn, "click", () => closeSimpleModal(dom.archiveModal));

    on(dom.archiveModal, "click", (e) => {
      if (e.target === dom.archiveModal) closeSimpleModal(dom.archiveModal);
    });
  }

function bindNumericInputUx(input, { restoreOnEmpty = true } = {}) {
  if (!input) return;

  const sanitize = () => {
    const original = String(input.value ?? "");
    let cleaned = original.replace(/\./g, ",");      // punkt blir komma
    cleaned = cleaned.replace(/[^0-9,]/g, "");       // tillåt bara siffror + komma

    const firstComma = cleaned.indexOf(",");
    if (firstComma !== -1) {
      cleaned =
        cleaned.slice(0, firstComma + 1) +
        cleaned.slice(firstComma + 1).replace(/,/g, "");
    }

    if (cleaned !== original) {
      input.value = cleaned;
    }
  };

  on(input, "focus", () => {
    input.dataset.prevValue = input.value ?? "";
    input.value = "";
  });

  on(input, "input", sanitize);

  on(input, "blur", () => {
    sanitize();

    if (!input.value.trim() && restoreOnEmpty) {
      input.value = input.dataset.prevValue ?? "";
    }
  });

  on(input, "keydown", (e) => {
    if (e.key === "Enter") {
      input.blur();
    }
  });
}

function initMobileNumberInputs() {
  [
    dom.stepMmInput,
    dom.offsetAngleInput,
    dom.offsetMmInput,
    dom.offsetCcMmInput,
    dom.bendRadiusMmInput,
    dom.angle2Input
  ].forEach((input) => bindNumericInputUx(input));
}

function setDetailsOpen(el, open) {
  if (!el) return;
  el.open = !!open;
}

function syncIsoMobileSections() {
  const isMobile = window.innerWidth <= 520;

  if (!isMobile) {
    setDetailsOpen(dom.offsetDetails, true);
    setDetailsOpen(dom.radiusDetails, true);
    setDetailsOpen(dom.manualStepsDetails, true);
    setDetailsOpen(dom.stepsListDetails, true);
    return;
  }

  setDetailsOpen(dom.offsetDetails, !!dom.offsetEnabled?.checked);
  setDetailsOpen(dom.radiusDetails, !!dom.radiusEnabled?.checked || !!dom.zeroBendEnabled?.checked);
  setDetailsOpen(dom.manualStepsDetails, false);
  setDetailsOpen(dom.stepsListDetails, state.isoSteps.length > 0);
}

function initApp() {
  initTabs();
  initHeightAngle();
  initIsoControls();
  initCanvasInteractions();
  initArchiveUi();
  initMobileNumberInputs();
  setupDirtyTracking();

    const exportIsoPdf = window.PdfModule.createExportIsoPdf({
      state,
      dom,
      validateRadiusInput,
      stepsToPoints,
      buildRoundedGeometry,
      getModelPivot,
      computeZeroPointBendRows,
      getDisplayCloudProjected,
      projectIso,
      sampleBendArc3d
    });
    window.PdfModule.initPdfExport(dom.exportPdfBtn, exportIsoPdf);

    calculateHeightAngle();

    state.isoSteps = parseSteps(dom.points3dInput.value) || [];
    renderStepsList();
    ensureCanvasDpr();
    show(dom.offsetPanel, dom.offsetEnabled.checked);
    show(dom.radiusPanel, dom.radiusEnabled.checked);
    show(dom.zeroBendPanel, dom.zeroBendEnabled.checked);
    fitView(false);
    drawIso();
        syncIsoMobileSections();
    updateSaveStatusChip();
  }

  initApp();
})();