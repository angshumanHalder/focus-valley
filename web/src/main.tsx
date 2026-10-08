import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import "./style.css";
import { clearFarmSave, loadFarm, readFarmFile, saveFarm } from "./game/save";
import { clearTimerState } from "./reducers/timerSave";
import { createPreviewFarm } from "./game/scenePreview";
import { HowToPlay } from "./components/HowToPlay";
import meadowGround from "../../art/source/environment/ground/meadow-ground.png?url";
import sandyGround from "../../art/source/environment/ground/sandy-path.png?url";
import autumnGround from "../../art/source/environment/ground/autumn-ground.png?url";
import winterGround from "../../art/source/environment/ground/winter-ground.png?url";

const GROUND: Record<Season, string> = {
  spring: meadowGround, summer: sandyGround, rainy: meadowGround,
  autumn: autumnGround, winter: winterGround,
};
const FarmGame = lazy(() => import("./components/FarmGame").then(module => ({ default: module.FarmGame })));
const FarmCanvas = lazy(() => import("./components/FarmCanvas").then(module => ({ default: module.FarmCanvas })));
const previewFarm = createPreviewFarm("spring");

function App() {
  const [playing, setPlaying] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const [saveChecked, setSaveChecked] = useState(false);
  const [menuError, setMenuError] = useState("");
  const [pendingReplace, setPendingReplace] = useState<"new" | FarmState | null>(null);
  const replaceDialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [effects, setEffects] = useState(true);
  const [season, setSeason] = useState<Season>("spring");
  useEffect(() => { loadFarm().then(save => setHasSave(!!save)).catch(() => setHasSave(false)).finally(() => setSaveChecked(true)); }, []);
  useEffect(() => { if (pendingReplace && !replaceDialog.current?.open) replaceDialog.current?.showModal(); }, [pendingReplace]);
  async function newGame() {
    try { await clearFarmSave(); clearTimerState(); setHasSave(false); setMenuError(""); enter(); }
    catch { setMenuError("Could not replace the saved farm on this device."); }
  }
  async function importGame(farm: FarmState) {
    try { await saveFarm(farm); clearTimerState(); setHasSave(true); setMenuError(""); enter(); }
    catch (cause) { setMenuError(cause instanceof Error ? cause.message : "Could not load save file."); }
  }
  function enter() {
    const update = () => { window.scrollTo(0, 0); flushSync(() => setPlaying(true)); };
    if (document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      document.startViewTransition(update);
    else update();
  }
  return (
    <>
      <div className="season-backdrop" aria-hidden="true" style={{ backgroundImage: `url(${GROUND[season]})` }} />
      <main className="game-world">
        {playing ? <Suspense fallback={<div className="farm-loading">Loading farm…</div>}><FarmGame onSeasonChange={setSeason} /></Suspense> : <>
          <div className="title-farm" aria-hidden="true" inert><Suspense fallback={null}><FarmCanvas farm={previewFarm} active={null} autoplay /></Suspense></div>
          <section className="title-screen" aria-labelledby="game-title">
            <div className="title-menu">
              <p className="title-kicker">A little time to grow</p>
              <h1 id="game-title">FOCUS<br /><span>VALLEY</span></h1>
              <div className="title-actions">
                <button type="button" className="guest-entry" disabled={!saveChecked} onClick={async () => {
                  if (hasSave) setPendingReplace("new");
                  else await newGame();
                }}>New Game</button>
                {hasSave && <button type="button" disabled={!saveChecked} onClick={enter}>Continue Game</button>}
                <button type="button" disabled={!saveChecked} onClick={() => fileInput.current?.click()}>Load Save File</button>
              </div>
              <HowToPlay />
              <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={async event => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (!file) return;
                try {
                  const farm = await readFarmFile(file);
                  if (hasSave) setPendingReplace(farm);
                  else await importGame(farm);
                } catch (cause) { setMenuError(cause instanceof Error ? cause.message : "Could not load save file."); }
              }} />
              {menuError && <p role="alert">{menuError}</p>}
              <p>Your farm saves on this device. You can also export a save file.</p>
              <small>No account required. Save files stay in your browser unless you download one.</small>
            </div>
          </section>
        </>}
      </main>
      {pendingReplace && <dialog ref={replaceDialog} className="recovery-dialog" aria-labelledby="replace-title" onCancel={() => setPendingReplace(null)}>
        <h2 id="replace-title">{pendingReplace === "new" ? "Start a new farm?" : "Load another farm?"}</h2>
        <p>Your current farm on this device will be replaced. A downloaded save file can still be loaded later.</p>
        <div className="recovery-actions">
          <button type="button" className="primary" onClick={() => { const choice = pendingReplace; setPendingReplace(null); if (choice === "new") void newGame(); else void importGame(choice); }}>Replace farm</button>
          <button type="button" onClick={() => setPendingReplace(null)}>Keep current farm</button>
        </div>
      </dialog>}
      {effects && <div className={`weather weather-${season}`} aria-hidden="true">
        {season === "rainy" && <><div className="cloud-shadows" /><div className="rain-overlay" /></>}
        {(season === "autumn" || season === "winter") && Array.from({ length: 18 }, (_, i) => <i key={i} style={{ left: `${i * 37 % 100}%`, animationDelay: `${-i * 1.7}s`, animationDuration: `${9 + i % 7}s`, width: `${season === "winter" ? 3 + i % 4 : 6 + i % 5}px`, height: `${season === "winter" ? 3 + i % 4 : 10 + i % 5}px` }} />)}
      </div>}
      {playing && <button type="button" className="effects-toggle" aria-pressed={effects} onClick={() => setEffects(on => !on)}>Effects: {effects ? "on" : "off"}</button>}
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const register = () => { void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`); };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
