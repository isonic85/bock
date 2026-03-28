(() => {
  const DB_NAME = "rorbockning_ritningsarkiv";
  const DB_VERSION = 1;
  const STORE_NAME = "drawings";

  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
          store.createIndex("name", "name", { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Kunde inte öppna databasen."));
    });

    return dbPromise;
  }

  function txComplete(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Transaktionsfel."));
      tx.onabort = () => reject(tx.error || new Error("Transaktionen avbröts."));
    });
  }

  function makeId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `drawing_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  async function saveDrawing(record) {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    await txComplete(tx);
    return record;
  }

  async function createDrawing({ name, data }) {
    const now = new Date().toISOString();
    const record = {
      id: makeId(),
      name: String(name || "Namnlös ritning").trim() || "Namnlös ritning",
      createdAt: now,
      updatedAt: now,
      data
    };
    return saveDrawing(record);
  }

  async function updateDrawing(id, { name, data }) {
    const existing = await getDrawing(id);
    if (!existing) throw new Error("Ritningen hittades inte.");

    const record = {
      ...existing,
      name: typeof name === "string" ? (name.trim() || existing.name) : existing.name,
      updatedAt: new Date().toISOString(),
      data
    };

    return saveDrawing(record);
  }

  async function renameDrawing(id, name) {
    const existing = await getDrawing(id);
    if (!existing) throw new Error("Ritningen hittades inte.");

    existing.name = String(name || "").trim() || existing.name;
    existing.updatedAt = new Date().toISOString();
    return saveDrawing(existing);
  }

  async function duplicateDrawing(id, newName = "") {
    const existing = await getDrawing(id);
    if (!existing) throw new Error("Ritningen hittades inte.");

    return createDrawing({
      name: newName || `${existing.name} (kopia)`,
      data: structuredCloneSafe(existing.data)
    });
  }

  async function getDrawing(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Kunde inte läsa ritningen."));
    });
  }

  async function listDrawings() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => {
        const items = (request.result || []).sort((a, b) =>
          String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
        );
        resolve(items);
      };
      request.onerror = () => reject(request.error || new Error("Kunde inte läsa arkivet."));
    });
  }

  async function deleteDrawing(id) {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    await txComplete(tx);
  }

  function structuredCloneSafe(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  window.ArchiveStore = {
    openDb,
    createDrawing,
    updateDrawing,
    renameDrawing,
    duplicateDrawing,
    getDrawing,
    listDrawings,
    deleteDrawing
  };
})();