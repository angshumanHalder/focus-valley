// Source-sheet rectangles, not equal cells: the generated artwork has uneven spacing.
type Rect = readonly [number, number, number, number];
type RosterFrames = { crops: readonly Rect[]; animals: readonly (readonly Rect[])[] };
export const SEASONAL_FRAMES: Record<"summer" | "rainy" | "autumn" | "winter", RosterFrames> = {
  summer: {
    crops: [[205, 15, 280, 275], [495, 8, 250, 282], [770, 20, 275, 270], [1060, 20, 265, 270]],
    animals: [
      [[205, 290, 225, 205], [465, 290, 295, 205], [775, 290, 300, 205], [1120, 290, 220, 205]],
      [[215, 502, 185, 210], [480, 502, 290, 218], [795, 502, 290, 218], [1130, 502, 195, 210]],
    ],
  },
  rainy: {
    crops: [[5, 15, 340, 310], [350, 15, 345, 310], [700, 15, 345, 310], [1050, 15, 350, 310]],
    animals: [
      [[78, 332, 210, 218], [410, 332, 235, 218], [760, 332, 225, 218], [1120, 332, 240, 218]],
      [[25, 560, 310, 235], [350, 560, 345, 235], [700, 560, 365, 235], [1080, 560, 315, 235]],
    ],
  },
  autumn: {
    crops: [[90, 5, 360, 275], [450, 5, 290, 275], [755, 5, 325, 275], [1090, 5, 330, 275]],
    animals: [
      [[130, 275, 200, 295], [440, 275, 280, 295], [805, 275, 290, 295], [1210, 275, 210, 295]],
      [[95, 572, 260, 245], [455, 572, 285, 245], [810, 572, 280, 245], [1180, 572, 275, 245]],
    ],
  },
  winter: {
    crops: [[135, 5, 300, 245], [485, 5, 280, 245], [800, 5, 300, 245], [1120, 5, 320, 245]],
    animals: [
      [[155, 265, 225, 220], [455, 265, 315, 220], [790, 265, 320, 220], [1170, 265, 245, 220]],
      [[120, 490, 265, 235], [450, 490, 320, 235], [780, 490, 315, 235], [1145, 490, 285, 235]],
    ],
  },
};

export function animalPopulation(animal: string): number {
  return ["chicken", "rabbit", "duck", "turkey"].includes(animal) ? 4 : 2;
}

export const ANIMAL_PRODUCTS: Record<string, "egg" | "wool" | "milk"> = {
  chicken: "egg", rabbit: "wool", cow: "milk", goat: "milk", duck: "egg",
  "water-buffalo": "milk", alpaca: "wool", turkey: "egg", sheep: "wool", yak: "wool",
};
