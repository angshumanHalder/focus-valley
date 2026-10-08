import { ANIMAL_SHEETS, ROSTERS, GROWTH_SHEETS } from "../game/spriteAssets";
import { SEASONAL_FRAMES } from "../game/seasonalFrames";
import { CROP_GROWTH_FRAMES } from "../game/cropGrowthFrames";
import { SEASONS, SEASON_CONTENT } from "../game/farm";

export function ItemSprite({ item, animal = false }: { item: string; animal?: boolean }) {
  const season = SEASONS.find(s => SEASON_CONTENT[s][animal ? "animals" : "crops"].includes(item));
  if (!season) return null;
  const index = SEASON_CONTENT[season][animal ? "animals" : "crops"].indexOf(item);
  const url = animal ? ANIMAL_SHEETS[item as keyof typeof ANIMAL_SHEETS] ?? ROSTERS[season as keyof typeof ROSTERS] : GROWTH_SHEETS[season];
  const viewBox = animal ? season === "spring" ? "100 55 430 580" : SEASONAL_FRAMES[season].animals[index][0].join(" ") : CROP_GROWTH_FRAMES[season][index][3].join(" ");
  const width = animal ? season === "spring" ? 2172 : season === "rainy" ? 1402 : 1536 : { spring: 2020, summer: 2022, rainy: 2115, autumn: 2022, winter: 2073 }[season];
  const height = animal ? season === "spring" ? 724 : season === "rainy" ? 1122 : 1024 : { spring: 779, summer: 778, rainy: 744, autumn: 778, winter: 758 }[season];
  return <svg className="item-sprite" viewBox={viewBox} aria-hidden="true" focusable="false"><image href={url} width={width} height={height} /></svg>;
}
