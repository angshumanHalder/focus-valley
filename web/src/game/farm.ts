import { dateFormatter, dateInZone } from "../utils/date.ts";

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
    trees: readonly string[];
  }
> = {
  spring: {
    crops: ["strawberry", "peas", "radish", "tulip"],
    animals: ["chicken", "rabbit"],
    trees: ["apple", "peach", "cherry"],
  },
  summer: {
    crops: ["tomato", "corn", "pepper", "sunflower"],
    animals: ["cow", "goat"],
    trees: ["mango", "lemon", "coconut"],
  },
  rainy: {
    crops: ["rice", "okra", "eggplant", "bottle-gourd"],
    animals: ["duck", "water-buffalo"],
    trees: ["guava", "jackfruit", "jamun"],
  },
  autumn: {
    crops: ["pumpkin", "carrot", "sweet-potato", "marigold"],
    animals: ["pig", "turkey"],
    trees: ["maple", "pear", "persimmon"],
  },
  winter: {
    crops: ["cabbage", "cauliflower", "spinach", "wheat"],
    animals: ["sheep", "yak"],
    trees: ["pine", "fir", "cedar"],
  },
};

const roundSeconds = (seconds: number) => Math.round(seconds * 1000) / 1000;

export function createFarm(nowMs: number, timeZone: string): FarmState {
  const date = dateInZone(nowMs, dateFormatter(timeZone));
  return {
    timeZone,
    progress: {
      season: "spring",
      activeDaysInSeason: 0,
      totalActiveDays: 0,
      seasonHarvests: 0,
      totalHarvests: 0,
      unlockedAreaCount: 1,
      harvestedTiles: Array.from({ length: 4 }, () => [
        false,
        false,
        false,
        false,
      ]),
      unlockedAnimals: [],
      trees: {},
    },
    farmDay: { date, tiles: [], focusCreditSeconds: 0, completedSessions: 0 },
  };
}

function advanceToDate(farm: FarmState, date: string): FarmTransition {
  if (date < farm.farmDay.date)
    throw new RangeError("Cannot move a farm day backwards");
  if (date === farm.farmDay.date) return { farm, closedDays: [] };

  let activeDaysInSeason = farm.progress.activeDaysInSeason;
  let season = farm.progress.season;
  let seasonHarvests = farm.progress.seasonHarvests;
  if (farm.farmDay.completedSessions > 0 && activeDaysInSeason === 7) {
    season = SEASONS[(SEASONS.indexOf(season) + 1) % SEASONS.length];
    activeDaysInSeason = 0;
    seasonHarvests = 0;
  }

  return {
    farm: {
      ...farm,
      progress: {
        ...farm.progress,
        season,
        seasonHarvests,
        activeDaysInSeason,
      },
      farmDay: { date, tiles: [], focusCreditSeconds: 0, completedSessions: 0 },
    },
    closedDays: [farm.farmDay],
  };
}

export function openFarmDay(farm: FarmState, nowMs: number): FarmTransition {
  return advanceToDate(farm, dateInZone(nowMs, dateFormatter(farm.timeZone)));
}

export function activeBed(farm: FarmState): { areaId: number; tileId: number } | null {
  for (let areaId = 0; areaId < farm.progress.unlockedAreaCount; areaId++)
    for (let tileId = 0; tileId < 4; tileId++)
      if (!farm.farmDay.tiles.some(tile => tile.areaId === areaId && tile.tileId === tileId && tile.harvested))
        return { areaId, tileId };
  return null;
}

export function bedState(farm: FarmState, areaId: number, tileId: number): "active" | "completed" | "locked" {
  if (farm.farmDay.tiles.some(tile => tile.areaId === areaId && tile.tileId === tileId && tile.harvested)) return "completed";
  const active = activeBed(farm);
  return active?.areaId === areaId && active.tileId === tileId ? "active" : "locked";
}

