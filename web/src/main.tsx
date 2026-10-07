import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { useMemo, useState } from "react";
import "./style.css";
import { FarmCanvas } from "./components/FarmCanvas";
import { GuestFarm } from "./components/GuestFarm";
import { SEASONS } from "./game/farm";
import { createPreviewFarm } from "./game/scenePreview";
import meadowGround from "../../art/source/meadow-ground.png?url";
import sandyGround from "../../art/source/sandy-path-sample.png?url";
import autumnGround from "../../art/source/autumn-ground.png?url";
import winterGround from "../../art/source/winter-ground.png?url";

const GROUND: Record<Season, string> = {
  spring: meadowGround, summer: sandyGround, rainy: meadowGround,
  autumn: autumnGround, winter: winterGround,
};

function App() {
  const [entry, setEntry] = useState<"guest" | "demo" | "preview" | null>(null);
  const [effects, setEffects] = useState(true);
  const [season, setSeason] = useState<Season>("spring");
  function enter(mode: "guest" | "demo") {
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
            <span>Visual preview</span>
          </nav>
        </> : entry ? <GuestFarm onSeasonChange={setSeason} mode={entry} /> : <>
          <div className="title-farm" aria-hidden="true" inert><FarmCanvas farm={farm} active={null} autoplay /></div>
          <section className="title-screen" aria-labelledby="game-title">
            <div className="title-menu">
              <p className="title-kicker">A little time to grow</p>
              <h1 id="game-title">FOCUS<br /><span>VALLEY</span></h1>
              <div className="title-actions">
                <button type="button" aria-describedby="google-status" onClick={() => enter("demo")}>Continue with Google</button>
                <button type="button" onClick={() => setEntry("preview")}>Preview seasons</button>
                <button type="button" className="guest-entry" onClick={() => enter("guest")}>Try as guest</button>
              </div>
              <p>Try the farm. Progress won’t be saved.</p>
              <small id="google-status">Google sign-in is a demo for now. No account is connected or saved.</small>
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
