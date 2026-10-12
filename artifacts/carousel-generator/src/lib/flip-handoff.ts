// Passes finished cover slides from Stylish to Magazine Flip, which opens in its own tab so
// Stylish stays open behind it - the ticked posts and the Schedule button are still right there
// when you come back. The handoff itself travels as a few blobs in a small IndexedDB store
// (shared by every tab on the site), not in memory, since a new tab starts with a blank slate.
export type FlipHandoff = { canvases: HTMLCanvasElement[]; clientName: string; caption?: string; location?: string; title?: string };
type StoredHandoff = { blobs: Blob[]; clientName: string; caption?: string; location?: string; title?: string; position?: number; total?: number };
const QUEUE_KEY = "queue";

const DB_NAME = "stylish-flip-handoff";
const STORE = "handoff";
const KEY = "pending";

function openDb(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

function canvasToBlob(c: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise(resolve => c.toBlob(b => resolve(b), "image/jpeg", 0.85));
}

// Waits for the write to actually land before returning, so a tab opened right after this call
// won't race it and find nothing there yet.
export async function setFlipHandoff(h: FlipHandoff): Promise<void> {
  const blobs = (await Promise.all(h.canvases.map(canvasToBlob))).filter((b): b is Blob => !!b);
  if (!blobs.length) return;
  const db = await openDb();
  if (!db) return;
  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ blobs, clientName: h.clientName, caption: h.caption, location: h.location, title: h.title } as StoredHandoff, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch { resolve(); }
  });
}

// Turns the stored blobs back into ready-to-draw images, keyed by object URL so the caller can
// revoke them once it's done loading.
export async function takeFlipHandoff(): Promise<{ images: HTMLImageElement[]; clientName: string; caption?: string; location?: string; title?: string; position?: number; total?: number; remaining: number } | null> {
  const db = await openDb();
  if (!db) return null;
  let remaining = 0;
  const stored = await new Promise<StoredHandoff | null>(resolve => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.get(KEY);
      req.onsuccess = () => {
        if (req.result) { store.delete(KEY); resolve(req.result as StoredHandoff); return; }
        const q = store.get(QUEUE_KEY);
        q.onsuccess = () => {
          const list = (q.result as StoredHandoff[] | undefined) ?? [];
          const head = list[0] ?? null;
          remaining = Math.max(0, list.length - 1);
          if (list.length > 1) store.put(list.slice(1), QUEUE_KEY); else store.delete(QUEUE_KEY);
          resolve(head);
        };
        q.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  if (!stored || !stored.blobs.length) return null;
  const images = await Promise.all(stored.blobs.map(blob => new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  })));
  return { images, clientName: stored.clientName, caption: stored.caption, location: stored.location, title: stored.title, position: stored.position, total: stored.total, remaining };
}

// Several posts at once: one entry per post, each holding that post's own slides, so every post
// becomes its own Magazine Flip. Magazine Flip opens the first and offers "Next post" for the rest.
export async function setFlipQueue(items: FlipHandoff[]): Promise<void> {
  const stored: StoredHandoff[] = [];
  for (let i = 0; i < items.length; i++) {
    const h = items[i];
    const blobs = (await Promise.all(h.canvases.map(canvasToBlob))).filter((b): b is Blob => !!b);
    if (!blobs.length) continue;
    stored.push({ blobs, clientName: h.clientName, caption: h.caption, location: h.location, title: h.title });
  }
  stored.forEach((x, i) => { x.position = i + 1; x.total = stored.length; });
  if (!stored.length) return;
  const db = await openDb();
  if (!db) return;
  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.objectStore(STORE).put(stored, QUEUE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch { resolve(); }
  });
}
