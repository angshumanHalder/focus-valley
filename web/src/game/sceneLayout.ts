export const AREA_SIZE = 384;
export const AREA_STEP = 416;

export function areaOrigin(areaId: number, columns: number) {
  return { x: (areaId % columns) * AREA_STEP, y: Math.floor(areaId / columns) * AREA_STEP };
}

export function frameAreas(availableWidth: number, unlocked: number, viewportWidth: number, animalCount = 0) {
  const columns = viewportWidth < 768 ? 1 : Math.min(2, unlocked + animalCount);
  const rows = Math.ceil((unlocked + animalCount) / columns);
  const worldWidth = columns * AREA_SIZE + (columns - 1) * 32;
  const worldHeight = rows * AREA_SIZE + (rows - 1) * 32;
  const zoom = Math.min(1, availableWidth / worldWidth);
  return {
    columns,
    rows,
    zoom,
    width: Math.floor(worldWidth * zoom),
    height: Math.floor(worldHeight * zoom),
  };
}
