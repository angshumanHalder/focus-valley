import { useEffect, useState } from "react";
import {
  activeBed, assignFocusCredit, completeFocus, createFarm, growthStage,
  openFarmDay, plantCrop, SEASON_CONTENT, SEASONS,
} from "../game/farm.ts";
import type { CompletedFocus } from "../reducers/timer";
import { FarmCanvas } from "./FarmCanvas";
import { FocusForm } from "./FocusForm";

type GuestState = { farm: FarmState; sessions: CompletedFocus[]; closedDays: FarmDay[] };

function rollDay(guest: GuestState, nowMs: number): GuestState {
  const transition = openFarmDay(guest.farm, nowMs);
  return transition.closedDays.length === 0 ? guest : {
    ...guest,
    farm: transition.farm,
    closedDays: [...guest.closedDays, ...transition.closedDays],
  };
}

export function GuestFarm({ onSeasonChange }: { onSeasonChange: (season: Season) => void }) {
  const params = new URLSearchParams(window.location.search);
  const fullFarmPreview = params.get("preview") === "full-farm";
  const requestedSeason = params.get("season");
  const [guest, setGuest] = useState<GuestState>(() => {
    const farm = createFarm(Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone);
    return {
      farm: fullFarmPreview ? {
        ...farm,
        progress: {
          ...farm.progress,
          season: SEASONS.includes(requestedSeason as Season) ? requestedSeason as Season : farm.progress.season,
          unlockedAreaCount: 4,
          unlockedAnimals: ["chicken", "rabbit"],
        },
        farmDay: {
          ...farm.farmDay,
          tiles: Array.from({ length: 16 }, (_, index) => ({
            areaId: Math.floor(index / 4), tileId: index % 4,
            cropId: SEASON_CONTENT.spring.crops[index % 4],
            focusSeconds: 3599, harvested: false,
          })),
        },
      } : farm,
      sessions: [],
      closedDays: [],
    };
  });
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
  const currentBed = activeBed(farm);
  const currentTile = farm.farmDay.tiles.find(
    tile => tile.areaId === currentBed?.areaId && tile.tileId === currentBed?.tileId,
  );
  const target = currentTile ? currentBed : null;
  useEffect(() => onSeasonChange(farm.progress.season), [farm.progress.season, onSeasonChange]);

  function plant() {
    const nowMs = Date.now();
    setGuest(current => {
      const rolled = rollDay(current, nowMs);
      const bed = activeBed(rolled.farm);
      if (!bed) return rolled;
      const available = SEASON_CONTENT[rolled.farm.progress.season].crops;
      const planted = plantCrop(
        rolled.farm, bed.areaId, bed.tileId,
        available.includes(chosenCrop) ? chosenCrop : available[0],
      );
      return {
        ...rolled,
        farm: planted.farmDay.focusCreditSeconds > 0
          ? assignFocusCredit(planted, bed.areaId, bed.tileId) : planted,
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
      {fullFarmPreview && <p className="farm-preview">Full farm preview · four gardens · three chickens and three rabbits · <a href={window.location.pathname}>Return to your farm</a></p>}
      <div className="farm-layout">
      <section aria-labelledby="farm-heading" className="timer-panel farm-panel">
        <h2 id="farm-heading">Guest farm</h2>
        <p>{farm.progress.season} · {farm.farmDay.date} · {farm.progress.totalHarvests} harvests</p>
        <FarmCanvas farm={farm} active={currentBed} />
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
                return <div key={tileId} className="bed-status">
                  Bed {tileId + 1}<br />
                  {tile ? <>
                    {tile.cropId.replaceAll("-", " ")} · {tile.harvested ? "harvested" : `stage ${growthStage(tile)}/12`}
                    <small className="bed-progress">{Math.floor(tile.focusSeconds / 60)} / 60 focus min</small>
                    <progress max={3600} value={tile.focusSeconds} aria-label={`Bed ${tileId + 1} growth`} />
                  </> : "Empty"}
                </div>;
              })}
            </div>
          </fieldset>
        ))}
        <button type="button" onClick={plant} disabled={focusActive || !currentBed || Boolean(currentTile)}>Plant {chosenCrop.replaceAll("-", " ")}{currentBed && ` in Area ${currentBed.areaId + 1} · Bed ${currentBed.tileId + 1}`}</button>
        {!currentBed && <p>All available crop beds are harvested for today.</p>}
        {farm.farmDay.focusCreditSeconds > 0 && <p>New-day focus credit: {Math.floor(farm.farmDay.focusCreditSeconds / 60)} minutes</p>}
      </section>

      <section aria-labelledby="timer-heading" className="timer-panel">
        <FocusForm target={target} onFocusComplete={complete} onFocusActiveChange={setFocusActive} />
      </section>
      </div>

      {guest.sessions.length > 0 && <section aria-labelledby="sessions-heading" className="timer-panel">
        <h2 id="sessions-heading">Completed sessions</h2>
        <ol>{guest.sessions.map((session, index) =>
          <li key={index}>{session.label} · {session.durationMs / 60_000} minutes</li>)}</ol>
      </section>}
    </>
  );
}
