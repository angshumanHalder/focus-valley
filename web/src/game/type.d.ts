type FarmTile = {
  areaId: number;
  tileId: number;
  cropId: string;
  focusSeconds: number;
  harvested: boolean;
};

type FarmDay = {
  date: string;
  tiles: FarmTile[];
  focusCreditSeconds: number;
  completedSessions: number;
};

type FarmState = {
  timeZone: string;
  progress: {
    season: Season;
    activeDaysInSeason: number;
    totalActiveDays: number;
    seasonHarvests: number;
    totalHarvests: number;
    unlockedAreaCount: number;
    harvestedTiles: boolean[][];
    unlockedAnimals: string[];
    trees: Record<number, string>;
  };
  farmDay: FarmDay;
};

type FarmTransition = { farm: FarmState; closedDays: FarmDay[] };
type RunningInterval = { startMs: number; endMs: number };
type Season = (typeof SEASONS)[number];
