import { CROP_SHEETS, ANIMAL_SHEETS, ROSTERS } from "../game/spriteAssets";
import { SEASONAL_FRAMES } from "../game/seasonalFrames";
import { SEASONS, SEASON_CONTENT } from "../game/farm";

export function ItemSprite({ item, animal = false }: { item: string; animal?: boolean }) {
  const sheets: Record<string, string> = animal ? ANIMAL_SHEETS : CROP_SHEETS;
  let url = sheets[item];
  let viewBox = animal ? "100 55 430 580" : item === "tulip" ? "1390 500 256 320" : "1410 500 256 320";
  let width = animal ? 2172 : 1660, height = animal ? 724 : 949;
  if (!url) {
    const season = SEASONS.find(s => SEASON_CONTENT[s][animal ? "animals" : "crops"].includes(item));
    if (!season || season === "spring") return null;
    const index = SEASON_CONTENT[season][animal ? "animals" : "crops"].indexOf(item);
    viewBox = (animal ? SEASONAL_FRAMES[season].animals[index][0] : SEASONAL_FRAMES[season].crops[index]).join(" ");
    url = ROSTERS[season];
    width = season === "rainy" ? 1402 : 1536; height = season === "rainy" ? 1122 : 1024;
  }
  return <svg className="item-sprite" viewBox={viewBox} aria-hidden="true" focusable="false"><image href={url} width={width} height={height} /></svg>;
}