function checkTile(farm: FarmState, areaId: number, tileId: number): void {
  if (
    !Number.isInteger(areaId) ||
    areaId < 0 ||
    areaId >= farm.progress.unlockedAreaCount ||
    !Number.isInteger(tileId) ||
    tileId < 0 ||
    tileId > 3
  ) {
    throw new RangeError("Tile is not unlocked");
  }
  const next = activeBed(farm);
  if (next?.areaId !== areaId || next.tileId !== tileId)
    throw new RangeError("Use the next crop bed in order");
}

export function plantCrop(
  farm: FarmState,
  areaId: number,
  tileId: number,
  cropId: string,
): FarmState {
  checkTile(farm, areaId, tileId);
  if (!SEASON_CONTENT[farm.progress.season].crops.includes(cropId))
    throw new RangeError("Crop is not available this season");
  if (
    farm.farmDay.tiles.some(
      (tile) => tile.areaId === areaId && tile.tileId === tileId,
    )
  )
    throw new Error("Tile is already planted");
  return {
    ...farm,
    farmDay: {
      ...farm.farmDay,
      tiles: [
        ...farm.farmDay.tiles,
        { areaId, tileId, cropId, focusSeconds: 0, harvested: false },
      ],
    },
  };
}

export function growthStage(tile: FarmTile): number {
  return Math.min(12, Math.floor(tile.focusSeconds / 300));
}

function growTile(
  farm: FarmState,
  areaId: number,
  tileId: number,
  seconds: number,
): { farm: FarmState; usedSeconds: number } {
  checkTile(farm, areaId, tileId);
  const tileIndex = farm.farmDay.tiles.findIndex(
    (tile) => tile.areaId === areaId && tile.tileId === tileId,
  );
  if (tileIndex < 0 || farm.farmDay.tiles[tileIndex].harvested)
    throw new Error("Plant the current crop bed first");
  const tile = farm.farmDay.tiles[tileIndex];
  const usedSeconds = roundSeconds(Math.min(seconds, 3600 - tile.focusSeconds));
  const focusSeconds = roundSeconds(tile.focusSeconds + usedSeconds);
  const harvested = focusSeconds >= 3600;
  const tiles = farm.farmDay.tiles.map((entry, index) =>
    index === tileIndex ? { ...entry, focusSeconds, harvested } : entry,
  );
  if (!harvested)
    return {
      farm: { ...farm, farmDay: { ...farm.farmDay, tiles } },
      usedSeconds,
    };

  const harvestedTiles = farm.progress.harvestedTiles.map((flags, index) =>
    index === areaId
      ? flags.map((flag, index) => (index === tileId ? true : flag))
      : flags,
  );
  const unlockedAreaCount =
    areaId === farm.progress.unlockedAreaCount - 1 &&
    harvestedTiles[areaId].every(Boolean) &&
    farm.progress.unlockedAreaCount < 4
      ? farm.progress.unlockedAreaCount + 1
      : farm.progress.unlockedAreaCount;
  const seasonHarvests = farm.progress.seasonHarvests + 1;
  const unlockedAnimals = [...farm.progress.unlockedAnimals];
  const animals = SEASON_CONTENT[farm.progress.season].animals;
  for (const [index, threshold] of [4, 8].entries()) {
    if (
      seasonHarvests >= threshold &&
      !unlockedAnimals.includes(animals[index])
    )
      unlockedAnimals.push(animals[index]);
  }

  return {
    farm: {
      ...farm,
      progress: {
        ...farm.progress,
        harvestedTiles,
        unlockedAreaCount,
        unlockedAnimals,
        seasonHarvests,
        totalHarvests: farm.progress.totalHarvests + 1,
      },
      farmDay: { ...farm.farmDay, tiles },
    },
    usedSeconds,
  };
}

export function assignFocusCredit(
  farm: FarmState,
  areaId: number,
  tileId: number,
): FarmState {
  const credit = farm.farmDay.focusCreditSeconds;
  if (credit <= 0) return farm;
  const result = growTile(farm, areaId, tileId, credit);
  return {
    ...result.farm,
    farmDay: {
      ...result.farm.farmDay,
      focusCreditSeconds: roundSeconds(credit - result.usedSeconds),
    },
  };
}

