(() => {
  "use strict";

  const DEFAULTS = Object.freeze({
    appName: "Rörbockning med Farbror Niklas",
    version: "1.1",
    copyright: "©Copyright 2026 Niklas Persson",
    defaultDrawingTitle: "ISO-ritning"
  });

  function byId(id) {
    return document.getElementById(id);
  }

  function valueOf(id) {
    return String(byId(id)?.value ?? "").trim();
  }

  function setValue(id, value) {
    const el = byId(id);
    if (el) el.value = value ?? "";
  }

  function cleanFilenamePart(value, fallback = "ritning") {
    const s = String(value || fallback)
      .trim()
      .replace(/[åä]/gi, "a")
      .replace(/ö/gi, "o")
      .replace(/[^a-z0-9\-_]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    return s || fallback;
  }

  function dateStamp(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function collectMeta(state = {}) {
    const title = valueOf("drawingTitle") || state.drawingName || DEFAULTS.defaultDrawingTitle;
    return {
      title,
      project: valueOf("drawingProject"),
      material: valueOf("drawingMaterial"),
      drawingNo: valueOf("drawingNo"),
      note: valueOf("drawingNote"),
      appName: DEFAULTS.appName,
      version: DEFAULTS.version,
      copyright: DEFAULTS.copyright,
      date: dateStamp()
    };
  }

  function snapshotMeta() {
    return {
      title: valueOf("drawingTitle"),
      project: valueOf("drawingProject"),
      material: valueOf("drawingMaterial"),
      drawingNo: valueOf("drawingNo"),
      note: valueOf("drawingNote")
    };
  }

  function applyMeta(meta = {}) {
    setValue("drawingTitle", meta.title || "");
    setValue("drawingProject", meta.project || "");
    setValue("drawingMaterial", meta.material || "");
    setValue("drawingNo", meta.drawingNo || "");
    setValue("drawingNote", meta.note || "");
  }

  function filenameForPdf(meta, now = new Date()) {
    const base = cleanFilenamePart(meta?.drawingNo || meta?.title || DEFAULTS.defaultDrawingTitle, "ISO-ritning");
    return `${base}_${dateStamp(now)}.pdf`;
  }

  window.AppProject = {
    DEFAULTS,
    collectMeta,
    snapshotMeta,
    applyMeta,
    filenameForPdf,
    cleanFilenamePart,
    dateStamp
  };
})();
