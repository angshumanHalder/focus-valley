import { dateFormatter, dateInZone } from "../utils/date.ts";
import { ANIMAL_PRODUCTS } from "./seasonalFrames.ts";

export const SEASONS = [
  "spring",
  "summer",
  "rainy",
  "autumn",
  "winter",
] as const;

export const SEASON_CONTENT: Record<
  Season,
  {
    crops: readonly string[];
    animals: readonly string[];
  }
> = {
  spring: {
    crops: ["strawberry", "peas", "radish", "tulip"],
    animals: ["chicken", "rabbit"],
  },
  summer: {
    crops: ["tomato", "corn", "pepper", "sunflower"],
    animals: ["cow", "goat"],
  },
  rainy: {
    crops: ["rice", "okra", "eggplant", "bottle-gourd"],
    animals: ["duck", "water-buffalo"],
  },
  autumn: {
    crops: ["pumpkin", "carrot", "sweet-potato", "marigold"],
    animals: ["alpaca", "turkey"],
  },
  winter: {
    crops: ["cabbage", "cauliflower", "spinach", "wheat"],
    animals: ["sheep", "yak"],
  },
};

export const CYCLE_SECONDS = 15 * 60;
export const INVENTORY_ITEMS = SEASONS.flatMap(season => [
  ...SEASON_CONTENT[season].crops.map(source => ({ id: `crop:${source}`, source, season, kind: "crop" as const, name: source.replaceAll("-", " ") })),
  ...SEASON_CONTENT[season].animals.map(source => ({ id: `animal:${source}`, source, season, kind: "animal" as const, name: `${source.replaceAll("-", " ")} ${ANIMAL_PRODUCTS[source]}` })),
]);
const roundSeconds = (seconds: number) => Math.round(seconds * 1000) / 1000;
export const bonusSeconds = (seconds: number) => Math.floor(seconds / 3000) * 600;

export function createFarm(nowMs: number, timeZone: string): FarmState {
  return {
    timeZone,
    avatar: { hair: "brown", skin: "brown", shirt: "tomato", pants: "denim" },
    progress: { season: "spring", activeDaysInSeason: 0, totalActiveDays: 0, seasonHarvests: 0,
      totalHarvests: 0, unlockedAreaCount: 1, nextBedIndex: 0,
      harvestedTiles: Array.from({ length: 4 }, () => [false, false, false, false]), unlockedAnimals: [] },
    farmDay: { date: dateInZone(nowMs, dateFormatter(timeZone)), tiles: [], completedSessions: 0 },
    pens: {}, inventory: {}, sessions: [],
  };
}

function advanceDate(farm: FarmState, date: string): FarmState {
  if (date < farm.farmDay.date) throw new RangeError("Cannot move a farm day backwards");
  if (date === farm.farmDay.date) return farm;
  const changeSeason = farm.progress.activeDaysInSeason >= 7;
  return { ...farm,
    progress: changeSeason ? { ...farm.progress, season: SEASONS[(SEASONS.indexOf(farm.progress.season) + 1) % SEASONS.length], activeDaysInSeason: 0, seasonHarvests: 0 } : farm.progress,
    farmDay: { ...farm.farmDay, date, completedSessions: 0 },
  };
}

export function openFarmDay(farm: FarmState, nowMs: number): FarmState {
  return advanceDate(farm, dateInZone(nowMs, dateFormatter(farm.timeZone)));
}

export function activeBed(farm: FarmState) {
  const index = farm.progress.nextBedIndex;
  return { areaId: Math.floor(index / 4), tileId: index % 4 };
}

export function bedState(farm: FarmState, areaId: number, tileId: number): "active" | "completed" | "locked" {
  const active = activeBed(farm);
  if (active.areaId === areaId && active.tileId === tileId) return "active";
  return farm.farmDay.tiles.some(t => t.areaId === areaId && t.tileId === tileId && t.harvested) ? "completed" : "locked";
}

export function growthStage(tile: Pick<FarmTile, "focusSeconds">): number {
  return Math.min(3, Math.floor(tile.focusSeconds / 300));
}

function validateTarget(farm: FarmState, target: FocusTarget) {
  if (target.kind === "crop") {
    // A crop already planted before a season boundary may still be finished.
    const bed = activeBed(farm);
    const partial = farm.farmDay.tiles.find(t => t.areaId === bed.areaId && t.tileId === bed.tileId && !t.harvested);
    if (!SEASON_CONTENT[farm.progress.season].crops.includes(target.cropId) && partial?.cropId !== target.cropId)
      throw new RangeError("Crop is not available this season");
  } else if (target.kind !== "animal" || !SEASON_CONTENT[farm.progress.season].animals.includes(target.animalId) || !farm.progress.unlockedAnimals.includes(target.animalId)) {
    throw new RangeError("Select an unlocked animal pen available this season");
  }
}

function cropCycle(farm: FarmState, cropId: string): FarmTile {
  const bed = activeBed(farm);
  const index = farm.farmDay.tiles.findIndex(t => t.areaId === bed.areaId && t.tileId === bed.tileId);
  const previous = farm.farmDay.tiles[index];
  if (previous && !previous.harvested) return previous;
  const tile: FarmTile = { ...bed, cropId, focusSeconds: 0, harvested: false };
  if (index < 0) farm.farmDay.tiles.push(tile);
  else farm.farmDay.tiles[index] = tile;
  return tile;
}

