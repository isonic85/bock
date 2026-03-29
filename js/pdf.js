(() => {
  const {
    norm3,
    sub3,
    radToDeg,
    angleBetween3,
    fmtDeg,
    fmtMm,
    outwardSign,
    dist3
  } = window.AppUtils;

  function getJsPDFClass() {
    return window.jspdf?.jsPDF || window.jsPDF || null;
  }

  function bendAngle3D(prev, cur, next) {
    const u = norm3(sub3(cur, prev));
    const v = norm3(sub3(next, cur));
    return u.L < 1e-9 || v.L < 1e-9 ? NaN : radToDeg(angleBetween3(u, v));
  }

  function pdfArrowHead(doc, x, y, angRad, size, color = [0, 0, 0]) {
    const left = angRad + Math.PI * 0.85;
    const right = angRad - Math.PI * 0.85;
    const x1 = x + Math.cos(left) * size;
    const y1 = y + Math.sin(left) * size;
    const x2 = x + Math.cos(right) * size;
    const y2 = y + Math.sin(right) * size;

    doc.setFillColor(...color);
    if (typeof doc.triangle === "function") {
      doc.triangle(x, y, x1, y1, x2, y2, "F");
    } else {
      doc.setDrawColor(...color);
      doc.line(x, y, x1, y1);
      doc.line(x, y, x2, y2);
    }
  }

  function drawPdfDimCAD(doc, a, b, text, outward, opts = {}) {
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
    const bDim = { x: b.x + ex + ux * (need / 2), y: b.y + ey * 1 + uy * (need / 2) };
    const ang = Math.atan2(bDim.y - aDim.y, bDim.x - aDim.x);

    doc.setDrawColor(...(opts.extColor ?? [160, 160, 160]));
    doc.setLineWidth(opts.extW ?? 0.15);
    doc.line(a.x, a.y, aDim.x, aDim.y);
    doc.line(b.x, b.y, bDim.x, bDim.y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(opts.fontSize ?? 8.5);

    const tw = doc.getTextWidth(text);
    const gap = tw / 2 + (opts.gapPad ?? 1.8);
    const mx = (aDim.x + bDim.x) / 2;
    const my = (aDim.y + bDim.y) / 2;

    const gx1 = { x: mx - Math.cos(ang) * gap, y: my - Math.sin(ang) * gap };
    const gx2 = { x: mx + Math.cos(ang) * gap, y: my + Math.sin(ang) * gap };

    doc.setDrawColor(...(opts.color ?? [0, 0, 0]));
    doc.setLineWidth(opts.lineW ?? 0.2);
    doc.line(aDim.x, aDim.y, gx1.x, gx1.y);
    doc.line(gx2.x, gx2.y, bDim.x, bDim.y);

    const r = opts.dotR ?? 0.55;
    doc.setFillColor(...(opts.dotFill ?? [0, 0, 0]));
    doc.circle(aDim.x, aDim.y, r, "F");
    doc.circle(bDim.x, bDim.y, r, "F");

    let rot = radToDeg(ang);
    if (rot > 90 || rot < -90) rot += 180;

    doc.setTextColor(...(opts.textColor ?? [0, 0, 0]));
    doc.text(text, mx, my + (opts.textNudge ?? 0.6), { angle: rot, align: "center" });
  }

  function drawPdfAngleLeader(doc, vertexIndex, pts3d, pts2, centroid) {
    if (vertexIndex <= 0 || vertexIndex >= pts2.length - 1) return;

    const ang3d = bendAngle3D(pts3d[vertexIndex - 1], pts3d[vertexIndex], pts3d[vertexIndex + 1]);
    if (!Number.isFinite(ang3d) || ang3d < 1 || ang3d > 179) return;

    const p = pts2[vertexIndex];
    let vx = p.x - centroid.x;
    let vy = p.y - centroid.y;
    const vL = Math.hypot(vx, vy) || 1;
    vx /= vL;
    vy /= vL;

    const text = fmtDeg(ang3d, 1);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);

    for (const r of [10, 14, 18, 22, 28, 36, 46, 58]) {
      const ax = p.x + vx * r;
      const ay = p.y + vy * r;
      const startX = ax - vx * 4.0;
      const startY = ay - vy * 2.2;

      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.18);
      doc.line(startX, startY, p.x, p.y);

      pdfArrowHead(doc, p.x, p.y, Math.atan2(p.y - startY, p.x - startX), 1.5, [0, 0, 0]);
      doc.text(text, ax, ay + 1.2, { align: "center" });
      return;
    }
  }

  function drawPdfArcLabel(doc, bend, toPdf, centroid2, sampleBendArc3d, projectIso) {
    if (!bend) return;
    const arcPts = sampleBendArc3d(bend, 18);
    if (arcPts.length < 3) return;

    const mid3 = arcPts[Math.floor(arcPts.length / 2)];
    const prev3 = arcPts[Math.max(0, Math.floor(arcPts.length / 2) - 1)];
    const next3 = arcPts[Math.min(arcPts.length - 1, Math.floor(arcPts.length / 2) + 1)];

    const mid = toPdf(projectIso(mid3));
    const prev = toPdf(projectIso(prev3));
    const next = toPdf(projectIso(next3));

    const tangX = next.x - prev.x;
    const tangY = next.y - prev.y;
    const tangLen = Math.hypot(tangX, tangY) || 1;

    let nx = -tangY / tangLen;
    let ny = tangX / tangLen;

    const sign = (nx * (centroid2.x - mid.x) + ny * (centroid2.y - mid.y)) > 0 ? -1 : 1;
    nx *= sign;
    ny *= sign;

    const labelX = mid.x + nx * 10;
    const labelY = mid.y + ny * 10;
    const text = `R ${bend.radius.toFixed(1)} / B ${bend.arcLen.toFixed(1)}`;

    doc.setDrawColor(190, 24, 93);
    doc.setLineWidth(0.18);
    doc.line(mid.x, mid.y, labelX, labelY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text(text, labelX, labelY + 1.0, { align: "center" });
  }
function shouldDrawOffsetBaseDim(step) {
  if (!step || step.type !== "OFF") return false;

  if (step.dir === "UP" || step.dir === "DOWN") return false;

  return true;
}
function drawPdfOffsetBaseTotalDim(doc, points3d, stepIndex, toPdf, centroid2, state, projectIso) {
  if (stepIndex <= 0) return;

  const step = state.isoSteps[stepIndex];
  if (!shouldDrawOffsetBaseDim(step)) return;

    const prevStepStart = points3d[stepIndex - 1];
    const offsetStart = points3d[stepIndex];

    const basePoint = {
      x: offsetStart.x + step.proj.dx,
      y: offsetStart.y + step.proj.dy,
      z: offsetStart.z + step.proj.dz
    };

    const totalLen = dist3(prevStepStart, basePoint);

    const a = toPdf(projectIso(prevStepStart));
    const b = toPdf(projectIso(basePoint));

    if (Math.hypot(b.x - a.x, b.y - a.y) <= 1) return;

    drawPdfDimCAD(
      doc,
      a,
      b,
      fmtMm(totalLen, 1),
      outwardSign(a, b, centroid2),
      {
        color: [56, 189, 248],
        extColor: [110, 190, 220],
        offPx: 16,
        minLenPx: 28,
        fontSize: 8,
        lineW: 0.2,
        extW: 0.15,
        dotR: 0.5,
        dotFill: [56, 189, 248],
        textColor: [56, 189, 248],
        gapPad: 1.6
      }
    );
  }

  function createExportIsoPdf(deps) {
    const {
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
    } = deps;

    return function exportIsoPdf() {
      try {
        if (!state.isoSteps.length) return alert("Inga steg att exportera.");

        const radiusConfig = validateRadiusInput();
        if (dom.radiusEnabled.checked && !radiusConfig) {
          return alert("Radien måste vara större än 0 mm.");
        }

        const JsPDF = getJsPDFClass();
        if (!JsPDF) {
          return alert("jsPDF hittades inte. Kontrollera att CDN-scriptet laddas.");
        }

        const pts3d = stepsToPoints(state.isoSteps);
        const geometry = buildRoundedGeometry(pts3d);
        state.view.pivot = getModelPivot(geometry.points3d);
        const zeroRowsResult = computeZeroPointBendRows(geometry, state.isoSteps);

        const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "landscape" });

        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 10;
        const tableW = 95;
        const gap = 8;

        const drawX0 = margin;
        const drawY0 = margin;
        const drawW = pageW - margin * 2 - tableW - gap;
        const drawH = pageH - margin * 2;

        const tableX0 = drawX0 + drawW + gap;
        const tableY0 = margin;

        const cloud = getDisplayCloudProjected(projectIso, geometry);
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        for (const p of cloud) {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        }

        const spanX = Math.max(maxX - minX, 1e-9);
        const spanY = Math.max(maxY - minY, 1e-9);
        const scale = Math.min((drawW - 20) / spanX, (drawH - 20) / spanY);
        const cx = drawX0 + drawW / 2;
        const cy = drawY0 + drawH / 2;
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;

        const toPdf = (p) => ({
          x: cx + (p.x - midX) * scale,
          y: cy + (p.y - midY) * scale
        });

        const pts2 = pts3d.map((p) => toPdf(projectIso(p)));
        const centroid = cloud.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
        centroid.x /= Math.max(cloud.length, 1);
        centroid.y /= Math.max(cloud.length, 1);
        const centroid2 = toPdf(centroid);

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.35);
        doc.rect(drawX0, drawY0, drawW, drawH);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("ISO-ritning", drawX0 + 4, drawY0 + 6);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(`Punkter: ${pts3d.length}`, drawX0 + 4, drawY0 + 11);
        doc.text(`Total längd (3D): ${geometry.totalLen.toFixed(1)} mm`, drawX0 + 4, drawY0 + 15);
        doc.text(
          `Vy: pitch ${radToDeg(state.view.pitch).toFixed(1)}° / yaw ${radToDeg(state.view.yaw).toFixed(1)}°`,
          drawX0 + 4,
          drawY0 + 19
        );
        doc.text(`Radie aktiv: ${geometry.radiusEnabled ? "Ja" : "Nej"}`, drawX0 + 4, drawY0 + 23);

        if (geometry.radiusEnabled) {
          doc.setDrawColor(180, 190, 210);
          doc.setLineWidth(0.18);
          if (typeof doc.setLineDash === "function") doc.setLineDash([2, 1.6], 0);
          for (let i = 1; i < pts2.length; i++) {
            doc.line(pts2[i - 1].x, pts2[i - 1].y, pts2[i].x, pts2[i].y);
          }
          if (typeof doc.setLineDash === "function") doc.setLineDash([], 0);
        }

        doc.setDrawColor(16, 120, 60);
        doc.setLineWidth(0.9);
        for (const seg of geometry.segments) {
          const a = toPdf(projectIso(seg.start));
          const b = toPdf(projectIso(seg.end));
          doc.line(a.x, a.y, b.x, b.y);
        }

        doc.setDrawColor(210, 160, 20);
        doc.setLineWidth(0.9);
        for (const bend of geometry.bends) {
          if (!bend) continue;
          const arcPts = sampleBendArc3d(bend, 24).map((p) => toPdf(projectIso(p)));
          for (let i = 1; i < arcPts.length; i++) {
            doc.line(arcPts[i - 1].x, arcPts[i - 1].y, arcPts[i].x, arcPts[i].y);
          }
        }

        pts2.forEach((p, i) => {
          if (i === 0) doc.setFillColor(0, 0, 0);
          else if (i === pts2.length - 1) doc.setFillColor(230, 126, 34);
          else doc.setFillColor(60, 60, 60);
          doc.circle(p.x, p.y, i === 0 || i === pts2.length - 1 ? 2.0 : 1.4, "F");
        });

        if (state.showDims) {
          for (const seg of geometry.segments) {
            if (seg.len <= 1e-4) continue;
            const a = toPdf(projectIso(seg.start));
            const b = toPdf(projectIso(seg.end));
            drawPdfDimCAD(doc, a, b, fmtMm(seg.len, 1), outwardSign(a, b, centroid2), {
              color: [0, 0, 0],
              extColor: [120, 120, 120],
              offPx: 10,
              minLenPx: 26,
              fontSize: 8,
              lineW: 0.18,
              extW: 0.15,
              dotR: 0.45,
              dotFill: [0, 0, 0],
              textColor: [0, 0, 0],
              gapPad: 1.6
            });
          }

          for (let i = 0; i < state.isoSteps.length; i++) {
            if (state.isoSteps[i]?.type === "OFF") {
              drawPdfOffsetBaseTotalDim(doc, pts3d, i, toPdf, centroid2, state, projectIso);
            }
          }

          for (const bend of geometry.bends) {
            if (bend) drawPdfArcLabel(doc, bend, toPdf, centroid2, sampleBendArc3d, projectIso);
          }
        }

        for (let i = 1; i < pts2.length - 1; i++) {
          drawPdfAngleLeader(doc, i, pts3d, pts2, centroid2);
        }

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.35);
        doc.rect(tableX0, tableY0, tableW, drawH);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Mått & vinklar", tableX0 + 4, tableY0 + 7);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);

        let y = tableY0 + 13;
        const lineHeight = 4.2;
        const row = (text) => {
          if (y > tableY0 + drawH - 6) return false;
          doc.text(text, tableX0 + 4, y);
          y += lineHeight;
          return true;
        };

        row("Steg:");
        for (let i = 0; i < state.isoSteps.length; i++) {
          const step = state.isoSteps[i];
          const idx = String(i + 1).padStart(2, "0");
          if (step.type === "CARD") {
            if (!row(`${idx}. ${step.dir}  ${fmtMm(step.mm, 1)}`)) break;
          } else {
            if (!row(`${idx}. O ${step.dir}  v:${fmtDeg(step.ang, 1)}  off:${fmtMm(step.off, 1)}`)) break;
            if (!row(`    → L:${fmtMm(step.mm, 1)}  proj:${fmtMm(step.P, 1)}`)) break;
          }
        }

        y += 2;
        row("Raka mått / tangent:");
        for (const seg of geometry.segments) {
          if (!row(`${String(seg.index + 1).padStart(2, "0")}: ${fmtMm(seg.len, 1)}`)) break;
        }

        y += 2;
        row("Böjar:");
        for (const bend of geometry.bends) {
          if (bend && !row(`${String(bend.i).padStart(2, "0")}: R ${fmtMm(bend.radius, 1)}  B ${fmtMm(bend.arcLen, 1)}`)) {
            break;
          }
        }

        y += 2;
        row("Bockvinklar:");
        for (let i = 1; i < pts3d.length - 1; i++) {
          if (!row(`${String(i).padStart(2, "0")}: ${fmtDeg(bendAngle3D(pts3d[i - 1], pts3d[i], pts3d[i + 1]), 1)}`)) {
            break;
          }
        }

        if (state.showZeroBend && zeroRowsResult.rows?.length) {
          y += 2;
          row("0-punkt bocklista:");
          for (const entry of zeroRowsResult.rows) {
            if (!row(`${String(entry.no).padStart(2, "0")}: ${entry.type}`)) break;
            if (!row(`    del:${fmtMm(entry.delta, 1)}  start:${fmtMm(entry.cumulative, 1)}`)) break;
          }
        }

        const now = new Date();
        doc.save(
          `ISO-ritning_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.pdf`
        );
      } catch (err) {
        console.error("PDF-export fel:", err);
        alert("PDF-export kraschade: " + (err?.message || err));
      }
    };
  }

  function initPdfExport(button, exportIsoPdf) {
    if (button) button.onclick = exportIsoPdf;
  }

  window.PdfModule = {
    getJsPDFClass,
    bendAngle3D,
    pdfArrowHead,
    drawPdfDimCAD,
    drawPdfAngleLeader,
    drawPdfArcLabel,
    drawPdfOffsetBaseTotalDim,
    createExportIsoPdf,
    initPdfExport
  };
})();