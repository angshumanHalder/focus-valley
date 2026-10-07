import { areaOrigin, penOrigin, type frameAreas } from "./sceneLayout.ts";

export type PathPoint = { x: number; y: number };
export type Direction = "up" | "down" | "left" | "right";
export type FarmPaths = Map<string, PathPoint>;
const key = ({ x, y }: PathPoint) => `${x},${y}`;
const offsets = { up: [0, -16], down: [0, 16], left: [-16, 0], right: [16, 0] } as const;

export function farmPaths(count: number, frame: ReturnType<typeof frameAreas>, animals: readonly string[], penAnimals: readonly string[] = ["chicken", "rabbit"]): FarmPaths {
  const points: FarmPaths = new Map();
  const line = (x: number, y: number, toX: number, toY: number) => {
    const steps = Math.max(Math.abs(toX - x), Math.abs(toY - y)) / 16;
    for (let i = 0; i <= steps; i++) {
      const point = { x: x + Math.sign(toX - x) * i * 16, y: y + Math.sign(toY - y) * i * 16 };
      points.set(key(point), point);
    }
  };
  for (let area = 0; area < count; area++) {
    const { x, y } = areaOrigin(area, frame.columns);
    line(x + 48, y + 192, x + 336, y + 192);
    line(x + 192, y + 48, x + 192, y + 336);
    for (const bedY of [160, 224]) line(x + 176, y + bedY, x + 208, y + bedY);
    if (area % frame.columns < frame.columns - 1 && area + 1 < count) line(x + 192, y + 192, x + 608, y + 192);
    if (area + frame.columns < count) line(x + 192, y + 192, x + 192, y + 608);
  }
  if (frame.sidePens) penAnimals.forEach((animal, index) => {
    if (!animals.includes(animal) || count < frame.columns) return;
    const { x, y } = penOrigin(index, 4, frame);
    line(x - 224, 192, x + 16, 192);
    line(x + 16, 192, x + 16, y + 192);
    line(x + 16, y + 192, x + 96, y + 192);
  });
  if (!frame.sidePens) penAnimals.forEach((animal, index) => {
    if (!animals.includes(animal)) return;
    const { x, y } = penOrigin(index, 4, frame);
    line(-16, 192, 48, 192);
    line(-16, 192, -16, y + 384);
    line(-16, y + 384, x + 192, y + 384);
    line(x + 192, y + 320, x + 192, y + 384);
  });
  return points;
}

export function nearestPath(point: PathPoint, paths: FarmPaths): PathPoint {
  let nearest = paths.values().next().value ?? { x: 192, y: 192 };
  let distance = Infinity;
  for (const candidate of paths.values()) {
    const d = Math.hypot(candidate.x - point.x, candidate.y - point.y);
    if (d < distance) { nearest = candidate; distance = d; }
  }
  return nearest;
}

export function pathStep(point: PathPoint, direction: Direction, paths: FarmPaths) {
  const [dx, dy] = offsets[direction];
  return paths.get(key({ x: point.x + dx, y: point.y + dy }));
}

export function pathRoute(from: PathPoint, to: PathPoint, paths: FarmPaths): PathPoint[] {
  const start = nearestPath(from, paths), target = nearestPath(to, paths);
  const queue = [start], previous = new Map<string, PathPoint | null>([[key(start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const point = queue[i];
    if (key(point) === key(target)) break;
    for (const direction of Object.keys(offsets) as Direction[]) {
      const next = pathStep(point, direction, paths);
      if (next && !previous.has(key(next))) { previous.set(key(next), point); queue.push(next); }
    }
  }
  if (!previous.has(key(target))) return [];
  const route: PathPoint[] = [];
  for (let point: PathPoint | null = target; point; point = previous.get(key(point)) ?? null) route.unshift(point);
  return route;
}

export function advancePath(from: PathPoint, route: PathPoint[], distance: number) {
  let point = { ...from };
  let facing: Direction = "down";
  let walking = false;
  while (route.length) {
    const target = route[0], dx = target.x - point.x, dy = target.y - point.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) { route.shift(); continue; }
    facing = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? "right" : "left" : dy > 0 ? "down" : "up";
    const step = Math.min(length, distance);
    walking = step > 0;
    point = { x: point.x + dx / length * step, y: point.y + dy / length * step };
    distance -= step;
    if (step === length) route.shift();
    if (distance <= 0) break;
  }
  return { ...point, facing, walking };
}
