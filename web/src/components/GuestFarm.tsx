import { useEffect, useMemo, useState } from "react";
import {
  activeBed,
  assignFocusCredit,
  completeFocus,
  createFarm,
  growthStage,
  openFarmDay,
  plantCrop,
  previewFocus,
  SEASON_CONTENT,
} from "../game/farm.ts";
import type { CompletedFocus } from "../reducers/timer";
import { FarmCanvas } from "./FarmCanvas";
import { FocusForm } from "./FocusForm";
import { CROP_SHEETS, ANIMAL_SHEETS } from "../game/FarmScene";

function ItemSprite({
  item,
  animal = false,
}: {
  item: string;
  animal?: boolean;
}) {
  const sheets: Record<string, string> = animal ? ANIMAL_SHEETS : CROP_SHEETS;
  const viewBox = animal
    ? "100 55 430 580"
    : item === "tulip"
      ? "1390 500 256 320"
      : "1410 500 256 320";
  return sheets[item] ? (
    <svg
      className="item-sprite"
      viewBox={viewBox}
      aria-hidden="true"
      focusable="false"
    >
      <image
        href={sheets[item]}
        width={animal ? 2172 : 1660}
        height={animal ? 724 : 949}
      />
    </svg>
  ) : (
    <span className="item-sprite sprite-pending" aria-hidden="true">
      ?
    </span>
  );
}

function rollDay(farm: FarmState, nowMs: number): FarmState {
  return openFarmDay(farm, nowMs).farm;
}

