import { createFarm, SEASON_CONTENT } from "./farm.ts";
import { farmerPosition } from "./farmWalk.ts";
import { areaOrigin } from "./sceneLayout.ts";

// Visual preview seconds only; never credited to focus progress or the harvest economy.
export function previewGrowth(seconds: number, bedIndex: number) {
  const phase = (Math.max(0, seconds) + bedIndex * 7) % 72;
  return { focusSeconds: Math.min(900, Math.floor(phase / 20) * 300), harvested: phase >= 68 };
}

export function previewProduce(seconds: number, animalIndex: number) {
  const interval = animalIndex === 0 ? 12 : 16;
  return Math.min(3, Math.floor((Math.max(0, seconds) % (interval * 5)) / interval));
}

export function previewFarmer(elapsedMs: number, columns: number) {
  const route = columns === 1 ? [0, 1, 2, 3, 2, 1] : [0, 1, 3, 2];
  const leg = Math.floor(elapsedMs / 24000) % route.length;
  const phase = elapsedMs % 24000;
  if (phase < 16000) return farmerPosition(phase, route[leg], Math.floor(phase / 4000), columns);
  const from = areaOrigin(route[leg], columns);
  const to = areaOrigin(route[(leg + 1) % route.length], columns);
  const progress = (phase - 16000) / 8000;
  const facing = to.x > from.x ? "right" : to.x < from.x ? "left" : to.y > from.y ? "down" : "up";
  return { x: from.x + 192 + (to.x - from.x) * progress, y: from.y + 192 + (to.y - from.y) * progress, facing, walking: true } as const;
}

// Isolated visual state; switching seasons never changes a guest farm.
export function createPreviewFarm(season: Season): FarmState {
  const farm = createFarm(Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone);
  farm.progress.season = season;
  farm.progress.unlockedAreaCount = 4;
  farm.progress.unlockedAnimals = [...SEASON_CONTENT[season].animals];
  farm.farmDay.tiles = Array.from({ length: 16 }, (_, index) => ({
    areaId: Math.floor(index / 4), tileId: index % 4,
    cropId: SEASON_CONTENT[season].crops[Math.floor(index / 4)], focusSeconds: (index % 4) * 300, harvested: false,
  }));
  return farm;
}
