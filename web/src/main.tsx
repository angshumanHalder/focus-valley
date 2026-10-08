import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import "./style.css";
import { FarmCanvas } from "./components/FarmCanvas";
import { GuestFarm } from "./components/GuestFarm";
import { SEASONS } from "./game/farm";
import { createPreviewFarm } from "./game/scenePreview";
import { clearFarmSave, loadFarm, readFarmFile, saveFarm } from "./game/save";
import meadowGround from "../../art/source/environment/ground/meadow-ground.png?url";
import sandyGround from "../../art/source/environment/ground/sandy-path.png?url";
import autumnGround from "../../art/source/environment/ground/autumn-ground.png?url";
import winterGround from "../../art/source/environment/ground/winter-ground.png?url";

const GROUND: Record<Season, string> = {
  spring: meadowGround, summer: sandyGround, rainy: meadowGround,
  autumn: autumnGround, winter: winterGround,
};

function App() {
  const [entry, setEntry] = useState<"guest" | "preview" | null>(null);
  const [playMenu, setPlayMenu] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const [saveChecked, setSaveChecked] = useState(false);
  const [menuError, setMenuError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const [effects, setEffects] = useState(true);
  const [season, setSeason] = useState<Season>("spring");
  useEffect(() => { loadFarm().then(save => setHasSave(!!save)).catch(() => setHasSave(false)).finally(() => setSaveChecked(true)); }, []);
  function enter(mode: "guest") {
    const update = () => { window.scrollTo(0, 0); flushSync(() => setEntry(mode)); };
    if (document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      document.startViewTransition(update);
    else update();
  }
  const farm = useMemo(() => createPreviewFarm(season), [season]);
  return (
    <>
      <div className="season-backdrop" aria-hidden="true" style={{ backgroundImage: `url(${GROUND[season]})` }} />
      <main className="game-world">
        {entry === "preview" ? <>
          <FarmCanvas farm={farm} active={null} autoplay showcase />
          <nav className="season-preview-controls" aria-label="Farm preview">
            <button type="button" onClick={() => setEntry(null)}>Back</button>
            <label htmlFor="preview-season">Season</label>
            <select id="preview-season" value={season} onChange={event => setSeason(event.target.value as Season)}>
              {SEASONS.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
            </select>
            <span>Bed order: planted → 5 → 10 → 15 min</span>
          </nav>
        </> : entry ? <GuestFarm onSeasonChange={setSeason} /> : <>
          <div className="title-farm" aria-hidden="true" inert><FarmCanvas farm={farm} active={null} autoplay /></div>
          <section className="title-screen" aria-labelledby="game-title">
            <div className="title-menu">
              <p className="title-kicker">A little time to grow</p>
              <h1 id="game-title">FOCUS<br /><span>VALLEY</span></h1>
              {!playMenu ? <div className="title-actions">
                <button type="button" onClick={() => setPlayMenu(true)}>Play</button>
                <button type="button" onClick={() => setEntry("preview")}>Preview seasons</button>
              </div> : <div className="title-actions">
                <button type="button" className="guest-entry" disabled={!saveChecked} onClick={async () => {
                  if (hasSave && !window.confirm("Starting a new game will replace your current farm. Continue?")) return;
                  try { await clearFarmSave(); setHasSave(false); setMenuError(""); enter("guest"); }
                  catch { setMenuError("Could not replace the saved farm on this device."); }
                }}>New Game</button>
                {hasSave && <button type="button" disabled={!saveChecked} onClick={() => enter("guest")}>Continue Game</button>}
                <button type="button" disabled={!saveChecked} onClick={() => fileInput.current?.click()}>Load Save File</button>
                <button type="button" onClick={() => { setPlayMenu(false); setMenuError(""); }}>Back</button>
              </div>}
              <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={async event => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (!file) return;
                try {
                  const farm = await readFarmFile(file);
                  if (hasSave && !window.confirm("Loading this file will replace your current farm. Continue?")) return;
                  await saveFarm(farm);
                  setHasSave(true);
                  setMenuError("");
                  enter("guest");
                } catch (cause) { setMenuError(cause instanceof Error ? cause.message : "Could not load save file."); }
              }} />
              {menuError && <p role="alert">{menuError}</p>}
              <p>Your farm saves on this device. You can also export a save file.</p>
              <small>No account required. Save files stay in your browser unless you download one.</small>
            </div>
          </section>
        </>}
      </main>
      {effects && <div className={`weather weather-${season}`} aria-hidden="true">
        {season === "rainy" && <><div className="cloud-shadows" /><div className="rain-overlay" /></>}
        {(season === "autumn" || season === "winter") && Array.from({ length: 18 }, (_, i) => <i key={i} style={{ left: `${i * 37 % 100}%`, animationDelay: `${-i * 1.7}s`, animationDuration: `${9 + i % 7}s`, width: `${season === "winter" ? 3 + i % 4 : 6 + i % 5}px`, height: `${season === "winter" ? 3 + i % 4 : 10 + i % 5}px` }} />)}
      </div>}
      {entry && <button type="button" className="effects-toggle" aria-pressed={effects} onClick={() => setEffects(on => !on)}>Effects: {effects ? "on" : "off"}</button>}
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
