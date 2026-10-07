export const AREA_SIZE = 384;
export const AREA_STEP = 416;

export function areaOrigin(areaId: number, columns: number) {
  return { x: (areaId % columns) * AREA_STEP, y: Math.floor(areaId / columns) * AREA_STEP };
}

export function frameAreas(availableWidth: number, unlocked: number, viewportWidth: number, animalCount = 0, viewportHeight = 0) {
  const columns = viewportWidth < 768 ? 1 : Math.min(2, unlocked + animalCount);
  const sidePens = viewportWidth >= 1120 && animalCount > 0;
  const rows = sidePens ? Math.max(Math.ceil(unlocked / columns), animalCount) : Math.ceil((unlocked + animalCount) / columns);
  const worldWidth = (columns + Number(sidePens)) * AREA_STEP - 32;
  const worldHeight = rows * AREA_STEP - 32;
  const padding = viewportWidth < 768 ? 16 : 48;
  const zoom = Math.max(.1, Math.min(1.75, (availableWidth - padding * 2) / worldWidth,
    viewportWidth >= 1120 && viewportHeight > 0 ? (viewportHeight - padding * 2) / worldHeight : Infinity));
  const height = Math.max(viewportHeight, Math.ceil(worldHeight * zoom + padding * 2));
  const inset = (availableWidth - worldWidth * zoom) / 2;
  const topInset = (height - worldHeight * zoom) / 2;
  return {
    columns,
    rows,
    sidePens,
    zoom,
    inset,
    topInset,
    width: Math.floor(availableWidth),
    height,
  };
}

export function penOrigin(index: number, unlocked: number, frame: ReturnType<typeof frameAreas>) {
  return frame.sidePens ? { x: frame.columns * AREA_STEP, y: index * AREA_STEP } : areaOrigin(unlocked + index, frame.columns);
}
