import { AREA_SIZE, areaOrigin } from "./sceneLayout.ts";

type Direction = "up" | "down" | "left" | "right";

export function farmerPosition(elapsedMs: number, areaId: number, tileId: number, columns: number) {
  const origin = areaOrigin(areaId, columns);
  const centerX = origin.x + AREA_SIZE / 2;
  const centerY = origin.y + AREA_SIZE / 2;
  const bedY = origin.y + (tileId < 2 ? 160 : 224);
  const bedX = centerX + (tileId % 2 === 0 ? -16 : 16);
  const vertical: Direction = bedY < centerY ? "up" : "down";
  const horizontal: Direction = bedX < centerX ? "left" : "right";
  const opposite = (direction: Direction): Direction => ({ up: "down", down: "up", left: "right", right: "left" } as const)[direction];
  let time = Math.max(0, elapsedMs) % 4000;
  const move = (fromX: number, fromY: number, toX: number, toY: number, duration: number, facing: Direction) => {
    const progress = Math.min(1, time / duration);
    return { x: Math.round(fromX + (toX - fromX) * progress), y: Math.round(fromY + (toY - fromY) * progress), facing, walking: true };
  };
  if (time < 1200) return move(centerX, centerY, centerX, bedY, 1200, vertical);
  time -= 1200;
  if (time < 300) return move(centerX, bedY, bedX, bedY, 300, horizontal);
  time -= 300;
  if (time < 400) return { x: bedX, y: bedY, facing: horizontal, walking: false };
  time -= 400;
  if (time < 300) return move(bedX, bedY, centerX, bedY, 300, opposite(horizontal));
  time -= 300;
  if (time < 1200) return move(centerX, bedY, centerX, centerY, 1200, opposite(vertical));
  return { x: centerX, y: centerY, facing: "down" as Direction, walking: false };
}