export function chooseTree(
  farm: FarmState,
  areaId: number,
  treeId: string,
): FarmState {
  if (
    !Number.isInteger(areaId) ||
    areaId < 0 ||
    areaId > 3 ||
    !farm.progress.harvestedTiles[areaId].every(Boolean)
  ) {
    throw new RangeError("Tree spot is locked");
  }
  if (!SEASON_CONTENT[farm.progress.season].trees.includes(treeId))
    throw new RangeError("Tree is not available this season");
  return {
    ...farm,
    progress: {
      ...farm.progress,
      trees: { ...farm.progress.trees, [areaId]: treeId },
    },
  };
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

// Display running growth without harvesting, unlocking, or crediting a session.
export function previewFocus(farm: FarmState, target: { areaId: number; tileId: number } | null, intervals: readonly RunningInterval[]): FarmState {
  if (!target || intervals.length === 0) return farm;
  const formatter = dateFormatter(farm.timeZone);
  const seconds = intervals.flatMap(interval => splitInterval(interval, formatter))
    .filter(piece => piece.date === farm.farmDay.date).reduce((sum, piece) => sum + piece.seconds, 0);
  return { ...farm, farmDay: { ...farm.farmDay, tiles: farm.farmDay.tiles.map(tile =>
    tile.areaId === target.areaId && tile.tileId === target.tileId && !tile.harvested
      ? { ...tile, focusSeconds: Math.min(3599, tile.focusSeconds + seconds) } : tile,
  ) } };
}

export function completeFocus(
  farm: FarmState,
  areaId: number,
  tileId: number,
  intervals: readonly RunningInterval[],
): FarmTransition & { focusSecondsByDate: Record<string, number> } {
  if (intervals.length === 0)
    throw new RangeError("A completed focus timer needs running time");
  const formatter = dateFormatter(farm.timeZone);
  const targetDate = farm.farmDay.date;
  checkTile(farm, areaId, tileId);
  const currentTile = farm.farmDay.tiles.find(
    (tile) => tile.areaId === areaId && tile.tileId === tileId,
  );
  if (!currentTile || currentTile.harvested)
    throw new Error("Plant the current crop bed first");
  const focusSecondsByDate: Record<string, number> = {};
  const closedDays: FarmDay[] = [];
  let previousEnd = -Infinity;

  for (const interval of intervals) {
    if (
      !Number.isSafeInteger(interval.startMs) ||
      !Number.isSafeInteger(interval.endMs) ||
      interval.startMs < previousEnd ||
      interval.endMs <= interval.startMs
    ) {
      throw new RangeError(
        "Running intervals must be ordered and non-overlapping",
      );
    }
    previousEnd = interval.endMs;
    for (const piece of splitInterval(interval, formatter)) {
      const transition = advanceToDate(farm, piece.date);
      farm = transition.farm;
      closedDays.push(...transition.closedDays);
      focusSecondsByDate[piece.date] = roundSeconds(
        (focusSecondsByDate[piece.date] ?? 0) + piece.seconds,
      );
      if (piece.date === targetDate) {
        const tile = farm.farmDay.tiles.find(
          (tile) => tile.areaId === areaId && tile.tileId === tileId,
        );
        if (tile && !tile.harvested)
          farm = growTile(farm, areaId, tileId, piece.seconds).farm;
      } else
        farm = {
          ...farm,
          farmDay: {
            ...farm.farmDay,
            focusCreditSeconds: roundSeconds(farm.farmDay.focusCreditSeconds + piece.seconds),
          },
        };
    }
  }

  const completionDate = dateInZone(previousEnd, formatter);
  const transition = advanceToDate(farm, completionDate);
  farm = transition.farm;
  closedDays.push(...transition.closedDays);
  const firstSessionToday = farm.farmDay.completedSessions === 0;
  return {
    farm: {
      ...farm,
      progress: firstSessionToday
        ? {
            ...farm.progress,
            activeDaysInSeason: farm.progress.activeDaysInSeason + 1,
            totalActiveDays: farm.progress.totalActiveDays + 1,
          }
        : farm.progress,
      farmDay: {
        ...farm.farmDay,
        completedSessions: farm.farmDay.completedSessions + 1,
      },
    },
    closedDays,
    focusSecondsByDate,
  };
}