export function GuestFarm({
  onSeasonChange,
  mode,
}: {
  onSeasonChange: (season: Season) => void;
  mode: "guest" | "demo";
}) {
  const [farm, setFarm] = useState(() =>
    createFarm(
      Date.now(),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
  );
  const [cropId, setCropId] = useState("strawberry");
  const [inspectedAnimal, setInspectedAnimal] = useState<string | null>(null);
  const [focusActive, setFocusActive] = useState(false);
  const [focusRunning, setFocusRunning] = useState(false);
  const [previewIntervals, setPreviewIntervals] = useState<RunningInterval[]>(
    [],
  );
  const [timerOpen, setTimerOpen] = useState(false);

  useEffect(() => {
    if (focusActive) return;
    const refresh = () => {
      const nowMs = Date.now();
      setFarm((current) => rollDay(current, nowMs));
    };
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("visibilitychange", refresh);
    };
  }, [focusActive]);

  const crops = SEASON_CONTENT[farm.progress.season].crops;
  const animals = SEASON_CONTENT[farm.progress.season].animals;
  const chosenCrop = crops.includes(cropId) ? cropId : crops[0];
  const currentBed = activeBed(farm);
  const currentTile = farm.farmDay.tiles.find(
    (tile) =>
      tile.areaId === currentBed?.areaId && tile.tileId === currentBed?.tileId,
  );
  const target = currentTile ? currentBed : null;
  const displayFarm = useMemo(
    () => previewFocus(farm, target, previewIntervals),
    [farm, target?.areaId, target?.tileId, previewIntervals],
  );
  const displayTile = displayFarm.farmDay.tiles.find(
    (tile) => tile.areaId === target?.areaId && tile.tileId === target?.tileId,
  );
  useEffect(
    () => onSeasonChange(farm.progress.season),
    [farm.progress.season, onSeasonChange],
  );

  function plant() {
    const nowMs = Date.now();
    setFarm((current) => {
      const rolled = rollDay(current, nowMs);
      const bed = activeBed(rolled);
      if (!bed) return rolled;
      const available = SEASON_CONTENT[rolled.progress.season].crops;
      const planted = plantCrop(
        rolled,
        bed.areaId,
        bed.tileId,
        available.includes(chosenCrop) ? chosenCrop : available[0],
      );
      return planted.farmDay.focusCreditSeconds > 0
        ? assignFocusCredit(planted, bed.areaId, bed.tileId)
        : planted;
    });
  }

  function complete(focus: CompletedFocus) {
    const target = focus.target;
    if (!target) return;
    setFarm((current) => {
      const result = completeFocus(
        current,
        target.areaId,
        target.tileId,
        focus.intervals,
      );
      return result.farm;
    });
  }

  return (
    <>
      <FarmCanvas
        farm={displayFarm}
        active={currentBed}
        running={focusRunning}
      />
      <aside className="game-hud" aria-label="Farm controls">
        <button
          type="button"
          className="hud-toggle"
          aria-expanded={timerOpen}
          aria-controls="farm-tools"
          onClick={() => setTimerOpen((open) => !open)}
        >
          {timerOpen
            ? "Close"
            : focusRunning
              ? "Focus in progress"
              : "Plant & focus"}
        </button>
        <div id="farm-tools" className="hud-content" hidden={!timerOpen}>
          <p className="guest-status">
            {mode === "demo" ? "Google sign-in demo" : "Guest farm"} ·{" "}
            {farm.progress.season} · progress isn’t saved
          </p>
          <section aria-label="Planting controls" className="planting-controls">
            <fieldset className="farm-item-section">
              <legend>Crops</legend>
              <div className="farm-item-row">
                {crops.map((crop) => (
                  <button
                    key={crop}
                    type="button"
                    className="farm-item"
                    aria-pressed={chosenCrop === crop}
                    disabled={focusActive}
                    onClick={() => setCropId(crop)}
                  >
                    <ItemSprite item={crop} />
                    <span>{crop.replaceAll("-", " ")}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="farm-item-section">
              <legend>Animals</legend>
              <div className="farm-item-row">
                {animals.map((animal, index) => {
                  const unlocked =
                    farm.progress.unlockedAnimals.includes(animal);
                  return (
                    <button
                      key={animal}
                      type="button"
                      className="farm-item"
                      aria-pressed={inspectedAnimal === animal}
                      aria-label={`${animal.replaceAll("-", " ")}${unlocked ? " · unlocked" : ` · unlocks after ${(index + 1) * 4} seasonal harvests`}`}
                      onClick={() => setInspectedAnimal(animal)}
                    >
                      <ItemSprite item={animal} animal />
                      <span>{animal.replaceAll("-", " ")}</span>
                      {!unlocked && <small>Locked</small>}
                    </button>
                  );
                })}
              </div>
              {inspectedAnimal && animals.includes(inspectedAnimal) && (
                <p className="animal-detail" role="status">
                  {farm.progress.unlockedAnimals.includes(inspectedAnimal)
                    ? "Unlocked"
                    : `Unlocks after ${(animals.indexOf(inspectedAnimal) + 1) * 4} seasonal harvests.`}
                  {inspectedAnimal === "chicken"
                    ? " Chickens produce eggs."
                    : inspectedAnimal === "rabbit"
                      ? " Angora rabbits provide wool through grooming."
                      : ""}
                </p>
              )}
            </fieldset>
            {displayTile && (
              <p>
                {displayTile.cropId} · stage {growthStage(displayTile)}/12 ·{" "}
                {Math.floor(displayTile.focusSeconds / 60)} / 60 focus min
              </p>
            )}
            <button
              type="button"
              onClick={plant}
              disabled={focusActive || !currentBed || Boolean(currentTile)}
            >
              Plant {chosenCrop.replaceAll("-", " ")}
              {currentBed &&
                ` in Area ${currentBed.areaId + 1} · Bed ${currentBed.tileId + 1}`}
            </button>
            {!currentBed && (
              <p>All available crop beds are harvested for today.</p>
            )}
            {farm.farmDay.focusCreditSeconds > 0 && (
              <p>
                New-day focus credit:{" "}
                {Math.floor(farm.farmDay.focusCreditSeconds / 60)} minutes
              </p>
            )}
          </section>
          <FocusForm
            target={target}
            onFocusComplete={complete}
            onFocusActiveChange={setFocusActive}
            onFocusRunningChange={setFocusRunning}
            onFocusPreview={setPreviewIntervals}
            plantedSeconds={currentTile?.focusSeconds ?? 0}
          />
        </div>
      </aside>
      <p className="movement-hint" role="status">
        {focusRunning
          ? "Your farmer is tending the active bed."
          : "Click the farm, then use arrow keys — or tap a path to walk."}
      </p>
    </>
  );
}
