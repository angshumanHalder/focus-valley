import { useEffect, useMemo, useRef, useState } from "react";
import { activeBed, clearPenProduce, completeFocus, createFarm, openFarmDay, previewFocus, SEASON_CONTENT, spendBonus } from "../game/farm.ts";
import type { CompletedFocus } from "../reducers/timer";
import { FarmCanvas } from "./FarmCanvas";
import { FocusForm } from "./FocusForm";
import { ItemSprite } from "./ItemSprite";
import { LockOverlay } from "./LockOverlay";
import { Inventory } from "./Inventory";
import { APPEARANCE_OPTIONS } from "../game/avatar";
import { downloadFarm, loadFarm, saveFarm } from "../game/save";

const AVATAR_GROUPS = [
  { key: "hair", label: "Hair" },
  { key: "skin", label: "Skin tone" },
  { key: "shirt", label: "Shirt" },
  { key: "pants", label: "Pants" },
] as const;

export function GuestFarm({ onSeasonChange, simulationSeason }: { onSeasonChange: (season: Season) => void; simulationSeason?: Season }) {
  const [farm, setFarm] = useState(() => {
    const initial = createFarm(Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (simulationSeason) initial.progress.season = simulationSeason;
    return initial;
  });
  const farmRef = useRef(farm);
  const [selection, setSelection] = useState<FocusTarget | null>(null);
  const [focusActive, setFocusActive] = useState(false);
  const [focusRunning, setFocusRunning] = useState(false);
  const [previewIntervals, setPreviewIntervals] = useState<RunningInterval[]>([]);
  const [timerOpen, setTimerOpen] = useState(!!simulationSeason);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [bonusMinutes, setBonusMinutes] = useState("1");
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState(simulationSeason ? "Simulation · never saved" : "Loading saved farm…");
  const avatarPanel = useRef<HTMLDialogElement>(null);
  const focusPanel = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const viewport = window.matchMedia("(max-width: 767px)");
    const syncPanels = () => [[avatarPanel.current, avatarOpen], [focusPanel.current, timerOpen]].forEach(([panel, open]) => {
      if (!(panel instanceof HTMLDialogElement)) return;
      if (!open) { if (panel.open) panel.close(); return; }
      if (panel.open && panel.matches(":modal") !== viewport.matches) panel.close();
      if (!panel.open) viewport.matches ? panel.showModal() : panel.show();
    });
    syncPanels();
    viewport.addEventListener("change", syncPanels);
    return () => viewport.removeEventListener("change", syncPanels);
  }, [avatarOpen, timerOpen]);
  useEffect(() => {
    if (simulationSeason) return;
    let cancelled = false;
    loadFarm().then(async saved => {
      if (cancelled) return;
      const next = saved ? openFarmDay(saved, Date.now()) : farmRef.current;
      farmRef.current = next;
      setFarm(next);
      await saveFarm(next);
      if (!cancelled) setSaveStatus("Saved on this device");
    }).catch(() => { if (!cancelled) setSaveStatus("Local save unavailable"); });
    return () => { cancelled = true; };
  }, [simulationSeason]);
  async function persistFarm(next: FarmState) {
    farmRef.current = next;
    setFarm(next);
    if (simulationSeason) return;
    setSaveStatus("Saving…");
    try { await saveFarm(next); setSaveStatus("Saved on this device"); }
    catch { setSaveStatus("Could not save on this device"); setError("Your latest farm change could not be saved. Keep this tab open and try again."); }
  }
  useEffect(() => {
    if (focusActive || simulationSeason) return;
    const refresh = () => {
      const current = farmRef.current;
      const next = openFarmDay(current, Date.now());
      if (next !== current) void persistFarm(next);
    };
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(interval); window.removeEventListener("visibilitychange", refresh); };
  }, [focusActive, simulationSeason]);
  const { crops, animals } = SEASON_CONTENT[farm.progress.season];
  const availableBonusMinutes = (farm.bonusBankSeconds ?? 0) / 60;
  const requestedBonusMinutes = Number(bonusMinutes);
  const selectedIsAvailable = !selection || (selection.kind === "crop" ? crops.includes(selection.cropId) : animals.includes(selection.animalId));
  useEffect(() => {
    if (!focusActive && !selectedIsAvailable) setSelection(null);
  }, [focusActive, selectedIsAvailable, crops]);
  const target = focusActive || selectedIsAvailable ? selection : null;
  const displayFarm = useMemo(() => {
    const preview = previewFocus(farm, target, previewIntervals);
    // Animals appear only after an unlock is committed by a completed task.
    return preview === farm ? farm : { ...preview, progress: { ...preview.progress, unlockedAnimals: farm.progress.unlockedAnimals } };
  }, [farm, target, previewIntervals]);
  const bed = activeBed(farm), displayBed = activeBed(displayFarm);
  const tile = farm.farmDay.tiles.find(t => t.areaId === bed.areaId && t.tileId === bed.tileId && !t.harvested);
  const displayTile = displayFarm.farmDay.tiles.find(t => t.areaId === displayBed.areaId && t.tileId === displayBed.tileId && !t.harvested);
  const maxBonusSpendMinutes = Math.min(availableBonusMinutes, target?.kind === "crop" ? Math.floor((900 - (tile?.focusSeconds ?? 0)) / 60) : 15);
  const validBonusAmount = bonusMinutes !== "" && Number.isInteger(requestedBonusMinutes) && requestedBonusMinutes >= 1 && requestedBonusMinutes <= maxBonusSpendMinutes;
  const progress = target?.kind === "animal" ? displayFarm.pens[target.animalId]?.focusSeconds ?? 0 : displayTile?.focusSeconds ?? 0;
  useEffect(() => onSeasonChange(farm.progress.season), [farm.progress.season, onSeasonChange]);

  function start(target: FocusTarget) {
    if (target.kind === "animal") void persistFarm(clearPenProduce(farmRef.current, target.animalId));
  }
  async function complete(focus: CompletedFocus) {
    try {
      const next = completeFocus(farmRef.current, focus);
      setPreviewIntervals([]);
      if (focus.target?.kind === "crop") setSelection(null);
      setError("");
      await persistFarm(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not collect this session. Keep this tab open."); }
  }
  function useBonus() {
    if (!target || focusActive || !validBonusAmount) return;
    try {
      const next = spendBonus(farmRef.current, target, requestedBonusMinutes);
      if (target.kind === "crop" && next.progress.nextBedIndex !== farmRef.current.progress.nextBedIndex) setSelection(null);
      setError("");
      setBonusMinutes("1");
      void persistFarm(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not spend bonus minutes."); }
  }
  function updateAppearance(group: keyof FarmerAppearance, value: FarmerAppearance[keyof FarmerAppearance]) {
    const current = farmRef.current;
    void persistFarm({ ...current, avatar: { ...current.avatar, [group]: value } as FarmerAppearance });
  }
  return <>
    <FarmCanvas farm={displayFarm} active={target?.kind === "crop" ? displayBed : null} activeAnimal={target?.kind === "animal" ? target.animalId : null} running={focusRunning} />
    <aside className="game-hud" aria-label="Farm controls">
      <div className="hud-buttons">
        <button type="button" className="hud-toggle" disabled={!!simulationSeason} onClick={() => downloadFarm(farm)}>Download save</button>
        <button type="button" className="hud-toggle" onClick={() => setInventoryOpen(true)}>Inventory</button>
        <div className="hud-menu-item">
          <button type="button" className="hud-toggle" aria-expanded={avatarOpen} aria-controls="avatar-tools" onClick={() => { setAvatarOpen(open => !open); setTimerOpen(false); }}>{avatarOpen ? "Close farmer" : "Farmer"}</button>
          <dialog ref={avatarPanel} id="avatar-tools" className="hud-content avatar-content" aria-labelledby="avatar-title" onCancel={() => setAvatarOpen(false)}>
        <button type="button" className="mobile-panel-close" onClick={() => setAvatarOpen(false)}>Close</button>
        <h2 id="avatar-title">Customize farmer</h2>
        <p>Changes update your farmer in the scene.</p>
        {AVATAR_GROUPS.map(group => <fieldset className="avatar-group" key={group.key}>
          <legend>{group.label}</legend>
          <div className="avatar-options">
            {APPEARANCE_OPTIONS[group.key].map(option => <button key={option.id} type="button" className="avatar-option"
              aria-pressed={farm.avatar[group.key] === option.id} disabled={focusActive}
              onClick={() => updateAppearance(group.key, option.id)}>
              <i aria-hidden="true" style={{ backgroundColor: option.color }} />
              <span>{option.label}</span>
            </button>)}
          </div>
        </fieldset>)}
        {focusActive && <p className="avatar-note">Pause or finish your focus timer to change appearance.</p>}
          </dialog>
        </div>
        <div className="hud-menu-item">
          <button type="button" className="hud-toggle" aria-expanded={timerOpen} aria-controls="farm-tools" onClick={() => { setTimerOpen(open => !open); setAvatarOpen(false); }}>{timerOpen ? "Close" : focusRunning ? "Focus in progress" : "Plant & focus"}</button>
          <dialog ref={focusPanel} id="farm-tools" className="hud-content focus-content" aria-labelledby="focus-title" onCancel={() => setTimerOpen(false)}>
        <button type="button" className="mobile-panel-close" onClick={() => setTimerOpen(false)}>Close</button>
        <h2 id="focus-title" className="visually-hidden">Focus and planting</h2>
        <p className="guest-status">Your farm · {farm.progress.season} · {saveStatus}</p>
        <section aria-label="Focus target" className="planting-controls">
          <fieldset className="farm-item-section" hidden={focusRunning}><legend>Crops</legend><div className="farm-item-row">
            {crops.map(crop => <button key={crop} type="button" className="farm-item" aria-pressed={target?.kind === "crop" && target.cropId === crop} disabled={focusActive} onClick={() => setSelection({ kind: "crop", cropId: crop })}>
              <ItemSprite item={crop} /><span>{crop.replaceAll("-", " ")}</span>
            </button>)}
          </div></fieldset>
          <fieldset className="farm-item-section" hidden={focusRunning}><legend>Animals</legend><div className="farm-item-row">
            {animals.map(animal => {
              const unlocked = farm.progress.unlockedAnimals.includes(animal);
              return <button key={animal} type="button" className="farm-item" aria-pressed={target?.kind === "animal" && target.animalId === animal} disabled={focusActive || !unlocked} onClick={() => setSelection({ kind: "animal", animalId: animal })}>
                <ItemSprite item={animal} animal />{!unlocked && <LockOverlay />}<span>{animal.replaceAll("-", " ")}</span>
              </button>;
            })}
          </div></fieldset>
          <p>{target ? `${target.kind === "crop" ? `Area ${displayBed.areaId + 1} · Bed ${displayBed.tileId + 1} · ${displayTile?.cropId ?? target.cropId}` : `${target.animalId.replaceAll("-", " ")} pen`} · ${Math.floor(progress / 60)} / 15 growth min` : "Select a crop or animal before starting focus"}</p>
          {target?.kind === "crop" && tile && tile.cropId !== target.cropId && <p>Finish {tile.cropId} first; {target.cropId} will grow in the next bed.</p>}
          <div className="bonus-panel">
            <p><strong>Bonus credit: {availableBonusMinutes} / 15 min</strong><br />Earn 1 minute for each 25 completed focus minutes in total. Spend it only when you press Apply.</p>
            {availableBonusMinutes > 0 && !focusActive && <div className="bonus-controls">
              <label htmlFor="bonus-minutes">Use bonus minutes</label>
              <input id="bonus-minutes" type="number" inputMode="numeric" min="1" max={maxBonusSpendMinutes} step="1" value={bonusMinutes} onChange={event => setBonusMinutes(event.target.value)} />
              <button type="button" onClick={useBonus} disabled={!target || !validBonusAmount}>Apply</button>
            </div>}
          </div>
          <p>Harvests collect automatically.</p>
        </section>
        <FocusForm target={target} onFocusStart={start} onFocusComplete={complete} onFocusActiveChange={setFocusActive} onFocusRunningChange={setFocusRunning} onFocusPreview={setPreviewIntervals} plantedSeconds={target?.kind === "crop" ? tile?.focusSeconds ?? 0 : target?.kind === "animal" ? farm.pens[target.animalId]?.focusSeconds ?? 0 : 0} simulation={!!simulationSeason} />
        {simulationSeason && <section className="simulation-results" aria-label="Simulation results" aria-live="polite">
          <h3>Simulation results</h3>
          <p>{farm.sessions.length} completed tasks · {farm.progress.totalHarvests} completed farm cycles · {farm.progress.unlockedAreaCount} unlocked areas</p>
          <p>{displayFarm.progress.totalHarvests - farm.progress.totalHarvests} farm cycles pending completion. Cancelling discards pending growth.</p>
          <p>Last task earned: {(farm.sessions.at(-1)?.bonusSeconds ?? 0) / 60} bonus minutes · credit: {availableBonusMinutes} / 15.</p>
          <p>Committed inventory: {Object.entries(farm.inventory).map(([item, count]) => `${item.split(":")[1].replaceAll("-", " ")}: ${count}`).join(" · ") || "empty"}</p>
        </section>}
        {error && <p role="alert">{error}</p>}
          </dialog>
        </div>
      </div>
    </aside>
    {inventoryOpen && <Inventory farm={farm} onClose={() => setInventoryOpen(false)} />}
    <p className="movement-hint" role="status">{focusRunning ? `Your farmer is tending ${target?.kind === "animal" ? "the selected pen" : "the active bed"}.` : "Click the farm, then use arrow keys — or tap a path to walk."}</p>
  </>;
}
