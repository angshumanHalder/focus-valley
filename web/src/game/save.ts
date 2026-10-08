import { CYCLE_SECONDS, SEASON_CONTENT, SEASONS } from "./farm.ts";

const DB_NAME = "focus-valley";
const STORE_NAME = "saves";
const SAVE_KEY = "current";
const SAVE_VERSION = 1;
const DB_VERSION = 2;
const crops = new Set(Object.values(SEASON_CONTENT).flatMap(content => content.crops));
const animals = new Set(Object.values(SEASON_CONTENT).flatMap(content => content.animals));
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const isCount = (value: unknown) => Number.isInteger(value) && (value as number) >= 0;
const isSeconds = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0;
function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = event => {
      const db = request.result;
      const store = db.objectStoreNames.contains(STORE_NAME)
        ? request.transaction!.objectStore(STORE_NAME)
        : db.createObjectStore(STORE_NAME);
      if (event.oldVersion === 1) {
        const previous = store.get(SAVE_KEY);
        previous.onsuccess = () => {
          if (isFarmState(previous.result)) store.put({ version: SAVE_VERSION, farm: previous.result }, SAVE_KEY);
        };
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error ?? new Error("Save transaction failed"));
  });
}

export async function saveFarm(farm: FarmState): Promise<void> {
  const db = await database();
  try {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore(STORE_NAME).put({ version: SAVE_VERSION, farm }, SAVE_KEY);
    await done;
  } finally { db.close(); }
}

