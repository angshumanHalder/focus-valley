import { SEASONS, SEASON_CONTENT } from "./farm.ts";

export function requiredFarmArt(farm: FarmState) {
  const season = farm.progress.season;
  const growthSeasons = new Set<Season>([season]);
  for (const tile of farm.farmDay.tiles) {
    const plantedSeason = SEASONS.find(value => SEASON_CONTENT[value].crops.includes(tile.cropId));
    if (plantedSeason) growthSeasons.add(plantedSeason);
  }
  return {
    season,
    growthSeasons,
    animals: SEASON_CONTENT[season].animals.filter(animal => farm.progress.unlockedAnimals.includes(animal)),
  };
}
