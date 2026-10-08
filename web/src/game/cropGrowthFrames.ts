import { SEASONS, SEASON_CONTENT } from "./farm.ts";

type Rect = readonly [x: number, y: number, width: number, height: number];

// Rows follow SEASON_CONTENT crops; columns are planted / 5 / 10 / 15 minutes.
// Approved source cuts and positioning are shared by previews and gameplay.
export const CROP_GROWTH_FRAMES: Record<Season, readonly (readonly Rect[])[]> = {
  spring: [
    [[47,148,30,36], [541,58,150,135], [1165,29,171,165], [1838,22,174,172]],
    [[47,355,32,33], [553,239,118,154], [1177,218,146,189], [1844,211,151,185]],
    [[49,543,27,34], [546,450,139,130], [1182,407,152,174], [1834,407,170,184]],
    [[37,700,49,64], [588,642,84,123], [1189,614,133,152], [1833,591,174,175]],
  ],
  summer: [
    [[50,161,24,21], [506,76,144,121], [1099,44,152,155], [1842,40,164,158]],
    [[48,343,29,34], [513,251,119,140], [1099,216,152,178], [1842,216,165,179]],
    [[50,524,24,24], [504,445,149,122], [1097,431,154,137], [1842,421,163,171]],
    [[47,695,30,38], [504,623,132,129], [1097,602,154,150], [1854,592,148,161]],
  ],
  rainy: [
    [[70,151,36,25], [635,67,120,118], [1328,34,188,153], [1908,14,189,185]],
    [[74,328,27,27], [603,239,171,123], [1322,217,194,150], [1900,199,206,190]],
    [[74,509,27,28], [603,412,166,141], [1324,393,192,161], [1900,389,201,166]],
    [[16,568,129,144], [602,573,170,141], [1320,573,196,141], [1900,568,204,146]],
  ],
  autumn: [
    [[33,132,31,48], [434,81,110,104], [987,42,137,145], [1834,16,177,189]],
    [[32,310,33,56], [420,252,131,119], [979,226,161,154], [1837,205,168,192]],
    [[32,503,32,51], [425,439,121,122], [979,415,157,151], [1823,416,188,167]],
    [[32,691,33,52], [430,634,109,115], [985,613,155,140], [1836,600,171,162]],
  ],
  winter: [
    [[34,115,29,31], [546,59,132,120], [1165,29,175,150], [1858,14,201,166]],
    [[34,295,29,31], [545,235,135,125], [1165,209,175,152], [1858,195,201,167]],
    [[34,488,29,31], [536,414,144,134], [1165,387,175,161], [1858,375,202,173]],
    [[34,677,34,34], [563,612,96,125], [1208,566,114,172], [1876,552,181,187]],
  ],
};

export function cropSprite(crop: string, stage: number, leftmost: boolean) {
  const season = SEASONS.find(value => SEASON_CONTENT[value].crops.includes(crop));
  if (!season) throw new Error(`Unknown crop: ${crop}`);
  const mature = CROP_GROWTH_FRAMES[season][SEASON_CONTENT[season].crops.indexOf(crop)][3];
  let offsetY = 0, offsetX = 0;
  if (stage === 0) offsetY = season === "autumn" ? -8 : -10;
  if (stage === 1) {
    if (["rice", "okra", "pumpkin", "carrot", "cabbage", "cauliflower"].includes(crop)) offsetY = -5;
    if (leftmost && (season === "spring" || season === "summer"))
      offsetX = ["strawberry", "peas", "corn"].includes(crop) ? -2 : -1;
  }
  return { texture: `growth-${season}`, frame: `${crop}-${stage}`, scale: 26 / Math.max(mature[2], mature[3]), offsetX, offsetY };
}
