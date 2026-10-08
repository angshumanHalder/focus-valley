import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { FarmScene, type Bed } from "../game/FarmScene.ts";
import { frameAreas } from "../game/sceneLayout.ts";

type Props = {
  farm: FarmState;
  active: Bed | null;
  autoplay?: boolean;
  running?: boolean;
  activeAnimal?: string | null;
};

export function FarmCanvas({ farm, active, autoplay = false, running = false, activeAnimal = null }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<FarmScene>(null);
  const [availableWidth, setAvailableWidth] = useState(window.innerWidth);
  const [viewportSize, setViewportSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const frame = frameAreas(availableWidth, 4, viewportSize.width, 2, viewportSize.height);

  useLayoutEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(entries => setAvailableWidth(entries[0].contentRect.width));
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const resized = () => setViewportSize({ width: window.innerWidth, height: window.innerHeight });
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
    const farmScene = new FarmScene(farm);
    scene.current = farmScene;
    const game = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: host.current,
      width: frame.width,
      height: frame.height,
      pixelArt: true,
      roundPixels: true,
      transparent: true,
      input: { touch: { capture: false } },
      scene: farmScene,
    });
    return () => {
      scene.current = null;
      game.destroy(true);
    };
  }, []);

  useEffect(() => {
    scene.current?.sync(farm, active, frame, reducedMotion, autoplay, running, activeAnimal);
  }, [farm, active?.areaId, active?.tileId, frame.columns, frame.rows, frame.zoom, frame.inset, frame.topInset, frame.width, frame.height, frame.sidePens, reducedMotion, autoplay, running, activeAnimal]);

  return (
    <>
      <div className="farm-canvas" ref={host} tabIndex={autoplay ? -1 : 0} role="region" aria-label={`Farm. ${farm.progress.unlockedAreaCount} areas unlocked. ${running ? "Focus is running; movement is automatic." : "Arrow keys or click a path to move."}`}
        onBlur={() => scene.current?.clearKeys()}
        onKeyDown={event => {
          const direction = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" } as const;
          if (event.key in direction && !autoplay) {
            event.preventDefault();
            scene.current?.pressDirection(direction[event.key as keyof typeof direction]);
          }
        }}
        onKeyUp={event => { if (event.key.startsWith("Arrow")) scene.current?.clearKeys(); }} />
    </>
  );
}