// Mutates only a cloned state shared by completion and disposable live previews.
function applyGrowth(farm: FarmState, target: FocusTarget, seconds: number, commit: boolean) {
  while (seconds > 0) {
    const tile = target.kind === "crop" ? cropCycle(farm, target.cropId) : null;
    const cycle = tile ?? (farm.pens[(target as { animalId: string }).animalId] ??= { focusSeconds: 0 });
    const itemId = tile ? `crop:${tile.cropId}` : `animal:${(target as { animalId: string }).animalId}`;
    const used = roundSeconds(Math.min(seconds, CYCLE_SECONDS - cycle.focusSeconds));
    cycle.focusSeconds = roundSeconds(cycle.focusSeconds + used);
    seconds = roundSeconds(seconds - used);
    if (cycle.focusSeconds < CYCLE_SECONDS) continue;
    if (commit) farm.inventory[itemId] = (farm.inventory[itemId] ?? 0) + 4;
    if (tile) {
      tile.harvested = true;
      const p = farm.progress;
      p.totalHarvests++;
      p.harvestedTiles[tile.areaId][tile.tileId] = true;
      if (tile.areaId === p.unlockedAreaCount - 1 && p.unlockedAreaCount < 4 && p.harvestedTiles[tile.areaId].every(Boolean)) p.unlockedAreaCount++;
      if (SEASON_CONTENT[p.season].crops.includes(tile.cropId)) {
        p.seasonHarvests++;
        SEASON_CONTENT[p.season].animals.forEach((animal, index) => {
          if (p.seasonHarvests >= (index + 1) * 4 && !p.unlockedAnimals.includes(animal)) p.unlockedAnimals.push(animal);
        });
      }
      p.nextBedIndex = (p.nextBedIndex + 1) % (p.unlockedAreaCount * 4);
    } else {
      cycle.focusSeconds = 0;
    }
  }
}

function splitInterval(
  interval: RunningInterval,
  formatter: Intl.DateTimeFormat,
): { date: string; seconds: number }[] {
  const pieces: { date: string; seconds: number }[] = [];
  let start = interval.startMs;
  while (start < interval.endMs) {
    const date = dateInZone(start, formatter);
    let end = interval.endMs;
    if (dateInZone(end - 1, formatter) !== date) {
      let low = start + 1;
      let high = end;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (dateInZone(middle, formatter) === date) low = middle + 1;
        else high = middle;
      }
      end = low;
    }
    pieces.push({ date, seconds: (end - start) / 1000 });
    start = end;
  }
  return pieces;
}


export function previewFocus(farm: FarmState, target: FocusTarget | null, intervals: readonly RunningInterval[]): FarmState {
  if (!target || !intervals.length) return farm;
  const seconds = intervals.reduce((sum, i) => sum + Math.max(0, i.endMs - i.startMs) / 1000, 0);
  const preview = structuredClone(farm);
  applyGrowth(preview, target, seconds, false);
  return preview;
}

export function completeFocus(farm: FarmState, focus: { id: string; label: string; durationMs: number; target: FocusTarget | null; intervals: readonly RunningInterval[] }): FarmState {
  const existing = farm.sessions.find(s => s.id === focus.id);
  if (existing) {
    if (existing.label !== focus.label.trim() || existing.focusSeconds * 1000 !== focus.durationMs || JSON.stringify(existing.target) !== JSON.stringify(focus.target)) throw new Error("Session ID already used");
    return farm;
  }
  if (!focus.id || !focus.label.trim() || focus.label.trim().length > 100 || !focus.target || !focus.intervals.length) throw new RangeError("A completed task needs an ID, label, target and running time");
  validateTarget(farm, focus.target);
  const formatter = dateFormatter(farm.timeZone);
  let previousEnd = -Infinity;
  const pieces: { date: string; seconds: number }[] = [];
  for (const interval of focus.intervals) {
    if (!Number.isSafeInteger(interval.startMs) || !Number.isSafeInteger(interval.endMs) || interval.startMs < previousEnd || interval.endMs <= interval.startMs) throw new RangeError("Running intervals must be ordered and non-overlapping");
    previousEnd = interval.endMs;
    pieces.push(...splitInterval(interval, formatter));
  }
  const seconds = roundSeconds(pieces.reduce((sum, p) => sum + p.seconds, 0));
  if (!Number.isInteger(focus.durationMs / 60000) || seconds < 900 || seconds > 14400 || Math.abs(seconds * 1000 - focus.durationMs) > .01) throw new RangeError("Complete a 15–240 minute focus timer");
  const startMs = focus.intervals[0].startMs;
  if (farm.sessions.some(s => startMs < s.endMs)) throw new RangeError("Focus sessions cannot overlap");
  let next = structuredClone(farm);
  const session: FocusSession = { id: focus.id, label: focus.label.trim(), target: { ...focus.target }, startMs, endMs: previousEnd,
    completionDate: dateInZone(previousEnd, formatter), focusSeconds: seconds, bonusSeconds: bonusSeconds(seconds), focusSecondsByDate: {} };
  for (const piece of pieces) {
    next = advanceDate(next, piece.date);
    session.focusSecondsByDate[piece.date] = roundSeconds((session.focusSecondsByDate[piece.date] ?? 0) + piece.seconds);
    applyGrowth(next, focus.target, piece.seconds, true);
  }
  next = advanceDate(next, session.completionDate);
  applyGrowth(next, focus.target, session.bonusSeconds, true);
  if (next.farmDay.completedSessions === 0) {
    next.progress.activeDaysInSeason++;
    next.progress.totalActiveDays++;
  }
  next.farmDay.completedSessions++;
  next.sessions.push(session);
  return next;
}
