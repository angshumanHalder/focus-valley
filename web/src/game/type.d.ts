type Season = (typeof import("./farm.ts").SEASONS)[number];
type FocusTarget = { kind: "crop"; cropId: string } | { kind: "animal"; animalId: string };
type FarmerAppearance = { hair: "black" | "brown" | "golden"; skin: "light" | "brown" | "deep"; shirt: "tomato" | "sunflower" | "sage"; pants: "denim" | "cocoa" | "charcoal" };
type RunningInterval = { startMs: number; endMs: number };
type CycleProgress = { focusSeconds: number };
type FarmTile = CycleProgress & {
  areaId: number; tileId: number; cropId: string; harvested: boolean;
};
type FarmDay = { date: string; tiles: FarmTile[]; completedSessions: number };
type FocusSession = {
  id: string; label: string; target: FocusTarget; startMs: number; endMs: number;
  completionDate: string; focusSeconds: number; bonusSeconds: number;
  focusSecondsByDate: Record<string, number>;
};
type FarmState = {
  timeZone: string;
  avatar: FarmerAppearance;
  progress: {
    season: Season; activeDaysInSeason: number; totalActiveDays: number;
    seasonHarvests: number; totalHarvests: number; unlockedAreaCount: number;
    harvestedTiles: boolean[][]; unlockedAnimals: string[]; nextBedIndex: number;
  };
  farmDay: FarmDay;
  pens: Record<string, CycleProgress>;
  inventory: Record<string, number>;
  sessions: FocusSession[];
};