export async function loadFarm(): Promise<FarmState | null> {
  const db = await database();
  try {
    const transaction = db.transaction(STORE_NAME);
    const done = transactionDone(transaction);
    const value = await new Promise<unknown>((resolve, reject) => {
      const request = transaction.objectStore(STORE_NAME).get(SAVE_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await done;
    return isRecord(value) && value.version === SAVE_VERSION && isFarmState(value.farm) ? discardOldCropCredit(value.farm) : null;
  } finally { db.close(); }
}

export async function clearFarmSave(): Promise<void> {
  const db = await database();
  try {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore(STORE_NAME).delete(SAVE_KEY);
    await done;
  } finally { db.close(); }
}

export function downloadFarm(farm: FarmState): void {
  const blob = new Blob([JSON.stringify({ version: SAVE_VERSION, farm }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: "focus-valley-save.json" });
  link.click();
  URL.revokeObjectURL(url);
}

export async function readFarmFile(file: File): Promise<FarmState> {
  let data: unknown;
  try { data = JSON.parse(await file.text()); }
  catch { throw new Error("That file is not a valid Focus Valley save."); }
  if (!isRecord(data) || data.version !== SAVE_VERSION || !isFarmState(data.farm))
    throw new Error("That file is not a valid Focus Valley save.");
  return discardOldCropCredit(data.farm);
}

function discardOldCropCredit(farm: FarmState): FarmState {
  const { cropCreditSeconds: _oldCredit, ...current } = farm as FarmState & { cropCreditSeconds?: number };
  return current;
}

function isFarmState(value: unknown): value is FarmState {
  if (!isRecord(value) || typeof value.timeZone !== "string" || !isRecord(value.avatar) || !isRecord(value.progress) ||
    !isRecord(value.farmDay) || !isRecord(value.pens) || !isRecord(value.inventory) || !Array.isArray(value.sessions)) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: value.timeZone }); } catch { return false; }

  if (value.cropCreditSeconds !== undefined && !isSeconds(value.cropCreditSeconds)) return false;
  if (value.bonusRemainderSeconds !== undefined && (!isCount(value.bonusRemainderSeconds) || (value.bonusRemainderSeconds as number) >= 1500 || (value.bonusRemainderSeconds as number) % 60 !== 0)) return false;
  if (value.bonusBankSeconds !== undefined && (!isCount(value.bonusBankSeconds) || (value.bonusBankSeconds as number) > 900 || (value.bonusBankSeconds as number) % 60 !== 0)) return false;
  if (value.breakCycleStart !== undefined && (!isCount(value.breakCycleStart) || (value.breakCycleStart as number) > value.sessions.length)) return false;
  if (value.breakCycleStart !== undefined && value.sessions.length - (value.breakCycleStart as number) > 4) return false;
  const avatar = value.avatar, progress = value.progress, day = value.farmDay;
  if (!( ["black", "brown", "golden"].includes(String(avatar.hair)) && ["light", "brown", "deep"].includes(String(avatar.skin)) &&
    ["tomato", "sunflower", "sage"].includes(String(avatar.shirt)) && ["denim", "cocoa", "charcoal"].includes(String(avatar.pants)))) return false;
  if (!SEASONS.includes(progress.season as Season) || ![progress.activeDaysInSeason, progress.totalActiveDays, progress.seasonHarvests, progress.totalHarvests].every(isCount) ||
    !Number.isInteger(progress.unlockedAreaCount) || (progress.unlockedAreaCount as number) < 1 || (progress.unlockedAreaCount as number) > 4 ||
    !Number.isInteger(progress.nextBedIndex) || (progress.nextBedIndex as number) < 0 || (progress.nextBedIndex as number) >= (progress.unlockedAreaCount as number) * 4 ||
    !Array.isArray(progress.harvestedTiles) || progress.harvestedTiles.length !== 4 ||
    !progress.harvestedTiles.every(row => Array.isArray(row) && row.length === 4 && row.every(item => typeof item === "boolean")) ||
    !Array.isArray(progress.unlockedAnimals) || !progress.unlockedAnimals.every(animal => typeof animal === "string" && animals.has(animal))) return false;
  if (!isDate(day.date) || !isCount(day.completedSessions) || !Array.isArray(day.tiles) || !day.tiles.every(tile =>
    isRecord(tile) && Number.isInteger(tile.areaId) && (tile.areaId as number) >= 0 && (tile.areaId as number) < 4 &&
    Number.isInteger(tile.tileId) && (tile.tileId as number) >= 0 && (tile.tileId as number) < 4 &&
    typeof tile.cropId === "string" && crops.has(tile.cropId) && typeof tile.harvested === "boolean" && isSeconds(tile.focusSeconds) && (tile.focusSeconds as number) <= CYCLE_SECONDS)) return false;
  if (!Object.entries(value.pens).every(([animal, cycle]) => animals.has(animal) && isRecord(cycle) && isSeconds(cycle.focusSeconds) && (cycle.focusSeconds as number) <= CYCLE_SECONDS &&
    (cycle.visibleProduce === undefined || (isCount(cycle.visibleProduce) && (cycle.visibleProduce as number) <= 4)))) return false;
  if (!Object.entries(value.inventory).every(([id, count]) => /^(crop|animal):/.test(id) &&
    ((id.startsWith("crop:") && crops.has(id.slice(5))) || (id.startsWith("animal:") && animals.has(id.slice(7)))) && isCount(count))) return false;

  return value.sessions.every(session => isRecord(session) && typeof session.id === "string" && !!session.id &&
    typeof session.label === "string" && session.label.length > 0 && session.label.length <= 100 && isRecord(session.target) &&
    ((session.target.kind === "crop" && typeof session.target.cropId === "string" && crops.has(session.target.cropId)) ||
      (session.target.kind === "animal" && typeof session.target.animalId === "string" && animals.has(session.target.animalId))) &&
    Number.isSafeInteger(session.startMs) && Number.isSafeInteger(session.endMs) && (session.endMs as number) > (session.startMs as number) &&
    isDate(session.completionDate) && isSeconds(session.focusSeconds) && (session.focusSeconds as number) >= 900 && (session.focusSeconds as number) <= 14400 &&
    isSeconds(session.bonusSeconds) && isRecord(session.focusSecondsByDate) && Object.entries(session.focusSecondsByDate).every(([date, seconds]) => isDate(date) && isSeconds(seconds)));
}
