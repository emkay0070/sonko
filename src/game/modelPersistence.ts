import { CharacterAppearance } from '../scene3d/glbAppearance';
import { ChildStyle } from '../scene3d/characters';
import type { ModelSlotId, SurfaceTextureSet } from '../scene3d/ugandanCompoundScene';

export interface PersistedSlotRecord {
  slot: ModelSlotId;
  fileName: string;
  originalName: string;
  sourceKind: 'upload-blob' | 'asset-ref';
  blob?: Blob;
  assetUrl?: string;
  assetFolder?: string;
  assetFileName?: string;
  assetType?: 'model' | 'surface-textures';
  textureSet?: SurfaceTextureSet;
  appearance?: CharacterAppearance;
  bytes: number;
  updatedAt: string;
}

const DB_NAME = 'sonko_models_persistence_v1';
const DB_VERSION = 1;
const STORE_SLOTS = 'slot_models';
const STORE_VFS = 'vfs_blobs';
const BUILTIN_APPEARANCE_KEY = 'sonko_builtin_appearances_v1';

function openPersistenceDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_SLOTS)) {
          db.createObjectStore(STORE_SLOTS, { keyPath: 'slot' });
        }
        if (!db.objectStoreNames.contains(STORE_VFS)) {
          db.createObjectStore(STORE_VFS, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveSlotToIDB(record: PersistedSlotRecord): Promise<void> {
  const db = await openPersistenceDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_SLOTS, 'readwrite');
      tx.objectStore(STORE_SLOTS).put(record);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function updateSlotAppearanceInIDB(
  slot: ModelSlotId,
  appearance: CharacterAppearance
): Promise<void> {
  const db = await openPersistenceDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_SLOTS, 'readwrite');
      const store = tx.objectStore(STORE_SLOTS);
      const getReq = store.get(slot);
      getReq.onsuccess = () => {
        const existing = getReq.result as PersistedSlotRecord | undefined;
        if (existing) {
          store.put({
            ...existing,
            appearance,
            updatedAt: new Date().toISOString(),
          });
        }
      };
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function removeSlotFromIDB(slot: ModelSlotId): Promise<void> {
  const db = await openPersistenceDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_SLOTS, 'readwrite');
      tx.objectStore(STORE_SLOTS).delete(slot);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function getAllPersistedSlotsFromIDB(): Promise<PersistedSlotRecord[]> {
  const db = await openPersistenceDB();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_SLOTS, 'readonly');
      const req = tx.objectStore(STORE_SLOTS).getAll();
      req.onsuccess = () => {
        const items = Array.isArray(req.result) ? (req.result as PersistedSlotRecord[]) : [];
        db.close();
        resolve(items);
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    } catch {
      db.close();
      resolve([]);
    }
  });
}

export async function saveVfsBlobToIDB(key: string, blob: Blob): Promise<void> {
  const db = await openPersistenceDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_VFS, 'readwrite');
      tx.objectStore(STORE_VFS).put({ key, blob, updatedAt: new Date().toISOString() });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function deleteVfsBlobFromIDB(key: string): Promise<void> {
  const db = await openPersistenceDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_VFS, 'readwrite');
      tx.objectStore(STORE_VFS).delete(key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function getAllVfsBlobsFromIDB(): Promise<Record<string, Blob>> {
  const db = await openPersistenceDB();
  if (!db) return {};
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_VFS, 'readonly');
      const req = tx.objectStore(STORE_VFS).getAll();
      req.onsuccess = () => {
        const out: Record<string, Blob> = {};
        const rows = Array.isArray(req.result)
          ? (req.result as Array<{ key?: string; blob?: Blob }>)
          : [];
        for (const row of rows) {
          if (row?.key && row.blob instanceof Blob) {
            out[row.key] = row.blob;
          }
        }
        db.close();
        resolve(out);
      };
      req.onerror = () => {
        db.close();
        resolve({});
      };
    } catch {
      db.close();
      resolve({});
    }
  });
}

export function readBuiltInAppearances(): Partial<Record<ChildStyle, CharacterAppearance>> {
  try {
    const raw = localStorage.getItem(BUILTIN_APPEARANCE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CharacterAppearance>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writeBuiltInAppearance(
  slot: ChildStyle,
  appearance: CharacterAppearance
): void {
  try {
    const current = readBuiltInAppearances();
    current[slot] = appearance;
    localStorage.setItem(BUILTIN_APPEARANCE_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearBuiltInAppearance(slot: ChildStyle): void {
  try {
    const current = readBuiltInAppearances();
    delete current[slot];
    localStorage.setItem(BUILTIN_APPEARANCE_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage quota errors
  }
}
