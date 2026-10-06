import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { FarmScene, type Bed } from "../game/FarmScene.ts";
import { frameAreas } from "../game/sceneLayout.ts";

type Props = {
  farm: FarmState;
  active: Bed | null;
};

export function FarmCanvas({ farm, active }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<FarmScene>(null);
  const [availableWidth, setAvailableWidth] = useState(512);
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const frame = frameAreas(availableWidth, farm.progress.unlockedAreaCount, viewportWidth, farm.progress.unlockedAnimals.length);

  useLayoutEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(entries => setAvailableWidth(entries[0].contentRect.width));
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const resized = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", resized);
    return () => window.removeEventListener("resize", resized);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => setReducedMotion(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);

  useEffect(() => {
    if (!host.current) return;
    const farmScene = new FarmScene();
    scene.current = farmScene;
    const game = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: host.current,
      width: frame.width,
      height: frame.height,
      pixelArt: true,
      roundPixels: true,
      transparent: true,
      scene: farmScene,
    });
    return () => {
      scene.current = null;
      game.destroy(true);
    };
  }, []);

  useEffect(() => {
    scene.current?.sync(farm, active, frame, reducedMotion);
  }, [farm, active?.areaId, active?.tileId, frame.columns, frame.rows, frame.zoom, reducedMotion]);

  return (
    <>
      <div className="farm-canvas" ref={host} role="img" aria-label={`Farm scene showing ${farm.progress.unlockedAreaCount} crop areas and ${farm.progress.unlockedAnimals.length} animal pens`} />
    </>
  );
}
