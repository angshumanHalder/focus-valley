import { useEffect, useState } from "react";
import {
  assignFocusCredit, completeFocus, createFarm, growthStage,
  openFarmDay, plantCrop, SEASON_CONTENT,
} from "../game/farm.ts";
import type { CompletedFocus } from "../reducers/timer";
import { FocusForm } from "./FocusForm";

type GuestState = { farm: FarmState; sessions: CompletedFocus[]; closedDays: FarmDay[] };
type Bed = { areaId: number; tileId: number };

function rollDay(guest: GuestState, nowMs: number): GuestState {
  const transition = openFarmDay(guest.farm, nowMs);
  return transition.closedDays.length === 0 ? guest : {
    ...guest,
    farm: transition.farm,
    closedDays: [...guest.closedDays, ...transition.closedDays],
  };
}

export function GuestFarm() {
  const [guest, setGuest] = useState<GuestState>(() => ({
    farm: createFarm(Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone),
    sessions: [],
    closedDays: [],
  }));
  const [selected, setSelected] = useState<Bed>({ areaId: 0, tileId: 0 });
  const [cropId, setCropId] = useState("strawberry");
  const [focusActive, setFocusActive] = useState(false);

  useEffect(() => {
    if (focusActive) return;
    const refresh = () => {
      const nowMs = Date.now();
      setGuest(current => rollDay(current, nowMs));
    };
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("visibilitychange", refresh);
    };
  }, [focusActive]);

  const { farm } = guest;
  const crops = SEASON_CONTENT[farm.progress.season].crops;
  const chosenCrop = crops.includes(cropId) ? cropId : crops[0];
  const selectedTile = farm.farmDay.tiles.find(
    tile => tile.areaId === selected.areaId && tile.tileId === selected.tileId,
  );
  const target = selectedTile && !selectedTile.harvested ? selected : null;

  function selectBed(bed: Bed) {
    setSelected(bed);
    if (focusActive) return;
    const nowMs = Date.now();
    setGuest(current => {
      const rolled = rollDay(current, nowMs);
      const tile = rolled.farm.farmDay.tiles.find(
        entry => entry.areaId === bed.areaId && entry.tileId === bed.tileId,
      );
      if (!tile || tile.harvested || rolled.farm.farmDay.focusCreditSeconds <= 0) return rolled;
      return { ...rolled, farm: assignFocusCredit(rolled.farm, bed.areaId, bed.tileId) };
    });
  }

  function plant() {
    const nowMs = Date.now();
    setGuest(current => {
      const rolled = rollDay(current, nowMs);
      const available = SEASON_CONTENT[rolled.farm.progress.season].crops;
      const planted = plantCrop(
        rolled.farm, selected.areaId, selected.tileId,
        available.includes(chosenCrop) ? chosenCrop : available[0],
      );
      return {
        ...rolled,
        farm: planted.farmDay.focusCreditSeconds > 0
          ? assignFocusCredit(planted, selected.areaId, selected.tileId) : planted,
      };
    });
  }

  function complete(focus: CompletedFocus) {
    const target = focus.target;
    if (!target) return;
    setGuest(current => {
      const result = completeFocus(
        current.farm, target.areaId, target.tileId, focus.intervals,
      );
      return {
        farm: result.farm,
        sessions: [...current.sessions, focus],
        closedDays: [...current.closedDays, ...result.closedDays],
      };
    });
  }

  return (
    <>
      <section aria-labelledby="farm-heading" className="timer-panel farm-panel">
        <h2 id="farm-heading">Guest farm</h2>
        <p>{farm.progress.season} · {farm.farmDay.date} · {farm.progress.totalHarvests} harvests</p>
        <label htmlFor="crop-choice">Crop</label>
        <select id="crop-choice" value={chosenCrop} onChange={event => setCropId(event.target.value)} disabled={focusActive}>
          {crops.map(crop => <option key={crop} value={crop}>{crop.replaceAll("-", " ")}</option>)}
        </select>
        {Array.from({ length: farm.progress.unlockedAreaCount }, (_, areaId) => (
          <fieldset key={areaId} className="crop-area">
            <legend>Area {areaId + 1}</legend>
            <div className="beds">
              {[0, 1, 2, 3].map(tileId => {
                const tile = farm.farmDay.tiles.find(entry => entry.areaId === areaId && entry.tileId === tileId);
                return <button
                  key={tileId} type="button" disabled={focusActive}
                  aria-pressed={selected.areaId === areaId && selected.tileId === tileId}
                  onClick={() => selectBed({ areaId, tileId })}
                >
                  Bed {tileId + 1}<br />
                  {tile ? <>
                    {tile.cropId.replaceAll("-", " ")} · {tile.harvested ? "harvested" : `stage ${growthStage(tile)}/12`}
                    <small className="bed-progress">{Math.floor(tile.focusSeconds / 60)} / 60 focus min</small>
                    <progress max={3600} value={tile.focusSeconds} aria-label={`Bed ${tileId + 1} growth`} />
                  </> : "Empty"}
                </button>;
              })}
            </div>
          </fieldset>
        ))}
        <button type="button" onClick={plant} disabled={focusActive || Boolean(selectedTile)}>Plant {chosenCrop.replaceAll("-", " ")}</button>
        {farm.farmDay.focusCreditSeconds > 0 && <p>New-day focus credit: {Math.floor(farm.farmDay.focusCreditSeconds / 60)} minutes</p>}
      </section>

      <section aria-labelledby="timer-heading" className="timer-panel">
        <FocusForm target={target} onFocusComplete={complete} onFocusActiveChange={setFocusActive} />
      </section>

      {guest.sessions.length > 0 && <section aria-labelledby="sessions-heading" className="timer-panel">
        <h2 id="sessions-heading">Completed sessions</h2>
        <ol>{guest.sessions.map((session, index) =>
          <li key={index}>{session.label} · {session.durationMs / 60_000} minutes</li>)}</ol>
      </section>}
    </>
  );
}
