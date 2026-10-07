const DB_NAME = "focus-valley";
const STORE_NAME = "saves";
const SAVE_KEY = "current";
const SAVE_VERSION = 1;

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveFarm(farm: FarmState): Promise<void> {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(farm, SAVE_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}

export async function loadFarm(): Promise<FarmState | null> {
  const db = await database();
  const value = await new Promise<unknown>((resolve, reject) => {
    const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(SAVE_KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return isFarmState(value) ? value : null;
}

export async function clearFarmSave(): Promise<void> {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(SAVE_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}

export function downloadFarm(farm: FarmState): void {
  const blob = new Blob([JSON.stringify({ version: SAVE_VERSION, farm }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: "focus-valley-save.json" });
  link.click();
  URL.revokeObjectURL(url);
}

export async function readFarmFile(file: File): Promise<FarmState> {
  const data: unknown = JSON.parse(await file.text());
  if (!data || typeof data !== "object" || (data as { version?: unknown }).version !== SAVE_VERSION || !isFarmState((data as { farm?: unknown }).farm))
    throw new Error("That file is not a valid Focus Valley save.");
  return (data as { farm: FarmState }).farm;
}

function isFarmState(value: unknown): value is FarmState {
  if (!value || typeof value !== "object") return false;
  const farm = value as Partial<FarmState>;
  return typeof farm.timeZone === "string" && !!farm.avatar && !!farm.progress && !!farm.farmDay &&
    Array.isArray(farm.sessions) && Array.isArray(farm.farmDay.tiles) &&
    typeof farm.inventory === "object" && farm.inventory !== null && typeof farm.pens === "object" && farm.pens !== null;
}
