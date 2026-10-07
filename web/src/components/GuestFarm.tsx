import { useEffect, useMemo, useState } from "react";
import { activeBed, completeFocus, createFarm, openFarmDay, previewFocus, SEASON_CONTENT } from "../game/farm.ts";
import { ANIMAL_PRODUCTS } from "../game/seasonalFrames.ts";
import type { CompletedFocus } from "../reducers/timer";
import { FarmCanvas } from "./FarmCanvas";
import { FocusForm } from "./FocusForm";
import { ItemSprite } from "./ItemSprite";
import { Inventory } from "./Inventory";
import { APPEARANCE_OPTIONS } from "../game/avatar";

const AVATAR_GROUPS = [
  { key: "hair", label: "Hair" },
  { key: "skin", label: "Skin tone" },
  { key: "shirt", label: "Shirt" },
  { key: "pants", label: "Pants" },
] as const;

export function GuestFarm({ onSeasonChange, mode }: { onSeasonChange: (season: Season) => void; mode: "guest" | "demo" }) {
  const [farm, setFarm] = useState(() => createFarm(Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone));
  const [selection, setSelection] = useState<FocusTarget>({ kind: "crop", cropId: "strawberry" });
  const [focusActive, setFocusActive] = useState(false);
  const [focusRunning, setFocusRunning] = useState(false);
  const [previewIntervals, setPreviewIntervals] = useState<RunningInterval[]>([]);
  const [timerOpen, setTimerOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (focusActive) return;
    const refresh = () => setFarm(current => openFarmDay(current, Date.now()));
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(interval); window.removeEventListener("visibilitychange", refresh); };
  }, [focusActive]);
  const { crops, animals } = SEASON_CONTENT[farm.progress.season];
  const selectedIsAvailable = selection.kind === "crop" ? crops.includes(selection.cropId) : animals.includes(selection.animalId);
  const target: FocusTarget = focusActive || selectedIsAvailable ? selection : { kind: "crop", cropId: crops[0] };
  const displayFarm = useMemo(() => previewFocus(farm, target, previewIntervals), [farm, target.kind, target.kind === "crop" ? target.cropId : target.animalId, previewIntervals]);
  const bed = activeBed(farm), displayBed = activeBed(displayFarm);
  const tile = farm.farmDay.tiles.find(t => t.areaId === bed.areaId && t.tileId === bed.tileId && !t.harvested);
  const displayTile = displayFarm.farmDay.tiles.find(t => t.areaId === displayBed.areaId && t.tileId === displayBed.tileId && !t.harvested);
  const progress = target.kind === "animal" ? displayFarm.pens[target.animalId]?.focusSeconds ?? 0 : displayTile?.focusSeconds ?? 0;
  useEffect(() => onSeasonChange(farm.progress.season), [farm.progress.season, onSeasonChange]);

  function complete(focus: CompletedFocus) {
    try {
      const next = completeFocus(farm, focus);
      setFarm(next);
      setPreviewIntervals([]);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not collect this session. Keep this tab open."); }
  }
  return <>
    <FarmCanvas farm={displayFarm} active={target.kind === "crop" ? displayBed : null} activeAnimal={target.kind === "animal" ? target.animalId : null} running={focusRunning} />
    <aside className="game-hud" aria-label="Farm controls">
      <div className="hud-buttons">
        <button type="button" className="hud-toggle" onClick={() => setInventoryOpen(true)}>Inventory</button>
        <button type="button" className="hud-toggle" aria-expanded={avatarOpen} aria-controls="avatar-tools" onClick={() => setAvatarOpen(open => !open)}>{avatarOpen ? "Close farmer" : "Farmer"}</button>
        <button type="button" className="hud-toggle" aria-expanded={timerOpen} aria-controls="farm-tools" onClick={() => setTimerOpen(open => !open)}>{timerOpen ? "Close" : focusRunning ? "Focus in progress" : "Plant & focus"}</button>
      </div>
      <div id="avatar-tools" className="hud-content avatar-content" hidden={!avatarOpen}>
        <h2>Customize farmer</h2>
        <p>Changes update your farmer in the scene.</p>
        {AVATAR_GROUPS.map(group => <fieldset className="avatar-group" key={group.key}>
          <legend>{group.label}</legend>
          <div className="avatar-options">
            {APPEARANCE_OPTIONS[group.key].map(option => <button key={option.id} type="button" className="avatar-option"
              aria-pressed={farm.avatar[group.key] === option.id} disabled={focusActive}
              onClick={() => setFarm(current => ({ ...current, avatar: { ...current.avatar, [group.key]: option.id } as FarmerAppearance }))}>
              <i aria-hidden="true" style={{ backgroundColor: option.color }} />
              <span>{option.label}</span>
            </button>)}
          </div>
        </fieldset>)}
        {focusActive && <p className="avatar-note">Pause or finish your focus timer to change appearance.</p>}
      </div>
      <div id="farm-tools" className="hud-content" hidden={!timerOpen}>
        <p className="guest-status">{mode === "demo" ? "Google sign-in demo" : "Guest farm"} · {farm.progress.season} · progress isn’t saved</p>
        <section aria-label="Focus target" className="planting-controls">
          <fieldset className="farm-item-section"><legend>Crops</legend><div className="farm-item-row">
            {crops.map(crop => <button key={crop} type="button" className="farm-item" aria-pressed={target.kind === "crop" && target.cropId === crop} disabled={focusActive} onClick={() => setSelection({ kind: "crop", cropId: crop })}>
              <ItemSprite item={crop} /><span>{crop.replaceAll("-", " ")}</span>
            </button>)}
          </div></fieldset>
          <fieldset className="farm-item-section"><legend>Animals</legend><div className="farm-item-row">
            {animals.map((animal, index) => {
              const unlocked = farm.progress.unlockedAnimals.includes(animal);
              return <button key={animal} type="button" className="farm-item" aria-pressed={target.kind === "animal" && target.animalId === animal} disabled={focusActive || !unlocked} onClick={() => setSelection({ kind: "animal", animalId: animal })}>
                <ItemSprite item={animal} animal /><span>{animal.replaceAll("-", " ")}</span><small>{unlocked ? ANIMAL_PRODUCTS[animal] : `${(index + 1) * 4} harvests`}</small>
              </button>;
            })}
          </div></fieldset>
          <p>{target.kind === "crop" ? `Area ${displayBed.areaId + 1} · Bed ${displayBed.tileId + 1} · ${displayTile?.cropId ?? target.cropId}` : `${target.animalId.replaceAll("-", " ")} pen`} · {Math.floor(progress / 60)} / 15 growth min</p>
          {target.kind === "crop" && tile && tile.cropId !== target.cropId && <p>Finish {tile.cropId} first; {target.cropId} will grow in the next bed.</p>}
          <p>Harvests collect automatically. Each full 50 focus minutes in one completed task earns 10 bonus growth minutes.</p>
        </section>
        <FocusForm target={target} onFocusComplete={complete} onFocusActiveChange={setFocusActive} onFocusRunningChange={setFocusRunning} onFocusPreview={setPreviewIntervals} plantedSeconds={target.kind === "crop" ? tile?.focusSeconds ?? 0 : farm.pens[target.animalId]?.focusSeconds ?? 0} />
        {error && <p role="alert">{error}</p>}
      </div>
    </aside>
    {inventoryOpen && <Inventory farm={farm} onClose={() => setInventoryOpen(false)} />}
    <p className="movement-hint" role="status">{focusRunning ? `Your farmer is tending ${target.kind === "animal" ? "the selected pen" : "the active bed"}.` : "Click the farm, then use arrow keys — or tap a path to walk."}</p>
  </>;
}
